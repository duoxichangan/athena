"""
Athena — AI 篮球运动员分析引擎

职责：
1. 将原始姿态帧数据计算为运动学统计摘要
2. 调用 DeepSeek Anthropic-兼容 API 进行篮球技术分析
3. 解析 LLM 返回结果
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
import numpy as np

from config import (
    AI_MAX_TOKENS,
    AI_MIN_FRAMES_FOR_ANALYSIS,
    AI_TEMPERATURE,
    AI_TIMEOUT_SECONDS,
    ANALYSIS_SYSTEM_PROMPT,
    ANALYSIS_USER_PROMPT_TEMPLATE,
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
    KEYPOINT_NAMES,
)

# COCO 关键点索引
IDX = {name: i for i, name in enumerate(KEYPOINT_NAMES)}

# 对称比较对 (left_idx, right_idx, label)
SYMMETRY_PAIRS = [
    (IDX["left_shoulder"], IDX["right_shoulder"], "肩部"),
    (IDX["left_elbow"], IDX["right_elbow"], "肘部"),
    (IDX["left_wrist"], IDX["right_wrist"], "手腕"),
    (IDX["left_hip"], IDX["right_hip"], "髋部"),
    (IDX["left_knee"], IDX["right_knee"], "膝部"),
    (IDX["left_ankle"], IDX["right_ankle"], "脚踝"),
]

# 角度计算三元组 (a, b, c) → 角度 at b
ANGLE_TRIPLES = {
    "左膝": (IDX["left_hip"], IDX["left_knee"], IDX["left_ankle"]),
    "右膝": (IDX["right_hip"], IDX["right_knee"], IDX["right_ankle"]),
    "左肘": (IDX["left_shoulder"], IDX["left_elbow"], IDX["left_wrist"]),
    "右肘": (IDX["right_shoulder"], IDX["right_elbow"], IDX["right_wrist"]),
}


# ══════════════════════════════════════════════════════════════════════════════
# 运动学统计摘要
# ══════════════════════════════════════════════════════════════════════════════

def compute_kinematic_summary(
    player_data: dict,
    fps: float,
    total_frames: int,
) -> dict:
    """从原始逐帧关键点数据计算运动学统计摘要。

    Args:
        player_data: 单个球员的数据 dict，包含 frames 列表
        fps: 视频帧率
        total_frames: 视频总帧数

    Returns:
        统计摘要 dict，包含 movement, symmetry, angles, pose_distribution, temporal
    """
    frames = player_data.get("frames", [])
    n_frames = len(frames)

    if n_frames == 0:
        return _empty_summary()

    # 提取所有帧的关键点为 numpy 数组 [n_frames, 17, 3]
    kpts_all = np.array([f["kpts"] for f in frames], dtype=np.float32)
    conf = kpts_all[:, :, 2]  # [n_frames, 17]
    valid_mask = conf > 0.3  # 置信度阈值

    # ── 重心 (Center of Mass: 左右髋中点) ──────────────────────
    hip_left = kpts_all[:, IDX["left_hip"], :]   # [n, 3]
    hip_right = kpts_all[:, IDX["right_hip"], :]  # [n, 3]
    com = (hip_left[:, :2] + hip_right[:, :2]) / 2.0  # [n, 2]

    # 只取双髋都有效的帧
    com_valid = (conf[:, IDX["left_hip"]] > 0.3) & (conf[:, IDX["right_hip"]] > 0.3)
    com_valid_frames = com[com_valid]

    movement = _compute_movement(com_valid_frames, fps)

    # ── 对称性 ──────────────────────────────────────────────────
    symmetry = _compute_symmetry(kpts_all, valid_mask)

    # ── 关节角度 ─────────────────────────────────────────────────
    angles = _compute_angles(kpts_all, valid_mask)

    # ── 姿态分布 ────────────────────────────────────────────────
    pose_dist = _compute_pose_distribution(kpts_all, valid_mask, com)

    # ── 时间统计 ────────────────────────────────────────────────
    duration = n_frames / fps if fps > 0 else 0
    avg_conf = float(conf.mean()) if conf.size > 0 else 0.0

    temporal = {
        "fps": fps,
        "total_frames_visible": n_frames,
        "duration_seconds": round(duration, 1),
        "avg_keypoint_confidence": round(avg_conf, 3),
        "data_sufficient": n_frames >= AI_MIN_FRAMES_FOR_ANALYSIS,
    }

    # ── 运动流畅度 ──────────────────────────────────────────────
    smoothness = _compute_smoothness(com_valid_frames)

    # ── 格式化为 LLM 可读文本 ───────────────────────────────────
    formatted = _format_stats(movement, symmetry, angles, pose_dist, smoothness)

    return {
        "movement": movement,
        "symmetry": symmetry,
        "angles": angles,
        "pose_distribution": pose_dist,
        "temporal": temporal,
        "smoothness": smoothness,
        "formatted": formatted,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 子计算函数
# ══════════════════════════════════════════════════════════════════════════════

def _compute_movement(com_frames: np.ndarray, fps: float) -> dict:
    """计算重心运动统计。"""
    if len(com_frames) < 2:
        return {
            "total_displacement_px": 0,
            "avg_speed_px_per_frame": 0,
            "peak_speed_px_per_frame": 0,
            "vertical_range_px": 0,
            "direction_bias": "数据不足",
        }

    # 帧间位移
    diffs = np.diff(com_frames, axis=0)  # [n-1, 2]
    speeds = np.linalg.norm(diffs, axis=1)  # [n-1]

    total_disp = float(np.sum(speeds))
    avg_speed = float(np.mean(speeds))
    peak_speed = float(np.max(speeds))

    # 垂直范围 (Y 轴)
    y_vals = com_frames[:, 1]
    vertical_range = float(np.max(y_vals) - np.min(y_vals))

    # 方向偏好（X 轴位移正负比）
    x_diffs = diffs[:, 0]
    rightward = float(np.sum(x_diffs[x_diffs > 0]))
    leftward = float(np.abs(np.sum(x_diffs[x_diffs < 0])))
    total_h = rightward + leftward
    if total_h > 0:
        right_pct = round(rightward / total_h * 100)
        if right_pct > 60:
            bias = f"倾向右侧移动 ({right_pct}%)"
        elif right_pct < 40:
            bias = f"倾向左侧移动 ({100 - right_pct}%)"
        else:
            bias = f"左右均衡 ({right_pct}%/{100 - right_pct}%)"
    else:
        bias = "无明显水平移动"

    return {
        "total_displacement_px": round(total_disp, 1),
        "avg_speed_px_per_frame": round(avg_speed, 3),
        "peak_speed_px_per_frame": round(peak_speed, 3),
        "vertical_range_px": round(vertical_range, 1),
        "direction_bias": bias,
    }


def _compute_symmetry(kpts_all: np.ndarray, valid_mask: np.ndarray) -> dict:
    """计算左右对称性统计。"""
    result = {}
    all_scores = []

    for left_idx, right_idx, label in SYMMETRY_PAIRS:
        both_valid = valid_mask[:, left_idx] & valid_mask[:, right_idx]
        if both_valid.sum() < 2:
            result[label] = {"avg_height_diff_px": 0, "std_height_diff_px": 0, "score": "N/A", "note": "数据不足"}
            continue

        left_y = kpts_all[both_valid, left_idx, 1]
        right_y = kpts_all[both_valid, right_idx, 1]
        height_diffs = left_y - right_y  # 正值 = 左低右高

        avg_diff = float(np.mean(np.abs(height_diffs)))
        std_diff = float(np.std(height_diffs))

        # 对称性评分 0-100（高度差越小越好）
        # 假设 20px 差为及格线
        score = max(0, min(100, 100 - avg_diff * 5))
        all_scores.append(score)

        note = ""
        if abs(float(np.mean(height_diffs))) > 5:
            side = "左低右高" if float(np.mean(height_diffs)) > 0 else "左高右低"
            note = side

        result[label] = {
            "avg_height_diff_px": round(avg_diff, 1),
            "std_height_diff_px": round(std_diff, 1),
            "score": round(score, 1),
            "note": note,
        }

    result["综合对称性"] = round(float(np.mean(all_scores)), 1) if all_scores else 0

    return result


def _compute_angles(kpts_all: np.ndarray, valid_mask: np.ndarray) -> dict:
    """计算关键关节角度。"""
    result = {}

    for name, (a_idx, b_idx, c_idx) in ANGLE_TRIPLES.items():
        # 取三个关键点都有效的帧
        all_valid = valid_mask[:, a_idx] & valid_mask[:, b_idx] & valid_mask[:, c_idx]
        if all_valid.sum() < 2:
            result[name] = {"avg_angle_deg": 0, "std_angle_deg": 0, "min_angle_deg": 0, "max_angle_deg": 0, "note": "数据不足"}
            continue

        a = kpts_all[all_valid, a_idx, :2]
        b = kpts_all[all_valid, b_idx, :2]
        c = kpts_all[all_valid, c_idx, :2]

        angles_deg = _batch_angle(a, b, c)

        result[name] = {
            "avg_angle_deg": round(float(np.mean(angles_deg)), 1),
            "std_angle_deg": round(float(np.std(angles_deg)), 1),
            "min_angle_deg": round(float(np.min(angles_deg)), 1),
            "max_angle_deg": round(float(np.max(angles_deg)), 1),
            "note": "",
        }

    # 躯干倾斜角（肩中点 → 髋中点 与 垂直线 的夹角）
    shoulder_mid_valid = valid_mask[:, IDX["left_shoulder"]] & valid_mask[:, IDX["right_shoulder"]]
    hip_mid_valid = valid_mask[:, IDX["left_hip"]] & valid_mask[:, IDX["right_hip"]]
    both_mid_valid = shoulder_mid_valid & hip_mid_valid

    if both_mid_valid.sum() >= 2:
        shoulder_mid = (kpts_all[both_mid_valid, IDX["left_shoulder"], :2] + kpts_all[both_mid_valid, IDX["right_shoulder"], :2]) / 2
        hip_mid = (kpts_all[both_mid_valid, IDX["left_hip"], :2] + kpts_all[both_mid_valid, IDX["right_hip"], :2]) / 2
        torso_vec = shoulder_mid - hip_mid  # [n, 2]
        vertical = np.array([0, -1], dtype=np.float32)  # 向上
        # 计算与垂直线的夹角
        dot = np.abs(torso_vec[:, 1])  # Y 分量
        norm = np.linalg.norm(torso_vec, axis=1) + 1e-8
        cos_theta = np.clip(dot / norm, 0, 1)
        lean_angles = np.degrees(np.arccos(cos_theta))
        result["躯干倾斜"] = {
            "avg_angle_deg": round(float(np.mean(lean_angles)), 1),
            "std_angle_deg": round(float(np.std(lean_angles)), 1),
            "note": "前倾角度（越小越直立）",
        }
    else:
        result["躯干倾斜"] = {"avg_angle_deg": 0, "note": "数据不足"}

    return result


def _compute_pose_distribution(kpts_all: np.ndarray, valid_mask: np.ndarray, com: np.ndarray) -> dict:
    """将每帧分类为篮球相关姿态类别。"""
    n_frames = len(kpts_all)
    if n_frames == 0:
        return {}

    categories = {
        "站立直立": 0,
        "蹲防姿态": 0,
        "手臂上举": 0,
        "跨步宽站": 0,
        "疑似起跳": 0,
        "其他": 0,
    }

    for i in range(n_frames):
        hip_left_y = kpts_all[i, IDX["left_hip"], 1] if valid_mask[i, IDX["left_hip"]] else None
        hip_right_y = kpts_all[i, IDX["right_hip"], 1] if valid_mask[i, IDX["right_hip"]] else None
        knee_left_y = kpts_all[i, IDX["left_knee"], 1] if valid_mask[i, IDX["left_knee"]] else None
        knee_right_y = kpts_all[i, IDX["right_knee"], 1] if valid_mask[i, IDX["right_knee"]] else None
        ankle_left_y = kpts_all[i, IDX["left_ankle"], 1] if valid_mask[i, IDX["left_ankle"]] else None
        ankle_right_y = kpts_all[i, IDX["right_ankle"], 1] if valid_mask[i, IDX["right_ankle"]] else None
        wrist_left_y = kpts_all[i, IDX["left_wrist"], 1] if valid_mask[i, IDX["left_wrist"]] else None
        wrist_right_y = kpts_all[i, IDX["right_wrist"], 1] if valid_mask[i, IDX["right_wrist"]] else None
        shoulder_left_y = kpts_all[i, IDX["left_shoulder"], 1] if valid_mask[i, IDX["left_shoulder"]] else None
        shoulder_right_y = kpts_all[i, IDX["right_shoulder"], 1] if valid_mask[i, IDX["right_shoulder"]] else None

        # 判定逻辑
        knee_bent = False
        arms_up = False
        legs_wide = False
        jumping = False

        # 膝盖弯曲检测（髋-膝-踝，膝角 < 140°）
        if all(v is not None for v in [hip_left_y, knee_left_y, ankle_left_y]):
            a = kpts_all[i, IDX["left_hip"], :2]
            b = kpts_all[i, IDX["left_knee"], :2]
            c = kpts_all[i, IDX["left_ankle"], :2]
            angle = _angle_between(a, b, c)
            if angle < 140:
                knee_bent = True

        if not knee_bent and all(v is not None for v in [hip_right_y, knee_right_y, ankle_right_y]):
            a = kpts_all[i, IDX["right_hip"], :2]
            b = kpts_all[i, IDX["right_knee"], :2]
            c = kpts_all[i, IDX["right_ankle"], :2]
            angle = _angle_between(a, b, c)
            if angle < 140:
                knee_bent = True

        # 手臂上举（手腕高于肩膀）
        if wrist_left_y is not None and shoulder_left_y is not None:
            if wrist_left_y < shoulder_left_y:
                arms_up = True
        if wrist_right_y is not None and shoulder_right_y is not None:
            if wrist_right_y < shoulder_right_y:
                arms_up = True

        # 跨步宽站（脚踝间距 > 平均髋宽）
        if ankle_left_y is not None and ankle_right_y is not None:
            ankle_dist = abs(kpts_all[i, IDX["left_ankle"], 0] - kpts_all[i, IDX["right_ankle"], 0])
            if ankle_dist > 80:  # 320px 推理分辨率下 80px ≈ 宽站姿
                legs_wide = True

        # 疑似起跳（双踝 Y 坐标高于髋部）
        if all(v is not None for v in [ankle_left_y, ankle_right_y, hip_left_y, hip_right_y]):
            ankle_avg_y = (ankle_left_y + ankle_right_y) / 2
            hip_avg_y = (hip_left_y + hip_right_y) / 2
            if ankle_avg_y < hip_avg_y - 10:  # 脚踝明显高于髋部
                jumping = True

        # 分类
        if jumping:
            categories["疑似起跳"] += 1
        elif arms_up and knee_bent:
            categories["蹲防姿态"] += 1
        elif arms_up:
            categories["手臂上举"] += 1
        elif knee_bent and legs_wide:
            categories["蹲防姿态"] += 1
        elif legs_wide:
            categories["跨步宽站"] += 1
        elif knee_bent:
            categories["蹲防姿态"] += 1
        elif arms_up:
            categories["手臂上举"] += 1
        else:
            categories["站立直立"] += 1

    # 转百分比
    result = {}
    for cat, count in categories.items():
        if count > 0:
            result[cat] = {
                "count": count,
                "percentage": round(count / n_frames * 100, 1),
            }

    return result


def _compute_smoothness(com_frames: np.ndarray) -> dict:
    """计算运动流畅度（基于重心位移的自相关）。"""
    if len(com_frames) < 10:
        return {"score": 0, "label": "数据不足"}

    diffs = np.linalg.norm(np.diff(com_frames, axis=0), axis=1)
    if len(diffs) < 5:
        return {"score": 0, "label": "数据不足"}

    # 变异系数 (CV = std/mean): 越低越流畅
    mean_speed = float(np.mean(diffs))
    std_speed = float(np.std(diffs))
    cv = std_speed / (mean_speed + 1e-8)

    # 归一化到 0-100 分数
    score = max(0, min(100, 100 - cv * 100))

    if score >= 75:
        label = f"流畅 ({score:.0f}/100，速度变化均匀)"
    elif score >= 50:
        label = f"一般 ({score:.0f}/100，存在间歇性停顿)"
    elif score >= 25:
        label = f"较卡顿 ({score:.0f}/100，运动不连贯)"
    else:
        label = f"非常卡顿 ({score:.0f}/100，可能有大量静止/遮挡)"

    return {"score": round(score, 1), "label": label}


def _empty_summary() -> dict:
    """返回空的统计摘要。"""
    return {
        "movement": {},
        "symmetry": {},
        "angles": {},
        "pose_distribution": {},
        "temporal": {"data_sufficient": False},
        "smoothness": {"score": 0, "label": "无数据"},
        "formatted": {
            "movement": "无有效数据",
            "symmetry": "无有效数据",
            "angles": "无有效数据",
            "pose_distribution": "无有效数据",
            "smoothness": "无有效数据",
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# 格式化（将结构化数据转为 LLM 友好文本）
# ══════════════════════════════════════════════════════════════════════════════

def _format_stats(movement, symmetry, angles, pose_dist, smoothness) -> dict:
    """将各模块统计结果格式化为人类可读的文本。"""
    # 运动
    if movement:
        mov = (
            f"总位移 {movement['total_displacement_px']} px | "
            f"平均速度 {movement['avg_speed_px_per_frame']:.3f} px/帧 | "
            f"峰值速度 {movement['peak_speed_px_per_frame']:.3f} px/帧 | "
            f"垂直活动范围 {movement['vertical_range_px']} px | "
            f"方向偏好: {movement['direction_bias']}"
        )
    else:
        mov = "无有效运动数据"

    # 对称性
    sym_parts = []
    for key, val in symmetry.items():
        if key == "综合对称性":
            continue
        if isinstance(val, dict):
            score_str = f"{val['score']}/100" if val.get("score", "N/A") != "N/A" else "N/A"
            part = f"{key}: 高度差 {val['avg_height_diff_px']}px ({score_str})"
            if val.get("note"):
                part += f" [{val['note']}]"
            sym_parts.append(part)
    overall = symmetry.get("综合对称性", "N/A")
    sym = " | ".join(sym_parts) if sym_parts else "无有效对称性数据"
    sym += f"\n综合对称性评分: {overall}/100"

    # 角度
    angle_parts = []
    for name, val in angles.items():
        if isinstance(val, dict) and val.get("avg_angle_deg", 0) > 0:
            angle_parts.append(
                f"{name}: 平均 {val['avg_angle_deg']}° "
                f"(范围 {val.get('min_angle_deg', '?')}–{val.get('max_angle_deg', '?')}°"
                + (f", {val['note']}" if val.get("note") else "")
                + ")"
            )
        elif isinstance(val, dict) and val.get("note"):
            angle_parts.append(f"{name}: {val['note']}")
    ang = "\n".join(angle_parts) if angle_parts else "无有效角度数据"

    # 姿态分布
    pose_parts = []
    for cat, info in pose_dist.items():
        pose_parts.append(f"{cat}: {info['percentage']}% ({info['count']} 帧)")
    pose = "\n".join(pose_parts) if pose_parts else "无有效姿态分类数据"

    # 流畅度
    smooth = smoothness.get("label", "无数据")

    return {
        "movement": mov,
        "symmetry": sym,
        "angles": ang,
        "pose_distribution": pose,
        "smoothness": smooth,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 几何工具函数
# ══════════════════════════════════════════════════════════════════════════════

def _angle_between(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """计算三个点 a-b-c 在 b 处的角度（度）。"""
    ba = a - b
    bc = c - b
    cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    cos_angle = np.clip(cos_angle, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))


def _batch_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> np.ndarray:
    """批量计算角度 a-b-c。a, b, c 均为 [n, 2]。"""
    ba = a - b
    bc = c - b
    dot = np.sum(ba * bc, axis=1)
    norm = np.linalg.norm(ba, axis=1) * np.linalg.norm(bc, axis=1) + 1e-8
    cos_angle = np.clip(dot / norm, -1.0, 1.0)
    return np.degrees(np.arccos(cos_angle))


# ══════════════════════════════════════════════════════════════════════════════
# DeepSeek API 客户端
# ══════════════════════════════════════════════════════════════════════════════

class PlayerAnalyzer:
    """篮球运动员 AI 分析器 —— 封装 DeepSeek API 调用与结果解析。"""

    def __init__(
        self,
        api_key: str = DEEPSEEK_API_KEY,
        base_url: str = DEEPSEEK_BASE_URL,
        model: str = DEEPSEEK_MODEL,
        max_tokens: int = AI_MAX_TOKENS,
        temperature: float = AI_TEMPERATURE,
        timeout: int = AI_TIMEOUT_SECONDS,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    @property
    def is_configured(self) -> bool:
        """检查 API Key 是否已配置。"""
        return bool(self.api_key) and self.api_key != "sk-your-api-key-here"

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(self.timeout))
        return self._client

    async def analyze(
        self,
        user_message: str,
        system_prompt: str = ANALYSIS_SYSTEM_PROMPT,
    ) -> str:
        """调用 DeepSeek Anthropic-兼容 API 进行文本分析。

        Args:
            user_message: 用户消息（包含格式化的运动学统计摘要）
            system_prompt: 系统提示词

        Returns:
            LLM 返回的文本内容

        Raises:
            ValueError: API Key 未配置
            httpx.TimeoutException: 请求超时
            httpx.HTTPStatusError: HTTP 错误
        """
        if not self.is_configured:
            raise ValueError("DeepSeek API Key 未配置，请在 config.py 中设置 DEEPSEEK_API_KEY")

        url = f"{self.base_url}/v1/messages"

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

        payload = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_message},
            ],
        }

        client = await self._get_client()
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()

        data = response.json()

        # Anthropic Messages 格式: content 是列表
        content = data.get("content", [])
        if isinstance(content, list) and len(content) > 0:
            return content[0].get("text", "")
        elif isinstance(content, str):
            return content
        return ""

    async def close(self):
        """关闭 HTTP 客户端。"""
        if self._client is not None:
            await self._client.aclose()
            self._client = None


# ══════════════════════════════════════════════════════════════════════════════
# 响应解析
# ══════════════════════════════════════════════════════════════════════════════

def parse_analysis_response(raw_text: str) -> dict:
    """解析 LLM 返回的 Markdown 格式分析结果。

    预期格式（## 标题分段）:
        ## 优势 (Strengths)
        ## 短板 (Weaknesses)
        ## 总体评价 (Summary)
        ## 改进建议 (Recommendations)
        ## 补充观察建议 (Additional Angles Needed)

    回退: 如果解析失败，整段文本放在 summary 中。
    """
    result: dict[str, Any] = {
        "strengths": [],
        "weaknesses": [],
        "summary": "",
        "recommendations": [],
        "additional_angles": [],
        "raw_response": raw_text,
    }

    # 按 ## 标题分割
    sections = re.split(r"\n##\s+", raw_text)

    for section in sections:
        section = section.strip()
        lower = section.lower()

        if "优势" in section or "strength" in lower:
            result["strengths"] = _extract_bullets(section)
        elif "短板" in section or "weakness" in lower:
            result["weaknesses"] = _extract_bullets(section)
        elif "总体评价" in section or "summary" in lower:
            result["summary"] = _extract_body(section)
        elif "改进建议" in section or "recommend" in lower:
            result["recommendations"] = _extract_bullets(section)
        elif "补充观察" in section or "additional" in lower or "angle" in lower:
            result["additional_angles"] = _extract_bullets(section)

    # 回退：如果什么都没解析出来
    if not any([result["strengths"], result["weaknesses"], result["summary"],
                result["recommendations"], result["additional_angles"]]):
        result["summary"] = raw_text

    return result


def _extract_bullets(text: str) -> list[str]:
    """提取列表项（支持 -, *, 1., 1、等格式）。"""
    # 去掉标题行
    lines = text.strip().split("\n", 1)
    body = lines[1] if len(lines) > 1 else lines[0]

    # 匹配各种 bullet 格式
    bullets = re.findall(r"(?:^|\n)\s*[-*\d]+[\.、)\s]\s*(.+?)(?=\n\s*[-*\d]+[\.、)\s]|\n##|\n\n|$)", body, re.DOTALL)
    if not bullets:
        # 更宽松的匹配
        bullets = re.findall(r"(?:^|\n)\s*[-*]\s+(.+?)(?=\n\s*[-*]|\n##|\n\n|$)", body, re.DOTALL)

    return [b.strip() for b in bullets if b.strip() and len(b.strip()) > 3]


def _extract_body(text: str) -> str:
    """提取标题后的正文。"""
    lines = text.strip().split("\n", 1)
    if len(lines) > 1:
        return lines[1].strip()
    return lines[0].strip()


# ══════════════════════════════════════════════════════════════════════════════
# 顶层分析接口（供 app.py 调用）
# ══════════════════════════════════════════════════════════════════════════════

def build_analysis_prompt(
    player_data: dict,
    fps: float,
    total_frames: int,
) -> str:
    """构建完整的分析 prompt（不含 system prompt）。

    Args:
        player_data: 单个球员数据 dict
        fps: 视频帧率
        total_frames: 视频总帧数

    Returns:
        格式化的用户消息字符串
    """
    summary = compute_kinematic_summary(player_data, fps, total_frames)
    temporal = summary["temporal"]
    fmt = summary["formatted"]

    # 判断数据是否不足，生成提示
    n_frames = temporal["total_frames_visible"]
    avg_conf = temporal["avg_keypoint_confidence"]
    data_ok = temporal["data_sufficient"]
    com_frames_valid = summary["movement"].get("total_displacement_px", 0) > 0

    if not data_ok or avg_conf < 0.3:
        data_note = (
            "> ⚠️ **注意：当前数据量较少或关键点置信度偏低，部分分析维度可能不准确。**\n"
            "> 请在分析中诚实指出数据不足的方面，并在「补充观察建议」中详细列出需要补充的拍摄角度/数据。\n"
        )
    elif not com_frames_valid:
        data_note = (
            "> ⚠️ **注意：髋部关键点数据缺失，无法计算运动轨迹，移动分析将不准确。**\n"
            "> 请在「补充观察建议」中指出需要能看清全身（尤其是髋部）的拍摄角度。\n"
        )
    else:
        data_note = ""

    return ANALYSIS_USER_PROMPT_TEMPLATE.format(
        total_frames_visible=temporal["total_frames_visible"],
        total_frames=total_frames,
        visibility_pct=round(n_frames / max(total_frames, 1) * 100, 1),
        duration_seconds=temporal["duration_seconds"],
        avg_confidence=avg_conf,
        movement_stats=fmt["movement"],
        symmetry_stats=fmt["symmetry"],
        angle_stats=fmt["angles"],
        pose_distribution=fmt["pose_distribution"],
        smoothness=fmt["smoothness"],
        data_insufficient_section=data_note,
    )

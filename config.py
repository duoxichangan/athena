"""
Athena — 运动员姿态识别平台 配置文件
"""

import os
from pathlib import Path

# ---- Paths ----
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"

# ---- Model ----
MODEL_NAME = "yolo26n-pose.pt"  # 首次运行时自动下载
CONF_THRESHOLD = 0.5             # 关键点置信度阈值
IOU_THRESHOLD = 0.7              # NMS IOU 阈值
IMGSZ = 320                      # 推理分辨率（320=最快速度）
FRAME_SKIP = 3                   # 跳帧数（3=每3帧处理一次，3x 提速）

# ---- Tracking ----
TRACKER_CONFIG = "bytetrack.yaml"   # 跟踪器配置: bytetrack / botsort / ocsort
TRACK_CONF_THRESHOLD = 0.4          # 跟踪置信度（提高以减少误检）
MIN_VISIBILITY_PCT = 5.0            # 球员最少可见帧占比 (%)，低于此值的 track 视为噪声丢弃
MIN_BBOX_AREA = 1000                # 最小 bbox 面积 (px²)，过滤远处小人头

# ---- Video ----
SUPPORTED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
MAX_UPLOAD_SIZE_MB = 200         # 最大上传文件大小 (MB)
OUTPUT_FPS = 30                  # 输出视频帧率（0 表示保持原视频帧率）
PLAYER_CLIP_CODEC = "avc1"       # 浏览器兼容 H.264 编码；若不可用则回退 webm

# ---- Skeleton Drawing ----
# 每个人的骨架颜色列表（按 track_id 取模，同一个人颜色跨帧一致）
PERSON_COLORS = [
    (0, 255, 0),      # 绿色
    (255, 0, 0),      # 蓝色
    (0, 0, 255),      # 红色
    (255, 255, 0),    # 青色
    (255, 0, 255),    # 品红
    (0, 255, 255),    # 黄色
    (128, 255, 0),    # 浅绿
    (255, 128, 0),    # 橙色
    (0, 128, 255),    # 天蓝
    (128, 0, 255),    # 紫色
    (255, 255, 128),  # 淡黄
    (255, 128, 128),  # 浅红
    (128, 255, 128),  # 薄荷绿
    (128, 128, 255),  # 淡蓝
    (255, 128, 255),  # 粉红
    (128, 255, 255),  # 浅青
    (192, 192, 255),  # 薰衣草
    (255, 192, 128),  # 桃色
    (128, 255, 192),  # 青绿
    (192, 128, 255),  # 淡紫
]

KEYPOINT_RADIUS = 5
SKELETON_LINE_WIDTH = 2
KEYPOINT_CONF_ALPHA = True      # 低置信度关键点半透明显示
ID_LABEL_FONT_SCALE = 0.7       # track_id 标签字体大小

# ---- COCO 17 关键点骨架连接定义 ----
# 每个 tuple 是一对关键点索引 (从0开始)
SKELETON_EDGES = [
    # 面部
    (0, 1),   # nose → left_eye
    (0, 2),   # nose → right_eye
    (1, 3),   # left_eye → left_ear
    (2, 4),   # right_eye → right_ear
    # 上半身
    (5, 6),   # left_shoulder → right_shoulder
    (5, 7),   # left_shoulder → left_elbow
    (6, 8),   # right_shoulder → right_elbow
    (7, 9),   # left_elbow → left_wrist
    (8, 10),  # right_elbow → right_wrist
    (5, 11),  # left_shoulder → left_hip
    (6, 12),  # right_shoulder → right_hip
    # 下半身
    (11, 12), # left_hip → right_hip
    (11, 13), # left_hip → left_knee
    (12, 14), # right_hip → right_knee
    (13, 15), # left_knee → left_ankle
    (14, 16), # right_knee → right_ankle
]

# 关键点名称（COCO 格式，17 个）
KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

# 关键点按部位分组（用于颜色区分）
KEYPOINT_GROUPS = {
    "head": [0, 1, 2, 3, 4],
    "torso": [5, 6, 11, 12],
    "left_arm": [7, 9],
    "right_arm": [8, 10],
    "left_leg": [13, 15],
    "right_leg": [14, 16],
}

GROUP_COLORS = {
    "head": (255, 255, 255),       # 白色
    "torso": (0, 255, 255),        # 黄色
    "left_arm": (255, 0, 0),       # 蓝色
    "right_arm": (0, 255, 0),      # 绿色
    "left_leg": (255, 0, 255),     # 品红
    "right_leg": (0, 255, 255),    # 黄色
}

# ══════════════════════════════════════════════════════════════════════════════
# AI / LLM — DeepSeek Anthropic-兼容 API 配置
# ══════════════════════════════════════════════════════════════════════════════

# ⚠️ 重要：请在此处填入你的 DeepSeek API Key
#    优先使用环境变量 DEEPSEEK_API_KEY，若未设置则使用下方的默认值
#    注意不要将包含真实 API Key 的 config.py 提交到 git
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/anthropic")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
AI_MAX_TOKENS = int(os.getenv("DEEPSEEK_MAX_TOKENS", "2048"))
AI_TEMPERATURE = float(os.getenv("DEEPSEEK_TEMPERATURE", "0.7"))
AI_TIMEOUT_SECONDS = int(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "90"))
AI_MIN_FRAMES_FOR_ANALYSIS = 10  # 球员最少可见帧数，低于此值不分析

# ---- LLM Prompt 模板 ----

ANALYSIS_SYSTEM_PROMPT = """你是一位经验丰富的职业篮球教练兼运动生物力学专家，有 20 年执教经验。
你擅长通过运动员的姿态数据（人体关键点运动轨迹的统计摘要）分析球员的技术特点和不足之处。

你的分析风格：严厉、中肯、一针见血。不说客套话，不泛泛而谈。
看到问题就直接指出来，看到优点就明确肯定。每个判断都要基于数据说话。

你将收到一名篮球球员的结构化姿态统计数据，包括：
- 运动轨迹（位移量、速度、方向偏好）
- 姿态对称性（左右肩/髋/膝/腕高度差）
- 身体角度（膝关节角度、肘关节角度、躯干倾斜角）
- 姿态分布（站立、蹲防、起跳、手臂上举等时间占比）
- 运动流畅度
- 可见帧数与平均关键点置信度

**重要**：数据不足不等于视频短。即使是长视频，如果关键帧缺失、关键点置信度低、拍摄角度不好，也可能导致某些维度数据不足。遇到数据不足的情况，不要在分析中强行下结论，而要在"补充观察建议"一栏中明确指出缺少什么视角/数据，以及为什么需要它们。"""

ANALYSIS_USER_PROMPT_TEMPLATE = """请分析以下篮球球员的姿态数据，给出技术优缺点分析。

## 球员基本信息
- 可见帧数：{total_frames_visible} / {total_frames}（可见率 {visibility_pct}%）
- 时长：约 {duration_seconds:.1f} 秒
- 平均关键点置信度：{avg_confidence:.2f}

## 运动数据
{movement_stats}

## 姿态对称性
{symmetry_stats}

## 身体角度
{angle_stats}

## 姿态分布
{pose_distribution}

## 运动流畅度
{smoothness}

---

{data_insufficient_section}

请按照以下格式输出（用中文），严格遵循 Markdown 格式：

## 优势 (Strengths)
- [基于数据列出 3-5 条具体的技术优势；如果数据不足以判断，写明"数据不足，无法确定"]

## 短板 (Weaknesses)
- [基于数据列出 3-5 条具体的问题和短板，直接指出，不要委婉；如果数据不足以判断，写明"数据不足，无法确定"]

## 总体评价 (Summary)
[2-3 句话的总评，概括该球员的核心特点和定位；数据不足时诚实说明]

## 改进建议 (Recommendations)
- [2-3 条可操作的、针对短板的训练建议]

## 补充观察建议 (Additional Angles Needed)
- [如果当前数据不足以做出完整评估，请列出需要补充的观察角度，例如：需要正面视角来判断投篮手型、需要侧身视角来看防守滑步、需要全场镜头来看无球跑位等。即使是长视频，如果关键帧缺失或置信度低导致某些维度无法分析，也要明确指出缺少什么视角/数据。如果数据充分，此栏写"当前数据基本充分"]"""

"""
Athena — 视频姿态处理引擎 v0.3
使用 YOLO Pose + Tracking 逐帧检测、跟踪人体，每人独立数据提取 + 裁剪视频。
"""

# 每人裁剪视频输出尺寸
PLAYER_CLIP_SIZE = 320
# bbox 指数移动平均平滑系数（0~1，越大越平滑）
BBOX_SMOOTH_ALPHA = 0.7

import json
import time
from collections import defaultdict
from pathlib import Path

import cv2


def _get_video_writer(path: str, fps: float, size: tuple[int, int]):
    """创建 VideoWriter，依次尝试浏览器兼容编码格式。

    Returns:
        (writer, actual_path) 或 (None, None)
    """
    # 优先级：WebM/VP80 (浏览器原生支持) > H.264 > XVID > mp4v
    candidates = [
        ("avc1", ".mp4"),
        ("mp4v", ".mp4"),
        ("XVID", ".avi"),
    ]

    for codec_str, ext in candidates:
        out_path = Path(path).with_suffix(ext)
        fourcc = cv2.VideoWriter_fourcc(*codec_str)
        writer = cv2.VideoWriter(str(out_path), fourcc, fps, size)
        if writer.isOpened():
            return writer, str(out_path)
    return None, None
import numpy as np
from ultralytics import YOLO

from config import (
    CONF_THRESHOLD,
    FRAME_SKIP,
    GROUP_COLORS,
    ID_LABEL_FONT_SCALE,
    IMGSZ,
    IOU_THRESHOLD,
    KEYPOINT_CONF_ALPHA,
    KEYPOINT_GROUPS,
    KEYPOINT_NAMES,
    KEYPOINT_RADIUS,
    MIN_BBOX_AREA,
    MIN_VISIBILITY_PCT,
    MODEL_NAME,
    PERSON_COLORS,
    PLAYER_CLIP_CODEC,
    SKELETON_EDGES,
    SKELETON_LINE_WIDTH,
    TRACK_CONF_THRESHOLD,
    TRACKER_CONFIG,
)


class VideoProcessor:
    """视频姿态处理器 —— 跟踪每人 + 提取独立姿态序列 + 输出结构化 JSON。"""

    def __init__(
        self,
        model_name: str = MODEL_NAME,
        conf_threshold: float = CONF_THRESHOLD,
        tracker_config: str = TRACKER_CONFIG,
    ):
        self.conf_threshold = conf_threshold
        self.tracker_config = tracker_config
        self._last_results = None  # 用于跳帧时复用上一次推理结果
        print(f"[Athena] Loading pose model: {model_name} ...")
        self.model = YOLO(model_name)
        print(f"[Athena] Model loaded. Tracker: {tracker_config}  imgsz={IMGSZ}  frame_skip={FRAME_SKIP}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process(
        self,
        video_path: str | Path,
        output_path: str | Path | None = None,
    ) -> dict:
        """处理视频：跟踪每人、绘制骨架、导出每人姿态数据。

        Returns:
            dict 包含 output_path, data_path, stats 等字段，供前端展示。
        """
        video_path = Path(video_path)
        if output_path is None:
            from config import OUTPUT_DIR

            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            output_path = OUTPUT_DIR / f"{video_path.stem}_pose{video_path.suffix}"
        else:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        orig_fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        from config import OUTPUT_FPS

        out_fps = OUTPUT_FPS if OUTPUT_FPS > 0 else orig_fps
        if out_fps <= 0:
            out_fps = 30.0

        # 浏览器兼容编码：优先 avc1 (H.264)，不可用则回退 mp4v
        main_codec = cv2.VideoWriter_fourcc(*PLAYER_CLIP_CODEC)
        writer = cv2.VideoWriter(str(output_path), main_codec, out_fps, (width, height))
        if not writer.isOpened():
            writer = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*"mp4v"), out_fps, (width, height))
            print("[Athena] avc1 not available, fallback to mp4v for main video")

        # 每人数据收集：{track_id: [{"frame": int, "kpts": [...], "bbox": [...]}, ...]}
        player_frames: dict[int, list[dict]] = defaultdict(list)
        # 每人裁剪视频 writer + bbox 平滑
        player_writers: dict[int, cv2.VideoWriter] = {}
        player_bbox_smooth: dict[int, np.ndarray] = {}
        player_first_frame: dict[int, np.ndarray | None] = {}  # 每人一帧代表性姿态（给前端画骨架）
        player_clips: dict[int, str] = {}

        # 任务专属输出子目录
        task_output_dir = output_path.parent / output_path.stem.replace("_pose", "")
        task_output_dir.mkdir(parents=True, exist_ok=True)

        processed = 0
        all_track_ids_seen: set[int] = set()
        t_start = time.time()

        print(f"[Athena] Tracking: {video_path.name}  ({width}x{height}, {total_frames} frames)")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # ── YOLO Pose + Tracking ────────────────────────────
            # 跳帧：只对每 FRAME_SKIP 帧做推理，其余帧复用上一次结果
            if processed % FRAME_SKIP == 0:
                results = self.model.track(
                    frame,
                    persist=True,
                    conf=TRACK_CONF_THRESHOLD,
                    iou=IOU_THRESHOLD,
                    imgsz=IMGSZ,                   # 降低分辨率提速
                    tracker=self.tracker_config,
                    verbose=False,
                )
                self._last_results = results
            else:
                results = self._last_results

            if results and results[0].boxes is not None and results[0].boxes.is_track:
                boxes = results[0].boxes
                keypoints = results[0].keypoints

                if keypoints is not None and boxes.id is not None:
                    kpts_data = keypoints.data  # tensor [N, 17, 3]
                    track_ids = boxes.id        # tensor [N]  int

                    num_people = min(len(track_ids), kpts_data.shape[0])

                    for i in range(num_people):
                        tid = int(track_ids[i].item())
                        all_track_ids_seen.add(tid)

                        kpt_array = kpts_data[i].cpu().numpy()  # [17, 3]
                        if not self._has_any_valid_kpt(kpt_array):
                            continue

                        # ── 绘制 ─────────────────────────────
                        color = PERSON_COLORS[tid % len(PERSON_COLORS)]
                        self._draw_skeleton(frame, kpt_array, color)
                        self._draw_keypoints(frame, kpt_array, color)
                        self._draw_id_label(frame, kpt_array, tid, color)

                        # ── 收集数据 ─────────────────────────
                        bbox = boxes.xyxy[i].cpu().numpy()  # [x1,y1,x2,y2]
                        player_frames[tid].append({
                            "frame": processed,
                            "kpts": kpt_array.tolist(),
                            "bbox": bbox.tolist(),
                        })

                        # ── 每人裁剪视频 ────────────────────
                        # 过滤面积过小的 bbox（远处噪声）
                        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
                        bbox_area = bw * bh
                        if bbox_area < MIN_BBOX_AREA:
                            continue

                        # bbox 指数移动平均平滑
                        if tid in player_bbox_smooth:
                            player_bbox_smooth[tid] = (
                                BBOX_SMOOTH_ALPHA * player_bbox_smooth[tid]
                                + (1 - BBOX_SMOOTH_ALPHA) * bbox
                            )
                        else:
                            player_bbox_smooth[tid] = bbox

                        smoothed_bbox = player_bbox_smooth[tid]

                        # 确保 writer 存在（延迟创建，使用兼容编码）
                        if tid not in player_writers:
                            clip_path = task_output_dir / f"player_{tid}.mp4"
                            pw, actual_path = _get_video_writer(
                                str(clip_path), out_fps,
                                (PLAYER_CLIP_SIZE, PLAYER_CLIP_SIZE),
                            )
                            if pw is not None:
                                player_writers[tid] = pw
                                player_clips[tid] = actual_path

                        # crop + resize + write
                        if tid in player_writers:
                            player_crop = self._crop_player(frame, smoothed_bbox)
                            player_writers[tid].write(player_crop)

                            # 保存一帧代表性画面（首帧，已 crop 的）
                            if tid not in player_first_frame:
                                player_first_frame[tid] = player_crop.copy()

            writer.write(frame)
            processed += 1

            if processed % 100 == 0:
                pct = processed / max(total_frames, 1) * 100
                print(f"  ... {processed}/{total_frames} frames ({pct:.0f}%)  "
                      f"tracks: {len(all_track_ids_seen)}")

        cap.release()
        writer.release()
        # 关闭所有球员 writer
        for pw in player_writers.values():
            pw.release()
        elapsed = time.time() - t_start

        # ── 过滤噪声 track ──────────────────────────────────
        min_frames = max(1, int(total_frames * MIN_VISIBILITY_PCT / 100))
        valid_ids = {
            tid for tid in all_track_ids_seen
            if len(player_frames.get(tid, [])) >= min_frames
        }
        noise_ids = all_track_ids_seen - valid_ids
        if noise_ids:
            print(f"[Athena] Filtered {len(noise_ids)} noise tracks (threshold: {min_frames} frames)")
            for tid in noise_ids:
                # 删除噪声 track 的裁剪视频文件
                if tid in player_clips:
                    clip_path = Path(player_clips[tid])
                    if clip_path.exists():
                        clip_path.unlink()
                    del player_clips[tid]
                if tid in player_writers:
                    del player_writers[tid]
                if tid in player_first_frame:
                    del player_first_frame[tid]

        # ── 构建 player report JSON ────────────────────────
        report = self._build_player_report(
            player_frames, orig_fps, total_frames, elapsed, valid_ids,
        )

        # 将代表性帧图编码为 base64 嵌入报告中，前端直接用
        import base64
        for tid_str, pinfo in report["players"].items():
            tid = int(tid_str)
            if tid in player_first_frame and player_first_frame[tid] is not None:
                crop_img = player_first_frame[tid]
                _, buf = cv2.imencode(".jpg", crop_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                pinfo["thumbnail_base64"] = base64.b64encode(buf).decode()

        data_path = output_path.with_suffix("").with_suffix("")
        data_path = Path(str(data_path) + "_pose_data.json")
        data_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

        unique_players = len(valid_ids)

        print(
            f"[Athena] Done! {processed}/{total_frames} frames in {elapsed:.1f}s  "
            f"({unique_players} players tracked, {len(noise_ids)} noise filtered)"
        )
        print(f"[Athena] Data saved: {data_path}")
        for tid in sorted(player_clips):
            print(f"[Athena]   Player {tid} clip: {player_clips[tid]}")

        return {
            "output_path": str(output_path),
            "data_path": str(data_path),
            "player_clips": player_clips,
            "total_frames": total_frames,
            "processed_frames": processed,
            "duration_seconds": round(elapsed, 1),
            "fps": out_fps,
            "unique_players": unique_players,
            "all_track_ids": sorted(valid_ids),
        }

    # ------------------------------------------------------------------
    # Report builder
    # ------------------------------------------------------------------

    def _build_player_report(
        self,
        player_frames: dict[int, list[dict]],
        fps: float,
        total_frames: int,
        elapsed: float,
        all_ids: set[int],
    ) -> dict:
        """将逐帧收集的数据整理为结构化报告，供 LLM 消费。"""
        players = {}
        for tid, frames in player_frames.items():
            if tid not in all_ids:   # 只保留通过噪声过滤的 track
                continue
            frame_indices = [f["frame"] for f in frames]
            # 平均 bbox
            bboxes = np.array([f["bbox"] for f in frames])
            avg_bbox = bboxes.mean(axis=0).tolist()

            players[str(tid)] = {
                "track_id": tid,
                "first_seen_frame": min(frame_indices),
                "last_seen_frame": max(frame_indices),
                "total_frames_visible": len(frames),
                "visibility_pct": round(len(frames) / max(total_frames, 1) * 100, 1),
                "avg_bbox": avg_bbox,
                "frames": frames,
            }

        return {
            "meta": {
                "model": MODEL_NAME,
                "tracker": self.tracker_config,
                "keypoint_names": KEYPOINT_NAMES,
                "fps": fps,
                "total_frames": total_frames,
                "processing_time_s": round(elapsed, 1),
            },
            "players": players,
        }

    # ------------------------------------------------------------------
    # Crop helper
    # ------------------------------------------------------------------

    def _crop_player(self, frame: np.ndarray, bbox: np.ndarray, pad_ratio: float = 0.2) -> np.ndarray:
        """从原帧中裁剪出单个球员区域，padding 后 resize 到固定尺寸。

        Args:
            frame: 原始帧 (H, W, 3)
            bbox: [x1, y1, x2, y2] 平滑后的边界框
            pad_ratio: 向外扩展比例

        Returns:
            (PLAYER_CLIP_SIZE, PLAYER_CLIP_SIZE, 3) 裁剪图
        """
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = bbox

        # 扩展 padding
        bw, bh = x2 - x1, y2 - y1
        pad_w, pad_h = bw * pad_ratio, bh * pad_ratio
        x1 = max(0, int(x1 - pad_w))
        y1 = max(0, int(y1 - pad_h))
        x2 = min(w, int(x2 + pad_w))
        y2 = min(h, int(y2 + pad_h))

        # 确保区域非零
        if x2 <= x1 or y2 <= y1:
            return np.zeros((PLAYER_CLIP_SIZE, PLAYER_CLIP_SIZE, 3), dtype=np.uint8)

        crop = frame[y1:y2, x1:x2]

        # 保持宽高比，填充到正方形后 resize
        crop_h, crop_w = crop.shape[:2]
        side = max(crop_w, crop_h)
        square = np.zeros((side, side, 3), dtype=np.uint8)
        y_off = (side - crop_h) // 2
        x_off = (side - crop_w) // 2
        square[y_off:y_off + crop_h, x_off:x_off + crop_w] = crop

        return cv2.resize(square, (PLAYER_CLIP_SIZE, PLAYER_CLIP_SIZE))

    # ------------------------------------------------------------------
    # Drawing helpers
    # ------------------------------------------------------------------

    def _clamp_xy(self, frame: np.ndarray, x: float, y: float) -> tuple[int, int]:
        """Clamp 坐标到帧的有效像素范围内，避免 numpy 索引越界。"""
        h, w = frame.shape[:2]
        return (min(max(int(x), 0), w - 1), min(max(int(y), 0), h - 1))

    def _has_any_valid_kpt(self, kpts: np.ndarray) -> bool:
        """检查是否至少有一个关键点置信度超过阈值。"""
        return np.any(kpts[:, 2] > self.conf_threshold)

    def _draw_skeleton(self, frame: np.ndarray, kpts: np.ndarray, color: tuple[int, int, int]) -> None:
        """绘制骨架连线。"""
        for i, j in SKELETON_EDGES:
            if kpts[i, 2] > self.conf_threshold and kpts[j, 2] > self.conf_threshold:
                pt1 = self._clamp_xy(frame, kpts[i, 0], kpts[i, 1])
                pt2 = self._clamp_xy(frame, kpts[j, 0], kpts[j, 1])
                cv2.line(frame, pt1, pt2, color, SKELETON_LINE_WIDTH, cv2.LINE_AA)

    def _draw_keypoints(self, frame: np.ndarray, kpts: np.ndarray, person_color: tuple[int, int, int]) -> None:
        """绘制关键点圆点，不同部位用不同颜色。"""
        for group_name, indices in KEYPOINT_GROUPS.items():
            group_color = GROUP_COLORS.get(group_name, person_color)
            for idx in indices:
                conf = kpts[idx, 2]
                if conf > self.conf_threshold:
                    x, y = self._clamp_xy(frame, kpts[idx, 0], kpts[idx, 1])

                    if KEYPOINT_CONF_ALPHA:
                        alpha = conf
                        color = self._blend_color(group_color, frame[y, x], alpha)
                    else:
                        color = group_color

                    cv2.circle(frame, (x, y), KEYPOINT_RADIUS, color, -1, cv2.LINE_AA)
                    cv2.circle(frame, (x, y), KEYPOINT_RADIUS, (255, 255, 255), 1, cv2.LINE_AA)

    def _draw_id_label(
        self, frame: np.ndarray, kpts: np.ndarray, track_id: int, color: tuple[int, int, int]
    ) -> None:
        """在人物头顶绘制 track_id 标签。"""
        # 用鼻子关键点位置作为标签锚点
        nose_conf = kpts[0, 2]
        if nose_conf > self.conf_threshold:
            x, y = self._clamp_xy(frame, kpts[0, 0], kpts[0, 1])
            label_y = max(y - 15, 15)  # 头顶上方
        else:
            # 鼻子不可见时，用所有可见关键点的最高点
            valid = kpts[:, 2] > self.conf_threshold
            if not np.any(valid):
                return
            top_kpt = kpts[valid][np.argmin(kpts[valid][:, 1])]
            x, y = self._clamp_xy(frame, top_kpt[0], top_kpt[1])
            label_y = max(y - 15, 15)

        label = f"ID:{track_id}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, ID_LABEL_FONT_SCALE, 2)

        # 半透明背景
        x1, y1 = x - tw // 2 - 4, label_y - th - 2
        x2, y2 = x + tw // 2 + 4, label_y + 2
        x1, y1 = max(x1, 0), max(y1, 0)
        x2, y2 = min(x2, frame.shape[1] - 1), min(y2, frame.shape[0] - 1)

        sub = frame[y1:y2, x1:x2].astype(np.float32)
        overlay = np.zeros_like(sub)
        overlay[:] = color[::-1]  # BGR
        blended = (sub * 0.4 + overlay * 0.6).astype(np.uint8)
        frame[y1:y2, x1:x2] = blended

        # 文字
        cv2.putText(
            frame, label, (x - tw // 2, label_y),
            cv2.FONT_HERSHEY_SIMPLEX, ID_LABEL_FONT_SCALE, (255, 255, 255), 2, cv2.LINE_AA,
        )

    @staticmethod
    def _blend_color(fg: tuple[int, int, int], bg: np.ndarray, alpha: float) -> tuple[int, int, int]:
        """Alpha 混合前景颜色与背景像素。"""
        bg = bg.astype(np.float32)
        return tuple(int(fg[i] * alpha + bg[i] * (1 - alpha)) for i in range(3))

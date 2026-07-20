"""Single-frame pose tracking used by live browser sessions."""

from __future__ import annotations

from typing import Any

import numpy as np

from config import (
    IMGSZ,
    IOU_THRESHOLD,
    MODEL_NAME,
    TRACK_CONF_THRESHOLD,
    TRACKER_CONFIG,
)


def bbox_bottom_center(
    bbox: list[float] | tuple[float, ...] | np.ndarray,
    width: int,
    height: int,
) -> tuple[float, float]:
    """Return the clamped normalized ground point for an xyxy bounding box."""
    x1, _, x2, y2 = bbox
    x = (float(x1) + float(x2)) / 2 / max(width, 1)
    y = float(y2) / max(height, 1)
    return max(0.0, min(1.0, x)), max(0.0, min(1.0, y))


class LiveFrameProcessor:
    """Maintain isolated YOLO tracking state for one live camera session."""

    def __init__(self, model_name: str = MODEL_NAME):
        from ultralytics import YOLO

        self.model = YOLO(model_name)

    def process(self, frame: np.ndarray) -> list[dict[str, Any]]:
        height, width = frame.shape[:2]
        results = self.model.track(
            frame,
            persist=True,
            conf=TRACK_CONF_THRESHOLD,
            iou=IOU_THRESHOLD,
            imgsz=IMGSZ,
            tracker=TRACKER_CONFIG,
            verbose=False,
        )

        if not results:
            return []
        boxes = results[0].boxes
        if boxes is None or boxes.id is None or not boxes.is_track:
            return []

        track_ids = boxes.id.cpu().tolist()
        xyxy = boxes.xyxy.cpu().tolist()
        confidences = boxes.conf.cpu().tolist() if boxes.conf is not None else []
        players = []
        for index, (track_id, bbox) in enumerate(zip(track_ids, xyxy)):
            x, y = bbox_bottom_center(bbox, width, height)
            confidence = float(confidences[index]) if index < len(confidences) else 0.0
            players.append({
                "track_id": int(track_id),
                "x": x,
                "y": y,
                "confidence": confidence,
            })
        return players

"""
Athena — 运动员姿态识别平台 Web 服务 (FastAPI)
"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from analyzer import PlayerAnalyzer, build_analysis_prompt, parse_analysis_response
from config import (
    AI_MIN_FRAMES_FOR_ANALYSIS,
    BASE_DIR,
    MAX_UPLOAD_SIZE_MB,
    OUTPUT_DIR,
    SUPPORTED_EXTENSIONS,
    UPLOAD_DIR,
)
from processor import VideoProcessor

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Athena — 运动员姿态识别平台", version="0.4.0")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# React (Vite) 构建产物目录
DIST_DIR = BASE_DIR / "static" / "dist"
DIST_ASSETS = DIST_DIR / "assets"

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# 全局处理器（模型只加载一次）
processor: VideoProcessor | None = None
# AI 分析器（全局复用 httpx 连接池）
analyzer: PlayerAnalyzer | None = None
# 任务状态存储：{task_id: {"status": "processing"|"done"|"error", "result": {...}}}
tasks: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    global processor, analyzer
    processor = VideoProcessor()
    analyzer = PlayerAnalyzer()
    if analyzer.is_configured:
        print(f"[Athena] AI 分析器已就绪: {analyzer.model}")
    else:
        print("[Athena] ⚠️ DeepSeek API Key 未配置，AI 分析功能不可用。请在 config.py 中设置 DEEPSEEK_API_KEY")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """主页面 —— React (Vite) 构建产物。未构建时给出提示。"""
    dist_index = DIST_DIR / "index.html"
    if dist_index.exists():
        return HTMLResponse(dist_index.read_text(encoding="utf-8"))
    return HTMLResponse(
        "<h1 style='font-family:sans-serif;text-align:center;margin-top:80px'>"
        "前端未构建。请在 <code>frontend/</code> 目录执行：<br>"
        "<code>npm install &amp;&amp; npm run build</code></h1>",
        status_code=503,
    )


# Vite 构建产物（JS/CSS 资源）—— 构建后自动挂载
if DIST_ASSETS.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_ASSETS)), name="assets")


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    """上传视频并启动后台处理任务。

    Returns:
        {"task_id": str, "filename": str, "status": "processing"}
    """
    # 校验扩展名
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        return {
            "error": f"Unsupported format '{ext}'. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
        }

    # 保存上传文件
    task_id = uuid.uuid4().hex[:12]
    safe_name = f"{task_id}_{file.filename}"
    upload_path = UPLOAD_DIR / safe_name

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        return {"error": f"File too large. Max size: {MAX_UPLOAD_SIZE_MB} MB"}

    upload_path.write_bytes(content)

    # 注册任务
    tasks[task_id] = {"status": "processing", "filename": file.filename, "result": None}

    # 后台处理
    asyncio.create_task(_process_video(task_id, upload_path))

    return {"task_id": task_id, "filename": file.filename, "status": "processing"}


@app.get("/status/{task_id}")
async def task_status(task_id: str):
    """查询任务处理状态。

    Returns:
        {"status": "processing"|"done"|"error", "result": {...}}
    """
    task = tasks.get(task_id)
    if task is None:
        return {"error": "Task not found"}
    return task


@app.get("/download/{task_id}")
async def download(task_id: str):
    """下载处理后的视频文件。"""
    task = tasks.get(task_id)
    if task is None or task["status"] != "done":
        return {"error": "Task not ready or not found"}

    output_path = Path(task["result"]["output_path"])
    if not output_path.exists():
        return {"error": "Output file not found on disk"}

    return FileResponse(
        path=str(output_path),
        media_type="video/mp4",
        filename=output_path.name,
    )


@app.get("/data/{task_id}")
async def download_data(task_id: str):
    """下载全部球员姿态数据 JSON 文件（供 LLM 消费）。"""
    task = tasks.get(task_id)
    if task is None or task["status"] != "done":
        return {"error": "Task not ready or not found"}

    data_path = Path(task["result"]["data_path"])
    if not data_path.exists():
        return {"error": "Data file not found on disk"}

    return FileResponse(
        path=str(data_path),
        media_type="application/json",
        filename=data_path.name,
    )


@app.get("/data/{task_id}/{track_id}")
async def download_player_data(task_id: str, track_id: int):
    """下载单个球员的姿态数据 JSON。"""
    import json

    task = tasks.get(task_id)
    if task is None or task["status"] != "done":
        return {"error": "Task not ready or not found"}

    data_path = Path(task["result"]["data_path"])
    if not data_path.exists():
        return {"error": "Data file not found on disk"}

    full = json.loads(data_path.read_text(encoding="utf-8"))
    player = full.get("players", {}).get(str(track_id))
    if player is None:
        return {"error": f"Player {track_id} not found"}

    # 返回单人数据，附带 meta 信息
    result = {"meta": full.get("meta", {}), "player": player}
    return result


@app.get("/player-clip/{task_id}/{track_id}")
async def player_clip(task_id: str, track_id: int):
    """下载/播放单个球员的裁剪视频。"""
    task = tasks.get(task_id)
    if task is None or task["status"] != "done":
        return {"error": "Task not ready or not found"}

    clips = task["result"].get("player_clips", {})
    clip_path = clips.get(track_id)
    if clip_path is None or not Path(clip_path).exists():
        return {"error": f"Clip for player {track_id} not found"}

    clip_path = Path(clip_path)
    # 根据实际扩展名设置正确的 MIME 类型
    ext_map = {".webm": "video/webm", ".mp4": "video/mp4", ".avi": "video/x-msvideo"}
    media_type = ext_map.get(clip_path.suffix, "video/mp4")

    return FileResponse(
        path=str(clip_path),
        media_type=media_type,
        filename=clip_path.name,
    )


# ---------------------------------------------------------------------------
# AI 分析
# ---------------------------------------------------------------------------


@app.post("/analyze/{task_id}/{track_id}")
async def analyze_player(task_id: str, track_id: int, force: bool = False):
    """对指定球员调用 LLM 进行篮球技术分析。

    Query params:
        force: bool = False — 如果为 true，忽略缓存重新分析

    Returns:
        {
            "track_id": int,
            "task_id": str,
            "cached": bool,
            "analysis": {
                "strengths": [...],
                "weaknesses": [...],
                "summary": "...",
                "recommendations": [...],
                "additional_angles": [...],
                "raw_response": "..."
            }
        }
    """
    import json

    # 1. 校验任务状态
    task = tasks.get(task_id)
    if task is None or task["status"] != "done":
        return {"error": "Task not ready or not found"}

    # 2. 检查 AI 是否可用
    if analyzer is None or not analyzer.is_configured:
        return {"error": "AI 分析未配置。请在 config.py 中设置 DEEPSEEK_API_KEY"}

    # 3. 读取姿态数据 JSON
    data_path = Path(task["result"]["data_path"])
    if not data_path.exists():
        return {"error": "Data file not found on disk"}

    full = json.loads(data_path.read_text(encoding="utf-8"))
    player = full.get("players", {}).get(str(track_id))
    if player is None:
        return {"error": f"Player {track_id} not found"}

    # 4. 检查缓存
    task_output_dir = data_path.parent
    cache_path = task_output_dir / f"analysis_{track_id}.json"

    if not force and cache_path.exists():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        return {
            "track_id": track_id,
            "task_id": task_id,
            "cached": True,
            "analysis": cached,
        }

    # 5. 检查最小帧数
    n_frames = len(player.get("frames", []))
    if n_frames < AI_MIN_FRAMES_FOR_ANALYSIS:
        # 帧数不足也允许分析，但让 AI 给出补充观察建议
        pass

    # 6. 构建 prompt
    meta = full.get("meta", {})
    fps = meta.get("fps", 30)
    total_frames = meta.get("total_frames", 0)

    user_prompt = build_analysis_prompt(player, fps, total_frames)

    # 7. 调用 LLM
    try:
        response_text = await analyzer.analyze(user_prompt)
    except Exception as exc:
        return {"error": f"AI 分析失败: {str(exc)}"}

    # 8. 解析响应
    analysis = parse_analysis_response(response_text)

    # 9. 缓存到磁盘
    cache_path.write_text(
        json.dumps(analysis, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return {
        "track_id": track_id,
        "task_id": task_id,
        "cached": False,
        "analysis": analysis,
    }


@app.get("/analyze/{task_id}/{track_id}")
async def get_analysis(task_id: str, track_id: int):
    """获取已缓存的 AI 分析结果。"""
    import json

    task = tasks.get(task_id)
    if task is None or task["status"] != "done":
        return {"error": "Task not ready or not found"}

    data_path = Path(task["result"]["data_path"])
    if not data_path.exists():
        return {"error": "Data file not found on disk"}

    cache_path = data_path.parent / f"analysis_{track_id}.json"
    if not cache_path.exists():
        return {"error": f"No cached analysis for player {track_id}. Use POST to generate one."}

    cached = json.loads(cache_path.read_text(encoding="utf-8"))
    return {
        "track_id": track_id,
        "task_id": task_id,
        "cached": True,
        "analysis": cached,
    }


# ---------------------------------------------------------------------------
# Background processing
# ---------------------------------------------------------------------------


async def _process_video(task_id: str, video_path: Path):
    """在线程池中执行视频处理，完成后更新任务状态。"""
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: processor.process(video_path),
        )
        tasks[task_id]["status"] = "done"
        tasks[task_id]["result"] = result
    except Exception as exc:
        tasks[task_id]["status"] = "error"
        tasks[task_id]["result"] = {"error": str(exc)}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

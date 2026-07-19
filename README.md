# Athena — 运动员姿态识别与篮球技术分析平台

Athena 是一个面向篮球视频的运动员姿态识别 Web 平台。系统使用 YOLO Pose 对上传视频进行人体关键点检测与跟踪，生成带骨架标注的视频、单球员裁剪片段、结构化姿态 JSON，并可调用 DeepSeek Anthropic 兼容接口生成球员技术分析。

## 功能特性

- **视频上传与异步处理**：支持 MP4 / AVI / MOV / MKV / WebM，默认最大 200MB。
- **人体姿态识别**：基于 Ultralytics YOLO Pose 检测 COCO-17 关键点。
- **多球员跟踪**：使用 ByteTrack 跟踪不同球员，并过滤低可见率噪声 track。
- **骨架可视化输出**：导出带关键点、骨架线和球员 ID 的标注视频。
- **单球员裁剪片段**：为每个有效 track 生成独立球员视频片段。
- **结构化姿态数据**：输出全局与单球员 JSON，供前端展示或 LLM 分析使用。
- **AI 技术分析**：可选接入 DeepSeek，基于姿态统计生成优势、短板、总结和训练建议。
- **React 液态玻璃前端**：Vite + React 前端，提供上传、进度、结果卡片、播放器、骨架 canvas 和 AI 分析面板。

## 技术栈

### 后端

- Python 3.10+
- FastAPI
- Uvicorn
- Ultralytics YOLO
- OpenCV
- NumPy
- httpx

### 前端

- React 19
- Vite 6
- CSS liquid glass 视觉系统

## 项目结构

```text
athena/
├── app.py                 # FastAPI Web 服务与 API 路由
├── processor.py           # 视频姿态识别、跟踪、裁剪与 JSON 导出
├── analyzer.py            # 姿态统计摘要与 DeepSeek 分析封装
├── config.py              # 路径、模型、视频、跟踪、AI 配置
├── requirements.txt       # Python 依赖
├── yolo26n-pose.pt        # YOLO Pose 模型权重（可自动下载/本地放置）
├── frontend/              # React/Vite 前端源码
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── styles.css
│   │   └── components/
│   ├── package.json
│   └── vite.config.js
├── static/                # 后端静态资源与 Vite 构建输出目录
├── uploads/               # 上传视频目录（运行时生成，git 忽略）
└── outputs/               # 输出视频/JSON/分析缓存目录（运行时生成，git 忽略）
```

## 环境准备

### 1. 克隆项目

```bash
git clone https://github.com/duoxichangan/athena.git
cd athena
```

### 2. 创建 Python 虚拟环境

Windows PowerShell：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Git Bash / macOS / Linux：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> 首次运行 YOLO 模型时，Ultralytics 会按配置加载 `yolo26n-pose.pt`。如果本地没有该权重，请确保网络可用，或手动放置模型文件。

### 3. 安装前端依赖

```bash
cd frontend
npm install
```

## 配置 AI 分析（可选）

AI 分析依赖 DeepSeek Anthropic 兼容 API。推荐通过环境变量配置，不要把真实 API Key 写入代码或提交到 Git。

Windows PowerShell：

```powershell
$env:DEEPSEEK_API_KEY="sk-你的密钥"
$env:DEEPSEEK_BASE_URL="https://api.deepseek.com/anthropic"
$env:DEEPSEEK_MODEL="deepseek-chat"
```

Git Bash / macOS / Linux：

```bash
export DEEPSEEK_API_KEY="sk-你的密钥"
export DEEPSEEK_BASE_URL="https://api.deepseek.com/anthropic"
export DEEPSEEK_MODEL="deepseek-chat"
```

如果不配置 `DEEPSEEK_API_KEY`，视频识别、姿态跟踪、JSON 导出和下载功能仍可使用，但 AI 分析按钮会返回“AI 分析未配置”。

## 开发运行

开发时需要同时启动后端和前端。

### 终端 1：启动后端

在项目根目录：

```bash
python app.py
```

后端默认监听：

```text
http://127.0.0.1:8000
```

### 终端 2：启动前端

在 `frontend/` 目录：

```bash
npm run dev
```

前端默认监听：

```text
http://localhost:5173
```

Vite 会把以下接口代理到后端 `127.0.0.1:8000`：

- `/upload`
- `/status/*`
- `/download/*`
- `/data/*`
- `/player-clip/*`
- `/analyze/*`
- `/outputs/*`

如果上传时报错：

```text
http proxy error: /upload
Error: connect ECONNREFUSED 127.0.0.1:8000
```

说明后端没有启动，请先运行 `python app.py`。

## 生产构建

在 `frontend/` 目录执行：

```bash
npm run build
```

Vite 会将前端构建到：

```text
static/dist/
```

随后在项目根目录启动后端：

```bash
python app.py
```

访问后端根路径即可加载构建后的前端页面：

```text
http://127.0.0.1:8000
```

## API 概览

### `POST /upload`

上传视频并启动后台处理任务。

返回示例：

```json
{
  "task_id": "abc123def456",
  "filename": "demo.mp4",
  "status": "processing"
}
```

### `GET /status/{task_id}`

查询任务状态。

状态包括：

- `processing`
- `done`
- `error`

### `GET /download/{task_id}`

下载处理后的主视频。

### `GET /data/{task_id}`

下载完整姿态数据 JSON。

### `GET /data/{task_id}/{track_id}`

获取指定球员的姿态数据。

### `GET /player-clip/{task_id}/{track_id}`

播放或下载指定球员的裁剪视频。

### `POST /analyze/{task_id}/{track_id}`

对指定球员生成 AI 技术分析。

可选 query 参数：

```text
force=true
```

用于忽略缓存并重新分析。

## 输出文件

运行过程中会生成：

- `uploads/`：上传的原始视频。
- `outputs/*_pose.mp4`：带骨架标注的主视频。
- `outputs/*_pose_data.json`：结构化姿态数据。
- `outputs/<task>/player_<track_id>.mp4` 或 `.webm`：单球员裁剪片段。
- `outputs/<task>/analysis_<track_id>.json`：AI 分析缓存。

这些文件通常体积较大，默认不提交到 Git。

## 常见问题

### 上传后没有识别 / Vite 显示 proxy error

请确认后端已启动：

```bash
python app.py
```

前端开发服务器只负责页面渲染，实际视频处理由 FastAPI 后端完成。

### AI 分析不可用

请检查是否配置了：

```bash
DEEPSEEK_API_KEY
```

以及后端启动日志中是否显示 AI 分析器已就绪。

### 视频处理慢

可在 `config.py` 中调整：

- `IMGSZ`
- `FRAME_SKIP`
- `CONF_THRESHOLD`
- `TRACK_CONF_THRESHOLD`

较低分辨率和更高跳帧可以提升速度，但会影响精度。

### 浏览器无法播放某些球员裁剪视频

`processor.py` 会优先尝试 WebM/VP80、H.264、XVID、mp4v 等编码。不同机器的 OpenCV/FFmpeg 编码支持不同，如果无法播放，请检查本地 OpenCV 构建的编码器支持。

## 安全与隐私提示

- 不要提交真实 API Key。
- 不要提交用户上传视频、识别输出视频或分析缓存。
- 上传视频可能包含个人肖像信息，部署时请根据实际场景加入鉴权、清理策略和访问控制。

## License

当前仓库未显式声明开源许可证。使用、分发或商业化前请先补充许可证说明。

# 实时训练与录像复盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** 新增电脑摄像头实时训练与半场小地图，同时维持现有上传录像分析的全部行为不变。

**Architecture:** 浏览器使用 \`getUserMedia\` 提供本地实时预览，并定时将 JPEG 帧提交给独立的 FastAPI 实时会话接口。每个会话持有独立 YOLO 跟踪状态，返回归一化球员位置；React 用该数据在视频右上角绘制半场小地图。现有录像任务字典、上传接口及 \`VideoProcessor.process()\` 不参与实时请求。

**Tech Stack:** FastAPI、Ultralytics YOLO Pose、OpenCV、React 19、Vite、Vitest、Testing Library、pytest。

## Global Constraints

- 不修改或删除 \`/upload\`、\`/status/{task_id}\`、\`/data/{task_id}\`、\`/analyze/{task_id}/{track_id}\` 的现有契约。
- 初版仅支持当前电脑浏览器授权的单路摄像头，视频帧不落盘。
- 小地图使用归一化画面坐标，界面必须标示“相对位置”。
- 实时接口失败不得影响本地预览或录像复盘。

---

### Task 1: 建立可复用的单帧实时姿态处理器

**Files:**
- Create: \`athena/live_processor.py\`
- Create: \`athena/tests/test_live_processor.py\`
- Modify: \`athena/requirements.txt\`

**Interfaces:**
- Consumes: \`numpy.ndarray\` BGR 图像。
- Produces: \`LiveFrameProcessor.process(frame: np.ndarray) -> list[dict]\`，每项是 \`{track_id: int, x: float, y: float, confidence: float}\`，x/y 均位于 [0, 1]。

- [ ] **Step 1: 写失败的坐标归一化测试**

\`\`\`python
from live_processor import bbox_bottom_center

def test_bbox_bottom_center_normalizes_to_video_dimensions():
    assert bbox_bottom_center([100, 40, 300, 240], 400, 300) == (0.5, 0.8)

def test_bbox_bottom_center_clamps_out_of_range_values():
    assert bbox_bottom_center([-20, 0, 20, 400], 100, 200) == (0.0, 1.0)
\`\`\`

- [ ] **Step 2: 验证测试失败**

Run: \`.\.venv\Scripts\python.exe -m pytest tests/test_live_processor.py -q\`

Expected: FAIL，提示无法导入 \`live_processor\`。

- [ ] **Step 3: 实现最小处理器**

\`\`\`python
def bbox_bottom_center(bbox, width: int, height: int) -> tuple[float, float]:
    x1, _, x2, y2 = bbox
    x = (float(x1) + float(x2)) / 2 / max(width, 1)
    y = float(y2) / max(height, 1)
    return max(0.0, min(1.0, x)), max(0.0, min(1.0, y))

class LiveFrameProcessor:
    def __init__(self, model_name=MODEL_NAME):
        self.model = YOLO(model_name)

    def process(self, frame):
        results = self.model.track(
            frame, persist=True, conf=TRACK_CONF_THRESHOLD, iou=IOU_THRESHOLD,
            imgsz=IMGSZ, tracker=TRACKER_CONFIG, verbose=False,
        )
        # 仅返回 boxes.id 和 boxes.xyxy 同时存在的球员；不绘制、不写文件。
\`\`\`

在 \`requirements.txt\` 添加 \`pytest>=8.0.0\`。

- [ ] **Step 4: 验证处理器测试通过**

Run: \`.\.venv\Scripts\python.exe -m pytest tests/test_live_processor.py -q\`

Expected: \`2 passed\`。

- [ ] **Step 5: 提交**

\`\`\`powershell
git add live_processor.py tests/test_live_processor.py requirements.txt
git commit -m "feat: add live frame pose processor"
\`\`\`

### Task 2: 增加隔离的实时会话 API

**Files:**
- Modify: \`athena/app.py\`
- Create: \`athena/tests/test_live_api.py\`

**Interfaces:**
- Consumes: \`POST /live/start\`、\`POST /live/frame/{session_id}\`（multipart 字段 \`file\`，JPEG/PNG）、\`POST /live/stop/{session_id}\`。
- Produces: start 返回 \`{session_id, status: "live"}\`；frame 返回 \`{session_id, players, frame_width, frame_height}\`；stop 返回 \`{session_id, status: "stopped"}\`。

- [ ] **Step 1: 写失败的 API 隔离测试**

\`\`\`python
from fastapi.testclient import TestClient
import app as application

def test_live_start_and_stop_do_not_modify_video_tasks(monkeypatch):
    monkeypatch.setattr(application, "LiveFrameProcessor", lambda: object())
    client = TestClient(application.app)
    application.tasks.clear()
    response = client.post("/live/start")
    assert response.status_code == 200
    session_id = response.json()["session_id"]
    assert application.tasks == {}
    assert client.post(f"/live/stop/{session_id}").json()["status"] == "stopped"

def test_live_frame_rejects_unknown_session():
    client = TestClient(application.app)
    response = client.post("/live/frame/missing", files={"file": ("frame.jpg", b"bad", "image/jpeg")})
    assert response.status_code == 404
\`\`\`

- [ ] **Step 2: 验证测试失败**

Run: \`.\.venv\Scripts\python.exe -m pytest tests/test_live_api.py -q\`

Expected: FAIL，路由不存在。

- [ ] **Step 3: 在 \`app.py\` 添加独立会话与路由**

\`\`\`python
live_sessions: dict[str, LiveFrameProcessor] = {}

@app.post("/live/start")
async def live_start():
    session_id = uuid.uuid4().hex[:12]
    live_sessions[session_id] = LiveFrameProcessor()
    return {"session_id": session_id, "status": "live"}

@app.post("/live/frame/{session_id}")
async def live_frame(session_id: str, file: UploadFile = File(...)):
    frame_processor = live_sessions.get(session_id)
    if frame_processor is None:
        raise HTTPException(status_code=404, detail="Live session not found")
    encoded = np.frombuffer(await file.read(), dtype=np.uint8)
    frame = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image frame")
    players = await asyncio.get_running_loop().run_in_executor(None, frame_processor.process, frame)
    return {"session_id": session_id, "players": players,
            "frame_width": frame.shape[1], "frame_height": frame.shape[0]}

@app.post("/live/stop/{session_id}")
async def live_stop(session_id: str):
    if live_sessions.pop(session_id, None) is None:
        raise HTTPException(status_code=404, detail="Live session not found")
    return {"session_id": session_id, "status": "stopped"}
\`\`\`

显式导入 \`cv2\`、\`numpy as np\`、\`HTTPException\` 与 \`LiveFrameProcessor\`；应用 shutdown 时执行 \`live_sessions.clear()\`。

- [ ] **Step 4: 验证接口和既有后端语法**

Run: \`.\.venv\Scripts\python.exe -m pytest tests/test_live_api.py -q; .\.venv\Scripts\python.exe -m py_compile app.py live_processor.py processor.py\`

Expected: API 测试通过，编译无输出。

- [ ] **Step 5: 提交**

\`\`\`powershell
git add app.py tests/test_live_api.py
git commit -m "feat: add isolated live training API"
\`\`\`

### Task 3: 实时 API 客户端和半场小地图

**Files:**
- Modify: \`athena/frontend/src/api.js\`
- Create: \`athena/frontend/src/components/LiveCourtMap.jsx\`
- Create: \`athena/frontend/src/components/LiveCourtMap.test.jsx\`
- Modify: \`athena/frontend/src/styles.css\`

**Interfaces:**
- Consumes: \`players: Array<{track_id, x, y, confidence}>\` 和 \`history: Record<string, Array<{x, y}>>\`。
- Produces: \`LiveCourtMap\`，含“相对位置”标签、球员点位、最多 30 个轨迹点和展开回调。

- [ ] **Step 1: 写失败的小地图渲染测试**

\`\`\`jsx
import { render, screen } from '@testing-library/react'
import LiveCourtMap from './LiveCourtMap.jsx'

it('shows relative-position label and tracked players', () => {
  render(<LiveCourtMap players={[{ track_id: 7, x: 0.4, y: 0.7 }]} history={{}} />)
  expect(screen.getByText('相对位置')).toBeInTheDocument()
  expect(screen.getByLabelText('学员 7')).toBeInTheDocument()
})
\`\`\`

- [ ] **Step 2: 验证测试失败**

Run: \`npm test -- --run src/components/LiveCourtMap.test.jsx\`

Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现客户端和 SVG 小地图**

\`\`\`js
export async function startLiveSession() {
  return (await fetch('/live/start', { method: 'POST' })).json()
}
export async function stopLiveSession(id) {
  return (await fetch(\`/live/stop/\${id}\`, { method: 'POST' })).json()
}
export async function sendLiveFrame(id, blob) {
  const form = new FormData()
  form.append('file', blob, 'frame.jpg')
  return (await fetch(\`/live/frame/\${id}\`, { method: 'POST', body: form })).json()
}
\`\`\`

\`LiveCourtMap\` 用 SVG 绘制半场线和百分比坐标；每个球员元素使用 \`aria-label={\`学员 \${track_id}\`}\`。CSS 负责把组件作为视频右上角的半透明叠层显示。

- [ ] **Step 4: 验证前端小地图**

Run: \`npm test -- --run src/components/LiveCourtMap.test.jsx\`

Expected: \`1 passed\`。

- [ ] **Step 5: 提交**

\`\`\`powershell
git add frontend/src/api.js frontend/src/components/LiveCourtMap.jsx frontend/src/components/LiveCourtMap.test.jsx frontend/src/styles.css
git commit -m "feat: add live court mini map"
\`\`\`

### Task 4: 添加独立实时训练入口并回归录像复盘

**Files:**
- Create: \`athena/frontend/src/components/LiveTraining.jsx\`
- Create: \`athena/frontend/src/components/LiveTraining.test.jsx\`
- Modify: \`athena/frontend/src/components/Sections.jsx\`
- Modify: \`athena/frontend/src/App.jsx\`
- Modify: \`athena/frontend/src/styles.css\`

**Interfaces:**
- Consumes: \`navigator.mediaDevices.getUserMedia\` 与 Task 3 的 API 函数。
- Produces: “实时训练”启动/结束视图；既有 \`UploadSection\` 继续使用原签名 \`onSubmit(file)\`。

- [ ] **Step 1: 写失败的摄像头权限测试**

\`\`\`jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import LiveTraining from './LiveTraining.jsx'

it('shows a permission error when camera access is denied', async () => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) },
    configurable: true,
  })
  render(<LiveTraining />)
  await userEvent.click(screen.getByRole('button', { name: '开启实时训练' }))
  expect(await screen.findByText('无法访问电脑摄像头，请检查浏览器权限。')).toBeInTheDocument()
})
\`\`\`

- [ ] **Step 2: 验证测试失败**

Run: \`npm test -- --run src/components/LiveTraining.test.jsx\`

Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现并接入页面**

\`LiveTraining\` 启动顺序为 \`getUserMedia({ video: true, audio: false })\`，再调用 \`startLiveSession()\`；每 150 ms 用隐藏 canvas 获取 JPEG 并调用 \`sendLiveFrame()\`。停止按钮、组件卸载、页面离开均执行：清除抓帧定时器、调用 \`stopLiveSession(sessionId)\`、对 \`stream.getTracks()\` 全部执行 \`stop()\`。

在 \`App.jsx\` 的 idle 页面先渲染 \`<LiveTraining />\`，再渲染原有 \`<UploadSection onSubmit={handleSubmit} />\`。在 \`Sections.jsx\` 给上传区域增加“录像复盘”说明，但不得修改 \`handleSubmit\`、轮询、\`showResult\`、结果页或原上传 API。

- [ ] **Step 4: 完整回归**

Run: \`npm test; npm run build; .\.venv\Scripts\python.exe -m pytest tests -q; .\.venv\Scripts\python.exe -m py_compile app.py processor.py live_processor.py\`

Expected: Vitest 全部通过、Vite 构建成功、Python 测试通过、编译无错误。

- [ ] **Step 5: 手动验收**

Run: \`.\.venv\Scripts\python.exe app.py\`

Expected: “开启实时训练”可访问电脑摄像头、右上角小地图更新；结束后摄像头指示灯关闭；随后上传 MP4 仍能进入原先的处理、球员卡片、AI 分析与沙盘流程。

- [ ] **Step 6: 提交**

\`\`\`powershell
git add frontend/src/components/LiveTraining.jsx frontend/src/components/LiveTraining.test.jsx frontend/src/components/Sections.jsx frontend/src/App.jsx frontend/src/styles.css
git commit -m "feat: add live camera training entry"
\`\`\`

## Self-review

- 规格覆盖：Task 1–2 实现独立实时分析与会话清理；Task 3 实现右上角相对位置半场图；Task 4 保留并回归验证录像复盘。
- 无占位项：所有新增接口、组件、测试命令和清理动作均已给出。
- 类型一致：后端 \`players\` 使用 \`track_id/x/y/confidence\`，前端小地图与实时组件消费相同字段；录像任务仍只使用原 \`task_id\`。

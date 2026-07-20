from fastapi.testclient import TestClient

import app as application


def test_live_start_and_stop_do_not_modify_video_tasks(monkeypatch):
    monkeypatch.setattr(application, "LiveFrameProcessor", lambda: object(), raising=False)
    client = TestClient(application.app)
    application.tasks.clear()

    response = client.post("/live/start")

    assert response.status_code == 200
    session_id = response.json()["session_id"]
    assert application.tasks == {}
    assert client.post(f"/live/stop/{session_id}").json()["status"] == "stopped"


def test_live_frame_rejects_unknown_session():
    client = TestClient(application.app)
    response = client.post(
        "/live/frame/missing",
        files={"file": ("frame.jpg", b"bad", "image/jpeg")},
    )

    assert response.status_code == 404

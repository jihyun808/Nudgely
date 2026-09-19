"""헬스체크 스모크 테스트. OpenAI 키 없이도 통과해야 함."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    # 모델 티어 두 개를 다 보여준다(어느 모델이 물려 있는지 배포 후 확인용)
    assert "chatModel" in body
    assert "batchModel" in body

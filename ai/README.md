# ai/

이 프로젝트의 AI 로직은 **별도 서비스가 아니라 백엔드 안의 모듈**로 관리합니다.

➡️ 실제 코드는 [`../backend/app/ai/`](../backend/app/ai/) 에 있습니다.

- `backend/app/ai/client.py` — OpenAI 클라이언트
- `backend/app/ai/prompts.py` — 스터디 페르소나 프롬프트
- `backend/app/ai/schemas.py` — 요청/응답 모델
- `backend/app/ai/service.py` — AI 비즈니스 로직

> 아키텍처 결정: MVP 단계에서는 배포/통신 오버헤드를 줄이기 위해
> AI를 백엔드와 한 서버(모놀리식)로 둡니다. 나중에 트래픽이 커지면
> 이 폴더로 독립 서비스를 분리할 수 있습니다.

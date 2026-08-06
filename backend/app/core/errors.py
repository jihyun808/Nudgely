"""공통 에러 처리.

프론트와 합의한 에러 응답 포맷(api.md §1):

    { "code": "GOAL_NOT_FOUND", "message": "목표를 찾을 수 없습니다." }

- 도메인 오류는 `AppError` 를 raise 한다.
- FastAPI 의 HTTPException / 요청 검증 오류도 같은 포맷으로 변환한다.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """도메인 계층에서 던지는 표준 에러.

    예) raise AppError("GOAL_NOT_FOUND", "목표를 찾을 수 없습니다.", status_code=404)
    """

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _payload(code: str, message: str) -> dict[str, str]:
    return {"code": code, "message": message}


def register_error_handlers(app: FastAPI) -> None:
    """앱에 예외 핸들러를 등록한다. main.py 에서 한 번 호출."""

    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_payload(exc.code, exc.message))

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        # detail 이 이미 {code, message} 형태면 그대로, 아니면 감싼다.
        detail = exc.detail
        if isinstance(detail, dict) and "code" in detail and "message" in detail:
            content = {"code": detail["code"], "message": detail["message"]}
        else:
            content = _payload(f"HTTP_{exc.status_code}", str(detail))
        return JSONResponse(status_code=exc.status_code, content=content)

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # 첫 번째 오류 메시지를 사람이 읽을 수 있게 전달.
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        msg = first.get("msg", "잘못된 요청입니다.")
        message = f"{loc}: {msg}" if loc else msg
        return JSONResponse(status_code=422, content=_payload("VALIDATION_ERROR", message))

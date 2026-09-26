"""공통 에러 처리.

프론트와 합의한 에러 응답 포맷(api.md §1):

    { "code": "GOAL_NOT_FOUND", "message": "목표를 찾을 수 없습니다." }

- 도메인 오류는 `AppError` 를 raise 한다.
- FastAPI 의 HTTPException / 요청 검증 오류도 같은 포맷으로 변환한다.
"""

from json import JSONDecodeError

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
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


def _first_error_message(errors: list[dict]) -> str:
    """검증 오류 목록에서 사람이 읽을 첫 줄을 뽑는다."""
    first = errors[0] if errors else {}
    loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    msg = first.get("msg", "잘못된 요청입니다.")
    return f"{loc}: {msg}" if loc else msg


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
        # FastAPI 가 자동 검증한 경우(경로·쿼리·선언된 본문).
        return JSONResponse(
            status_code=422,
            content=_payload("VALIDATION_ERROR", _first_error_message(exc.errors())),
        )

    @app.exception_handler(ValidationError)
    async def _handle_model_validation_error(_: Request, exc: ValidationError) -> JSONResponse:
        # 라우터가 model_validate 로 직접 검증한 경우(JSON·multipart 본문을 손으로 파싱하는 곳).
        # 안 잡으면 500 이 나간다 — 검증 실패는 클라이언트 잘못이므로 422 로 돌려준다.
        return JSONResponse(
            status_code=422,
            content=_payload("VALIDATION_ERROR", _first_error_message(exc.errors())),
        )

    @app.exception_handler(JSONDecodeError)
    async def _handle_json_decode_error(_: Request, __: JSONDecodeError) -> JSONResponse:
        # JSON 이라고 보냈는데 파싱이 안 되는 본문. 역시 500 이 아니라 400 이다.
        return JSONResponse(
            status_code=400,
            content=_payload("INVALID_JSON", "요청 본문이 올바른 JSON 이 아닙니다."),
        )

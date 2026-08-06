"""파일 스토리지 (로컬 디스크).

프론트 검증은 우회 가능하므로 서버가 재검증한다(api.md §3.2):
- 매직 넘버로 실제 포맷 확인
- 이미지는 재인코딩해서 메타데이터 제거(+ 썸네일 생성)
- 파일명은 서버가 생성, 확장자 고정
- 용량 상한 확인

운영에서는 이 모듈만 S3 등으로 교체하면 된다(호출부는 그대로).
"""

import io
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from app.core.config import settings
from app.core.errors import AppError
from app.core.ids import new_id

# 확장자 → (kind, 이미지 여부)
_IMAGE_EXTS = {"jpg", "jpeg", "png"}
_FILE_EXTS = {"pdf", "txt"}

THUMB_MAX = (320, 320)


@dataclass
class SavedFile:
    stored_name: str
    url: str
    thumb_url: str | None
    kind: str  # image | file
    display_name: str
    size_bytes: int


def _sniff_ext(data: bytes) -> str | None:
    """매직 넘버로 실제 포맷 판별. 못 맞추면 None."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:5] == b"%PDF-":
        return "pdf"
    # txt: 매직 넘버가 없다. UTF-8 로 디코드되고 NUL 이 없으면 텍스트로 본다.
    if b"\x00" not in data:
        try:
            data.decode("utf-8")
            return "txt"
        except UnicodeDecodeError:
            return None
    return None


def _storage_root() -> Path:
    root = Path(settings.storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _public_url(name: str) -> str:
    return f"{settings.public_base_url.rstrip('/')}/static/{name}"


def _clean_display_name(filename: str | None, ext: str) -> str:
    base = (filename or "file").rsplit("/", 1)[-1].rsplit("\\", 1)[-1].strip()
    if not base:
        base = f"file.{ext}"
    return base[:120]


def save_upload(
    data: bytes,
    filename: str | None,
    *,
    allowed_exts: set[str],
    max_bytes: int,
) -> SavedFile:
    """바이트를 검증·저장하고 접근 URL 을 돌려준다."""
    if not data:
        raise AppError("EMPTY_FILE", "빈 파일입니다.", status_code=422)
    if len(data) > max_bytes:
        mb = max_bytes // (1024 * 1024)
        raise AppError("FILE_TOO_LARGE", f"파일이 너무 큽니다(최대 {mb}MB).", status_code=413)

    ext = _sniff_ext(data)
    if ext is None or ext not in allowed_exts:
        raise AppError("UNSUPPORTED_FILE", "지원하지 않는 파일 형식입니다.", status_code=422)

    root = _storage_root()
    stored_name = f"{new_id('f')}.{ext}"
    is_image = ext in _IMAGE_EXTS
    thumb_url = None

    if is_image:
        # 재인코딩으로 메타데이터 제거 + 실제 이미지인지 확인
        try:
            im = Image.open(io.BytesIO(data))
            im.load()
        except Exception as exc:  # noqa: BLE001
            raise AppError(
                "UNSUPPORTED_FILE", "이미지를 읽을 수 없습니다.", status_code=422
            ) from exc
        fmt = "PNG" if ext == "png" else "JPEG"
        clean = im.convert("RGBA") if ext == "png" else im.convert("RGB")
        clean.save(root / stored_name, format=fmt)

        # 썸네일
        thumb_name = f"thumb_{stored_name}"
        thumb = clean.copy()
        thumb.thumbnail(THUMB_MAX)
        thumb.save(root / thumb_name, format=fmt)
        thumb_url = _public_url(thumb_name)
        kind = "image"
    else:
        (root / stored_name).write_bytes(data)
        kind = "file"

    return SavedFile(
        stored_name=stored_name,
        url=_public_url(stored_name),
        thumb_url=thumb_url,
        kind=kind,
        display_name=_clean_display_name(filename, ext),
        size_bytes=len(data),
    )


# 편의 상한
CHAT_ALLOWED = _IMAGE_EXTS | _FILE_EXTS


def chat_max_bytes() -> int:
    return settings.max_chat_file_mb * 1024 * 1024


def image_max_bytes() -> int:
    return settings.max_image_mb * 1024 * 1024

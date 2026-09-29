"""파일 스토리지 (로컬 디스크).

프론트 검증은 우회 가능하므로 서버가 재검증한다(api.md §3.2):
- 매직 넘버로 실제 포맷 확인
- 이미지는 재인코딩해서 메타데이터 제거(+ 썸네일 생성)
- 파일명은 서버가 생성, 확장자 고정
- 용량 상한 확인

운영에서는 이 모듈만 S3 등으로 교체하면 된다(호출부는 그대로).
"""

import io
import logging
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

logger = logging.getLogger(__name__)


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


def assert_writable() -> None:
    """못 쓰면 업로드가 전부 죽는데 화면에는 "안 올라간다" 로만 보인다."""
    root = storage_root()
    probe = root / ".write-probe"
    try:
        probe.write_bytes(b"")
        probe.unlink()
    except OSError as exc:
        logger.error(
            "업로드 디렉터리에 쓸 수 없습니다(%s): %s. 사진 업로드가 모두 실패합니다.",
            root,
            exc,
        )


def storage_root() -> Path:
    root = Path(settings.storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _public_url(name: str) -> str:
    return f"{_static_prefix()}{name}"


def _static_prefix() -> str:
    return f"{settings.public_base_url.rstrip('/')}/static/"


def is_our_url(url: str) -> bool:
    """우리가 발급한 파일 주소인지. 아무 주소나 받으면 프로필 사진이

    남의 서버를 가리키고, 그 서버가 조회자 IP 를 본다.
    """
    prefix = _static_prefix()
    if not url.startswith(prefix):
        return False
    name = url[len(prefix) :]
    return bool(name) and "/" not in name and ".." not in name


def delete_by_url(url: str | None) -> bool:
    """우리가 발급한 주소의 파일을 지운다. 지웠으면 True.

    회원 탈퇴 시 디스크의 실물까지 지우려고 쓴다. DB 행은 FK CASCADE 로 사라지지만
    파일은 남기 때문이다(이용약관 §14: 탈퇴 시 지체 없이 파기).

    남의 주소이거나 이미 없는 파일이면 조용히 False. 파기 중 파일 하나 때문에
    전체가 멈추면 안 된다.
    """
    if not url or not is_our_url(url):
        return False

    name = url[len(_static_prefix()) :]
    try:
        path = storage_root() / name
        # storage_root 밖을 가리키면 지우지 않는다 (is_our_url 로 한 번 걸렀지만 이중 확인)
        if path.resolve().parent != storage_root().resolve():
            return False
        path.unlink()
    except OSError:
        return False
    return True


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

    root = storage_root()
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

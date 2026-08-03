// utils/image.ts

/** 허용 이미지 MIME 타입 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
/** 허용 확장자 (MIME과 교차 검증용) */
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;
/** 최대 업로드 크기: 5MB */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/**
 * 파일 앞부분 바이트(매직 넘버)로 실제 포맷을 판별한다.
 * File.type과 확장자는 사용자가 얼마든지 바꿀 수 있어서 그것만 믿으면 안 된다.
 */
async function sniffImageSignature(file: File) {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (...bytes: number[]) => bytes.every((b, i) => header[i] === b);

  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  // WebP: 0~3바이트 "RIFF" + 8~11바이트 "WEBP"
  const isWebp =
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    [0x57, 0x45, 0x42, 0x50].every((b, i) => header[8 + i] === b);
  if (isWebp) return 'image/webp';
  return null;
}

/**
 * 프로필/채팅방 사진 업로드 전 클라이언트 검증.
 * 크기 → 확장자 → MIME → 실제 바이트 순으로 확인한다.
 * 어디까지나 1차 방어선이고, 최종 검증은 서버에서 반드시 다시 해야 한다.
 *
 * @returns 문제가 없으면 null, 있으면 사용자에게 보여줄 메시지
 */
export async function validateImageFile(file: File): Promise<string | null> {
  if (file.size === 0) return '빈 파일이에요. 다른 사진을 선택해주세요.';
  if (file.size > MAX_IMAGE_SIZE) {
    return `사진 용량은 ${MAX_IMAGE_SIZE / 1024 / 1024}MB 이하만 올릴 수 있어요.`;
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isAllowedExtension = (ALLOWED_EXTENSIONS as readonly string[]).includes(extension);
  const isAllowedMime = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
  if (!isAllowedExtension || !isAllowedMime) {
    return 'JPG, PNG, WEBP, GIF 형식만 올릴 수 있어요.';
  }

  // 확장자를 이미지로 위장한 파일(예: .png로 이름만 바꾼 스크립트)을 걸러낸다
  const actualMime = await sniffImageSignature(file);
  if (!actualMime) return '이미지 파일이 아니에요. 다른 사진을 선택해주세요.';
  // jpg/jpeg는 같은 포맷이므로 MIME 기준으로만 비교한다
  if (actualMime !== file.type) return '파일 형식이 확장자와 달라요.';

  return null;
}

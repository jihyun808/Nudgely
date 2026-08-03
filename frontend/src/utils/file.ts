// utils/file.ts

/** 채팅에 올릴 수 있는 확장자 */
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'txt'] as const;
/** 확장자와 짝이 맞아야 하는 MIME 타입 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'] as const;
/** 첨부 최대 크기: 10MB */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** 파일 선택창에 넘길 accept 값 */
export const ATTACHMENT_ACCEPT =
  '.jpg,.jpeg,.png,.pdf,.txt,image/jpeg,image/png,application/pdf,text/plain';

/** 확장자로 이미지인지 판단한다 (미리보기 여부를 정할 때 쓴다) */
export function isImageFile(name: string) {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return extension === 'jpg' || extension === 'jpeg' || extension === 'png';
}

/**
 * 채팅 첨부 파일 검증.
 * 어디까지나 1차 방어선이고, 최종 검증은 서버에서 반드시 다시 해야 한다.
 *
 * @returns 문제가 없으면 null, 있으면 사용자에게 보여줄 메시지
 */
export function validateAttachmentFile(file: File): string | null {
  if (file.size === 0) return '빈 파일이에요. 다른 파일을 선택해주세요.';
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return `파일은 ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB 이하만 보낼 수 있어요.`;
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isAllowedExtension = (ALLOWED_EXTENSIONS as readonly string[]).includes(extension);
  // 일부 브라우저는 txt의 MIME을 비워서 보내므로 확장자를 우선 본다
  const isAllowedMime =
    file.type === '' || (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);

  if (!isAllowedExtension || !isAllowedMime) {
    return 'JPG, PNG, PDF, TXT 파일만 보낼 수 있어요.';
  }

  return null;
}

// api/form.ts
// 화면들은 mock 시절부터 고른 사진을 data URL 문자열로 들고 있다(ImagePicker).
// 서버는 multipart 파일을 받으므로, 화면 코드를 건드리지 않고 여기서 파일로 되돌린다.

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.*)$/;

/** 아직 서버에 올리지 않은(= data URL로만 들고 있는) 사진인지 */
export function isDataUrl(value: string | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

/**
 * data URL을 업로드용 File로 되돌린다.
 * 서버가 허용하는 형식은 jpg·png뿐이라 확장자도 그 둘로만 붙인다.
 * (화면 검증도 같은 둘로 좁혀놨지만, 최종 검증은 서버가 한다 — utils/image.ts)
 */
export function dataUrlToFile(dataUrl: string, baseName: string): File {
  const matched = DATA_URL_PATTERN.exec(dataUrl);
  if (!matched) throw new Error('INVALID_IMAGE');

  const [, mimeType, base64] = matched;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  return new File([bytes], `${baseName}.${extension}`, { type: mimeType });
}

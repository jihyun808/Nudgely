// utils/time.ts

/** 초 → 'MM:SS' (1시간이 넘으면 'H:MM:SS') */
export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

/** 분 → '1시간 24분' (60분 미만이면 '24분') */
export function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

/** 바이트 → 'KB' / 'MB' 표기 */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)}KB`;
  return `${(kilobytes / 1024).toFixed(1)}MB`;
}

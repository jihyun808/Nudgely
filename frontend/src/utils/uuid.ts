// utils/uuid.ts

/**
 * 고유 id를 만든다. 브라우저가 지원하는 가장 좋은 방법부터 차례로 시도한다.
 *
 * `crypto.randomUUID()`는 https(또는 localhost)에서만 존재한다.
 * 폰으로 `http://192.168.x.x:5173`에 붙어 테스트하면 iOS Safari에서 함수 자체가 없어
 * TypeError가 나고, 그걸 호출한 로직까지 통째로 끊긴다. 그래서 폴백을 둔다.
 *
 * `crypto.getRandomValues()`는 http에서도 쓸 수 있어 두 번째 후보로 두었다.
 * 마지막 폴백은 추측 가능성이 있으므로 OAuth state 같은 곳에 기대선 안 된다.
 */
export const createId = (): string => {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

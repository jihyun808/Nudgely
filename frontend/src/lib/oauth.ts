// lib/oauth.ts
import type { AuthProvider } from '@/types/auth';
import { createId } from '@/utils/uuid';

/**
 * 소셜 로그인 인가 요청.
 *
 * SDK 없이 브라우저 리다이렉트만으로 인가 코드를 받는다.
 * 사용자를 제공자 로그인 페이지로 보내고 → 콜백 주소(`/auth/callback/:provider`)로
 * `?code=...`가 돌아오면 그 코드를 서버에 넘긴다.
 *
 * 클라이언트 ID와 콜백 주소는 환경변수로 받는다(.env.example 참고).
 */

/** CSRF 방지용 state를 담아두는 키 */
const STATE_KEY = 'oauthState';

const CLIENT_IDS: Record<AuthProvider, string | undefined> = {
  kakao: import.meta.env.VITE_KAKAO_CLIENT_ID,
  google: import.meta.env.VITE_GOOGLE_CLIENT_ID,
};

/** 제공자별 인가 페이지 주소 */
const AUTHORIZE_URLS: Record<AuthProvider, string> = {
  kakao: 'https://kauth.kakao.com/oauth/authorize',
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
};

/** 구글은 요청할 정보 범위를 함께 보내야 한다 */
const SCOPES: Partial<Record<AuthProvider, string>> = {
  google: 'openid email profile',
};

/** 콜백 주소. 설정이 없으면 현재 도메인 기준으로 만든다 */
function getRedirectUri(provider: AuthProvider) {
  const base = import.meta.env.VITE_OAUTH_REDIRECT_URI ?? `${window.location.origin}/auth/callback`;
  return `${base}/${provider}`;
}

/** 키가 설정되어 있는지 (없으면 버튼을 눌러도 진행할 수 없다) */
export function isSocialLoginReady(provider: AuthProvider) {
  return Boolean(CLIENT_IDS[provider]);
}

/** 제공자 로그인 페이지로 이동시킨다 */
export function startSocialLogin(provider: AuthProvider) {
  const clientId = CLIENT_IDS[provider];
  if (!clientId) return false;

  // 돌아왔을 때 우리가 보낸 요청이 맞는지 확인하려고 state를 저장해둔다
  const state = createId();
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(provider),
    response_type: 'code',
    state,
  });
  const scope = SCOPES[provider];
  if (scope) params.set('scope', scope);

  window.location.href = `${AUTHORIZE_URLS[provider]}?${params.toString()}`;
  return true;
}

/** 돌아온 state가 우리가 보낸 것과 같은지 확인한다 (다르면 위조 요청) */
export function verifyOAuthState(state: string | null) {
  const saved = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return Boolean(state) && state === saved;
}

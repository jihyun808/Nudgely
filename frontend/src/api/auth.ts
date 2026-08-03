// api/auth.ts
import { delay } from '@/mocks/delay';
import { MOCK_PROFILE } from '@/mocks/my';
import type { User } from '@/types/auth';
import type { SigninInput, SignupInput, SocialLoginInput } from '@/types/auth';

/** 로그인·회원가입 응답 */
export interface AuthResult {
  accessToken: string;
  user: User;
}

/**
 * 이메일 로그인.
 * TODO: `api.post<AuthResult>('/auth/login', input)`으로 교체.
 */
export async function signin(input: SigninInput): Promise<AuthResult> {
  await delay(500);
  if (!input.email.trim() || !input.password) throw new Error('INVALID_CREDENTIALS');

  return {
    accessToken: 'dev-token',
    user: { ...MOCK_PROFILE, email: input.email.trim() },
  };
}

/**
 * 이메일 회원가입. 가입과 동시에 로그인 상태가 된다.
 * TODO: `api.post<AuthResult>('/auth/signup', input)`으로 교체.
 */
export async function signup(input: SignupInput): Promise<AuthResult> {
  await delay(600);
  if (!input.email.trim() || !input.password || !input.nickname.trim()) {
    throw new Error('INVALID_INPUT');
  }

  return {
    accessToken: 'dev-token',
    user: {
      id: crypto.randomUUID(),
      email: input.email.trim(),
      nickname: input.nickname.trim(),
    },
  };
}

/**
 * 이메일 중복 확인. 회원가입 전에 미리 알려주기 위한 용도.
 * TODO: `api.get<{ isAvailable: boolean }>('/auth/email-available', { params: { email } })`로 교체.
 */
export async function checkEmailAvailable(email: string): Promise<boolean> {
  await delay(300);
  // mock: 이 주소만 이미 쓰는 것으로 본다
  return email.trim().toLowerCase() !== 'taken@example.com';
}

/**
 * 소셜 로그인 (카카오·구글).
 * 앱에서 받은 인가 코드를 서버에 넘기면 서버가 우리 토큰을 돌려준다.
 * TODO: `api.post<AuthResult>('/auth/social', input)`으로 교체.
 */
export async function socialLogin(input: SocialLoginInput): Promise<AuthResult> {
  await delay(600);
  if (!input.code) throw new Error('INVALID_CODE');

  return { accessToken: 'dev-token', user: MOCK_PROFILE };
}

/**
 * 로그아웃. 서버의 리프레시 토큰을 무효화한다.
 * TODO: `api.post('/auth/logout')`으로 교체.
 */
export async function signout(): Promise<void> {
  await delay(200);
}

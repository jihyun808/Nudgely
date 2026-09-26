// api/auth.ts
import api from './axios';
import type { User } from '@/types/auth';
import type { SigninInput, SignupInput, SocialLoginInput } from '@/types/auth';

/** 로그인·회원가입 응답 */
export interface AuthResult {
  accessToken: string;
  user: User;
}

/** 이메일 로그인 */
export async function signin(input: SigninInput): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/login', {
    email: input.email.trim(),
    password: input.password,
  });
  return data;
}

/** 이메일 회원가입. 가입과 동시에 로그인 상태가 된다 */
export async function signup(input: SignupInput): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/signup', {
    nickname: input.nickname.trim(),
    email: input.email.trim(),
    password: input.password,
  });
  return data;
}

/** 이메일 중복 확인. 회원가입 전에 미리 알려주기 위한 용도 */
export async function checkEmailAvailable(email: string): Promise<boolean> {
  const { data } = await api.get<{ isAvailable: boolean }>('/auth/email-available', {
    params: { email: email.trim() },
  });
  return data.isAvailable;
}

/**
 * 소셜 로그인 (카카오·구글).
 * TODO(M3): 서버에 `/auth/social`이 아직 없다. 키 발급 후 붙인다.
 *           지금은 소셜 키가 비어 있어 버튼이 '준비 중'으로만 동작한다.
 */
export async function socialLogin(input: SocialLoginInput): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/social', input);
  return data;
}

/** 로그아웃. 서버가 세션을 정리한다 */
export async function signout(): Promise<void> {
  await api.post('/auth/logout');
}

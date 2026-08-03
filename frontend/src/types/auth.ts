/** 연결 가능한 소셜 로그인 */
export type AuthProvider = 'kakao' | 'google';

export interface User {
  id: string;
  email: string;
  nickname?: string;
  /** 프로필 사진. 없으면 회색 원만 보여준다 */
  imageUrl?: string;
}

/** 이메일 로그인 입력값 */
export interface SigninInput {
  email: string;
  password: string;
}

/** 이메일 회원가입 입력값 */
export interface SignupInput {
  nickname: string;
  email: string;
  password: string;
}

/** 소셜 로그인 입력값. 앱에서 받은 인가 코드를 서버로 넘긴다 */
export interface SocialLoginInput {
  provider: AuthProvider;
  code: string;
}

/** 비밀번호 최소 길이 (회원가입·변경 공통) */
export const MIN_PASSWORD_LENGTH = 8;

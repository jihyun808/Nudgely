// types/user.ts

/** 프로필 편집 폼 입력값 */
export interface UpdateProfileInput {
  nickname: string;
  imageUrl?: string;
}

/** 닉네임 최대 길이 */
export const NICKNAME_MAX_LENGTH = 10;

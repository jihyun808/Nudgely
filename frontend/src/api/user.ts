// api/user.ts
import { delay } from '@/mocks/delay';
import { MOCK_PROFILE } from '@/mocks/my';
import type { User } from '@/types/auth';
import type { UpdateProfileInput } from '@/types/user';

/**
 * 내 프로필 조회. 결과는 전역 상태(authStore.user)에 저장해 화면들이 함께 쓴다.
 * TODO: `api.get<User>('/me')`로 교체.
 */
export async function fetchMyProfile(): Promise<User> {
  await delay(400);
  return MOCK_PROFILE;
}

/**
 * 프로필 수정 (닉네임 · 사진).
 * TODO: 사진은 FormData로 업로드하고 서버가 준 URL을 쓰도록 교체.
 */
export async function updateMyProfile(input: UpdateProfileInput): Promise<User> {
  await delay(400);
  return { ...MOCK_PROFILE, nickname: input.nickname, imageUrl: input.imageUrl };
}

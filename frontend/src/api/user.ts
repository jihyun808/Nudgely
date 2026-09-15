// api/user.ts
import api, { MULTIPART } from './axios';
import { dataUrlToFile, isDataUrl } from './form';
import type { User } from '@/types/auth';
import type { UpdateProfileInput } from '@/types/user';

/** 내 프로필 조회. 결과는 전역 상태(authStore.user)에 저장해 화면들이 함께 쓴다 */
export async function fetchMyProfile(): Promise<User> {
  const { data } = await api.get<User>('/me');
  return data;
}

/**
 * 프로필 수정 (닉네임 · 사진).
 * 새로 고른 사진은 data URL로 들어오므로 multipart로 올리고, 서버가 준 URL을 받는다.
 * 사진을 바꾸지 않았으면 기존 URL 그대로라 JSON으로 보낸다.
 */
export async function updateMyProfile(input: UpdateProfileInput): Promise<User> {
  if (isDataUrl(input.imageUrl)) {
    const form = new FormData();
    form.append('nickname', input.nickname);
    form.append('image', dataUrlToFile(input.imageUrl, 'profile'));
    const { data } = await api.patch<User>('/me', form, MULTIPART);
    return data;
  }

  const { data } = await api.patch<User>('/me', {
    nickname: input.nickname,
    imageUrl: input.imageUrl,
  });
  return data;
}

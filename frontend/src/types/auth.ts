export interface User {
  id: string;
  email: string;
  nickname?: string;
  /** 프로필 사진. 없으면 회색 원만 보여준다 */
  imageUrl?: string;
}

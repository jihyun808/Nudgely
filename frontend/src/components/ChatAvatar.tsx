// components/ChatAvatar.tsx
import { cn } from '@/lib/utils';

/** 이미지가 없는 채팅방에 쓰는 기본 아바타 색 조합 */
const AVATAR_COLORS = [
  'bg-[#DCEFE4] text-[#3F6B52]',
  'bg-[#FBE7C8] text-[#8A6534]',
  'bg-[#E4E2F7] text-[#544C8C]',
  'bg-[#FADEDE] text-[#8C4C4C]',
  'bg-[#D9E8FA] text-[#3C5F8A]',
] as const;

/** 같은 채팅방이면 항상 같은 색이 나오도록 이름으로 색을 고정한다 */
function pickAvatarColor(name: string) {
  const sum = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
} as const;

interface ChatAvatarProps {
  /** 아바타에 표시할 이름 (이미지가 없을 때 앞 두 글자를 쓴다) */
  name: string;
  imageUrl?: string;
  /** sm: 채팅 말풍선 옆, md: 채팅 목록 */
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

/** 채팅 목록·말풍선에서 함께 쓰는 프로필 아바타 */
export default function ChatAvatar({
  name,
  imageUrl,
  size = 'md',
  className,
}: ChatAvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn('shrink-0 rounded-full object-cover', SIZE_CLASS[size], className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZE_CLASS[size],
        pickAvatarColor(name),
        className,
      )}
    >
      {name.slice(0, 2)}
    </span>
  );
}

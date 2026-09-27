// pages/archive/components/FileCard.tsx
import type { Attachment } from '@/types/archive';
import { formatFileSize } from '@/utils/time';

/** 확장자별 아이콘 색 */
const EXTENSION_COLORS: Record<string, string> = {
  pdf: 'bg-[#FADEDE] text-[#8C4C4C]',
  zip: 'bg-[#DCEFE4] text-[#3F6B52]',
  ppt: 'bg-[#FBE7C8] text-[#8A6534]',
  pptx: 'bg-[#FBE7C8] text-[#8A6534]',
  xlsx: 'bg-[#DCEFE4] text-[#3F6B52]',
};

const getExtension = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

interface FileCardProps {
  file: Attachment;
}

/**
 * 파일 한 개 카드. 아이콘 + 파일명 + 크기.
 *
 * 누르면 새 탭에서 연다. pdf처럼 브라우저가 그릴 수 있는 형식은 미리보기로 뜨고,
 * zip·xlsx처럼 그럴 수 없는 형식은 브라우저가 알아서 내려받는다.
 * url이 아직 없으면(서버 연동 전) 누를 수 없는 카드로 둔다.
 */
export default function FileCard({ file }: FileCardProps) {
  const Card = file.url ? 'a' : 'div';

  return (
    <Card
      {...(file.url && {
        href: file.url,
        download: file.name,
        target: '_blank',
        rel: 'noreferrer',
      })}
      className="block h-full rounded-xl border border-border bg-background p-3 transition-colors active:bg-muted-foreground/5"
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          EXTENSION_COLORS[getExtension(file.name)] ?? 'bg-primary/10 text-primary'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M14 3v5h5" />
          <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7Z" />
        </svg>
      </span>
      <p className="mt-2.5 line-clamp-2 text-sm font-semibold break-all">{file.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</p>
    </Card>
  );
}

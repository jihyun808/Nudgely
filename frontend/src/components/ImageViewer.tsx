// components/ImageViewer.tsx
import { useEffect } from 'react';

interface ImageViewerProps {
  src: string;
  /** 파일명 등 설명 */
  alt?: string;
  /** 내려받을 때 쓸 파일명. 없으면 다운로드 버튼을 숨긴다 */
  fileName?: string;
  onClose: () => void;
}

/**
 * 사진 확대 보기.
 * 화면을 덮고 사진을 크게 보여주며, 아무 곳이나 누르거나 ESC로 닫는다.
 * 아래쪽에 파일명과 다운로드 버튼을 둔다.
 * 채팅방과 모아보기가 같은 뷰어를 쓴다.
 */
export default function ImageViewer({ src, alt, fileName, onClose }: ImageViewerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt ?? '사진 보기'}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/85 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/15 text-background"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="h-5 w-5"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <img
        src={src}
        alt={alt ?? ''}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />

      {/* 하단: 파일명 + 다운로드. 여기를 눌러도 뷰어가 닫히지 않게 한다 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4"
      >
        {alt && (
          <p className="max-w-[80%] truncate text-center text-xs text-background/80">{alt}</p>
        )}

        {fileName && (
          <a
            href={src}
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-background/15 px-4 py-2 text-sm font-medium text-background transition-colors active:bg-background/25"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="h-4 w-4"
            >
              <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
              <path d="M5 19h14" />
            </svg>
            다운로드
          </a>
        )}
      </div>
    </div>
  );
}

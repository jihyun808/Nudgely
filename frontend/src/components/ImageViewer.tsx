// components/ImageViewer.tsx
import { useEffect } from 'react';

interface ImageViewerProps {
  src: string;
  /** 파일명 등 설명 */
  alt?: string;
  onClose: () => void;
}

/**
 * 사진 확대 보기.
 * 화면을 덮고 사진을 크게 보여주며, 아무 곳이나 누르거나 ESC로 닫는다.
 * 채팅방과 모아보기가 같은 뷰어를 쓴다.
 */
export default function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
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

      {alt && (
        <p className="absolute bottom-6 left-1/2 max-w-[80%] -translate-x-1/2 truncate text-center text-xs text-background/80">
          {alt}
        </p>
      )}
    </div>
  );
}

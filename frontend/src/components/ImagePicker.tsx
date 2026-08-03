// components/ImagePicker.tsx
import { useRef, useState } from 'react';
import { showToast } from '@/stores/toastStore';
import { validateImageFile } from '@/utils/image';

interface ImagePickerProps {
  /** 현재 선택된 이미지 (data URL 또는 서버 URL) */
  imageUrl?: string;
  onChange: (imageUrl?: string) => void;
  /** 스크린리더용 버튼 설명 */
  label: string;
}

/**
 * 원형 이미지 선택기 (채팅방 사진, 프로필 사진에서 함께 쓴다).
 * 고른 파일은 용량·형식·실제 바이트까지 검사한 뒤 미리보기로 보여준다.
 */
export default function ImagePicker({ imageUrl, onChange, label }: ImagePickerProps) {
  const [error, setError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePick = async (file: File | undefined) => {
    // 같은 파일을 다시 선택해도 onChange가 뜨도록 input 값을 비워둔다
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const validationError = await validateImageFile(file);
    setError(validationError ?? undefined);
    if (validationError) {
      onChange(undefined);
      return;
    }

    // 서버 연동 전이므로 미리보기용 data URL로만 들고 있는다
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.onerror = () => {
      setError('사진을 읽지 못했어요. 다시 시도해주세요.');
      showToast('사진을 불러오지 못했어요', { variant: 'warning' });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        aria-label={label}
        className="h-20 w-20 overflow-hidden rounded-full border border-input bg-muted-foreground/5"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">
            +
          </span>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void handlePick(e.target.files?.[0])}
      />

      {error && (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

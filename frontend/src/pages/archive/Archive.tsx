// pages/archive/Archive.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAttachments, fetchGoalProgress } from '@/api/archive';
import { fetchGoal } from '@/api/goal';
import SegmentedTabs from '@/components/SegmentedTabs';
import { Button } from '@/components/ui/button';
import FileGrid from '@/pages/archive/components/FileGrid';
import ImageGrid from '@/pages/archive/components/ImageGrid';
import ProgressTimeline from '@/pages/archive/components/ProgressTimeline';
import type { Attachment, GoalProgress } from '@/types/archive';

type ArchiveTab = 'file' | 'image' | 'progress';

const TABS: { value: ArchiveTab; label: string }[] = [
  { value: 'file', label: '파일' },
  { value: 'image', label: '사진' },
  { value: 'progress', label: '진도' },
];

/**
 * 모아보기.
 * 채팅방에서 주고받은 파일·사진과 목표의 진도 로드맵을 탭으로 나눠 본다.
 * 첨부는 카카오톡 서랍처럼 연-월로 묶는다.
 */
export default function Archive() {
  const { goalId = '' } = useParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState<ArchiveTab>('file');
  const [goalName, setGoalName] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [images, setImages] = useState<Attachment[]>([]);
  const [progress, setProgress] = useState<GoalProgress>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isStale = false;
    Promise.all([
      fetchGoal(goalId),
      fetchAttachments(goalId, 'file'),
      fetchAttachments(goalId, 'image'),
      fetchGoalProgress(goalId),
    ])
      .then(([goal, fileData, imageData, progressData]) => {
        if (isStale) return;
        setGoalName(goal.name);
        setFiles(fileData);
        setImages(imageData);
        setProgress(progressData);
        setHasError(false);
      })
      .catch(() => {
        if (!isStale) setHasError(true);
      })
      .finally(() => {
        if (!isStale) setIsLoading(false);
      });
    return () => {
      isStale = true;
    };
  }, [goalId, reloadKey]);

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background px-6 pt-6 pb-10">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로 가기"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors active:bg-muted-foreground/10"
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
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">모아보기</h1>
          {goalName && (
            <p className="truncate text-xs text-muted-foreground">{goalName}와의 학습 기록</p>
          )}
        </div>
      </header>

      <SegmentedTabs items={TABS} value={tab} onChange={setTab} className="mt-4" />

      {isLoading ? (
        <div className="mt-6 space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-muted-foreground/8" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted-foreground/8" />
        </div>
      ) : hasError ? (
        <div className="mt-20 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">모아보기를 불러오지 못했어요</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              setHasError(false);
              setReloadKey((key) => key + 1);
            }}
          >
            다시 시도
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          {tab === 'file' && <FileGrid files={files} />}
          {tab === 'image' && <ImageGrid images={images} />}
          {tab === 'progress' && progress && <ProgressTimeline progress={progress} />}
        </div>
      )}
    </div>
  );
}

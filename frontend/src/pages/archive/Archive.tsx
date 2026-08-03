// pages/archive/Archive.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchAttachments, fetchGoalProgress } from '@/api/archive';
import { fetchGoal } from '@/api/goal';
import DetailHeader from '@/components/DetailHeader';
import ErrorRetry from '@/components/ErrorRetry';
import SegmentedTabs from '@/components/SegmentedTabs';
import FileGrid from '@/pages/archive/components/FileGrid';
import GoalSettings from '@/pages/archive/components/GoalSettings';
import ImageGrid from '@/pages/archive/components/ImageGrid';
import ProgressTimeline from '@/pages/archive/components/ProgressTimeline';
import type { Attachment, GoalProgress } from '@/types/archive';
import type { GoalDetail } from '@/types/goal';

type ArchiveTab = 'file' | 'image' | 'progress' | 'settings';

const TABS: { value: ArchiveTab; label: string }[] = [
  { value: 'file', label: '파일' },
  { value: 'image', label: '사진' },
  { value: 'progress', label: '진도' },
  { value: 'settings', label: '설정' },
];

/**
 * 모아보기.
 * 채팅방에서 주고받은 파일·사진과 목표의 진도 로드맵을 탭으로 나눠 본다.
 * 첨부는 카카오톡 서랍처럼 연-월로 묶는다.
 */
export default function Archive() {
  const { goalId = '' } = useParams();

  const [tab, setTab] = useState<ArchiveTab>('file');
  const [goal, setGoal] = useState<GoalDetail>();
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
      .then(([goalData, fileData, imageData, progressData]) => {
        if (isStale) return;
        setGoal(goalData);
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
      <DetailHeader title="모아보기" subtitle={goal ? `${goal.name}와의 학습 기록` : undefined} />

      <SegmentedTabs items={TABS} value={tab} onChange={setTab} className="mt-4" />

      {isLoading ? (
        <div className="mt-6 space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-muted-foreground/8" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted-foreground/8" />
        </div>
      ) : hasError ? (
        <ErrorRetry
          message="모아보기를 불러오지 못했어요"
          onRetry={() => {
            setIsLoading(true);
            setHasError(false);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : (
        <div className="mt-6">
          {tab === 'file' && <FileGrid files={files} />}
          {tab === 'image' && <ImageGrid images={images} />}
          {tab === 'progress' && progress && <ProgressTimeline progress={progress} />}
          {tab === 'settings' && goal && <GoalSettings goal={goal} onUpdated={setGoal} />}
        </div>
      )}
    </div>
  );
}

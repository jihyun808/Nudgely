// pages/archive/Archive.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchAttachments, fetchGoalProgress } from '@/api/archive';
import { fetchGoal } from '@/api/goal';
import Skeleton from '@/components/Skeleton';
import DetailHeader from '@/components/DetailHeader';
import ErrorRetry from '@/components/ErrorRetry';
import GearIcon from '@/components/GearIcon';
import SegmentedTabs from '@/components/SegmentedTabs';
import FileGrid from '@/pages/archive/components/FileGrid';
import ImageGrid from '@/pages/archive/components/ImageGrid';
import ProgressTimeline from '@/pages/archive/components/ProgressTimeline';
import type { Attachment, GoalProgress } from '@/types/archive';
import type { GoalDetail } from '@/types/goal';

type ArchiveTab = 'file' | 'image' | 'progress';

/** 주소로 바로 들어올 수 있는 탭 이름 (?tab=progress) */
const TAB_VALUES: ArchiveTab[] = ['file', 'image', 'progress'];

const TABS: { value: ArchiveTab; label: string }[] = [
  { value: 'file', label: '파일' },
  { value: 'image', label: '사진' },
  { value: 'progress', label: '진도' },
];

/**
 * 모아보기.
 * 채팅방에서 주고받은 파일·사진과 목표의 진도 로드맵을 탭으로 나눠 본다.
 * 보고 있는 탭은 주소(`?tab=`)에 남아 특정 탭으로 바로 들어올 수 있다.
 * 첨부는 카카오톡 서랍처럼 연-월로 묶는다.
 */
export default function Archive() {
  const { goalId = '' } = useParams();
  const navigate = useNavigate();
  // 어떤 탭을 볼지 주소에 담아둔다 (마이페이지에서 진도로 바로 들어올 수 있게)
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as ArchiveTab | null;
  const tab = tabParam && TAB_VALUES.includes(tabParam) ? tabParam : 'file';
  const setTab = (next: ArchiveTab) => setSearchParams({ tab: next }, { replace: true });
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
      <DetailHeader
        title="모아보기"
        subtitle={goal ? `${goal.name}와의 학습 기록` : undefined}
        className="-mx-6 px-6"
        action={
          <button
            type="button"
            onClick={() => navigate(`/chat/${goalId}/settings`)}
            aria-label="목표 설정"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted-foreground/10"
          >
            <GearIcon />
          </button>
        }
      />

      <SegmentedTabs items={TABS} value={tab} onChange={setTab} className="mt-4" />

      {isLoading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
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
        </div>
      )}
    </div>
  );
}

// pages/settings/Licenses.tsx
import { useCallback, useState } from 'react';
import DetailHeader from '@/components/DetailHeader';
import ErrorRetry from '@/components/ErrorRetry';
import Skeleton from '@/components/Skeleton';
import { useCachedQuery } from '@/lib/useCachedQuery';

interface OssPackage {
  name: string;
  version: string;
  license: string;
  author: string | null;
  homepage: string | null;
  text: string | null;
}

const EMPTY: OssPackage[] = [];

/**
 * 오픈소스 라이선스 고지.
 *
 * MIT·Apache 등이 배포할 때 저작권 표시와 전문을 함께 전달하도록 요구한다.
 * 목록은 빌드 때 만들어지는 public/oss-licenses.json 에서 온다
 * (900KB 라 번들에 넣지 않고 이 화면을 열 때만 받는다).
 */
export default function Licenses() {
  const [openName, setOpenName] = useState<string>();

  const load = useCallback(async (): Promise<OssPackage[]> => {
    const res = await fetch('/oss-licenses.json');
    if (!res.ok) throw new Error('LICENSES_FETCH_FAILED');
    const data = (await res.json()) as { packages: OssPackage[] };
    return data.packages;
  }, []);

  const { data: packages, isLoading, hasError, reload } = useCachedQuery('oss', load, EMPTY);

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background px-6 pt-safe pb-10">
      <DetailHeader
        title="오픈소스 라이선스"
        subtitle={packages.length > 0 ? `${packages.length}개 패키지` : undefined}
        className="-mx-6 px-6"
      />

      {isLoading ? (
        <div className="mt-6 space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : hasError ? (
        <ErrorRetry message="라이선스 정보를 불러오지 못했어요" onRetry={reload} />
      ) : (
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {packages.map((pkg) => {
            const isOpen = openName === pkg.name;
            return (
              <li key={pkg.name}>
                <button
                  type="button"
                  onClick={() => setOpenName(isOpen ? undefined : pkg.name)}
                  aria-expanded={isOpen}
                  className="flex w-full items-baseline gap-2 py-3 text-left transition-colors active:bg-muted-foreground/5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{pkg.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{pkg.version}</span>
                  <span className="shrink-0 rounded bg-muted-foreground/10 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {pkg.license}
                  </span>
                </button>

                {isOpen && (
                  <div className="pb-4">
                    {pkg.text ? (
                      // 라이선스 전문은 줄바꿈이 의미를 갖는다. 그대로 보여준다
                      <pre className="scroll-touch max-h-80 overflow-auto rounded-lg bg-muted-foreground/5 p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
                        {pkg.text}
                      </pre>
                    ) : (
                      <p className="px-1 text-xs text-muted-foreground">
                        이 패키지는 전문을 함께 배포하지 않아요.
                        {pkg.homepage && ' 아래 주소에서 확인할 수 있어요.'}
                      </p>
                    )}
                    {pkg.homepage && (
                      <a
                        href={pkg.homepage.replace(/^git\+/, '').replace(/\.git$/, '')}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block px-1 text-xs text-primary underline underline-offset-2"
                      >
                        저장소 열기
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

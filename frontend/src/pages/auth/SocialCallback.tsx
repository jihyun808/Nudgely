// pages/auth/SocialCallback.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { socialLogin } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { verifyOAuthState } from '@/lib/oauth';
import { useAuthStore } from '@/stores/authStore';
import type { AuthProvider } from '@/types/auth';

/**
 * 소셜 로그인 콜백.
 * 제공자가 `?code=...&state=...`로 돌려보내면, 코드를 서버에 넘겨 우리 토큰을 받는다.
 */
export default function SocialCallback() {
  const { provider } = useParams<{ provider: AuthProvider }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [error, setError] = useState<string>();

  useEffect(() => {
    let isStale = false;

    const exchangeCode = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!provider || !code) throw new Error('CANCELLED');
      // 우리가 보낸 요청이 맞는지 확인 (CSRF 방지)
      if (!verifyOAuthState(state)) throw new Error('INVALID_STATE');

      const { accessToken, user } = await socialLogin({ provider, code });
      if (isStale) return;
      login(accessToken, user);
      navigate('/home', { replace: true });
    };

    void exchangeCode().catch((reason: Error) => {
      if (isStale) return;
      if (reason.message === 'CANCELLED') setError('로그인이 취소됐어요.');
      else if (reason.message === 'INVALID_STATE')
        setError('잘못된 접근이에요. 다시 시도해주세요.');
      else setError('로그인하지 못했어요. 다시 시도해주세요.');
    });

    return () => {
      isStale = true;
    };
  }, [provider, searchParams, login, navigate]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
      {error ? (
        <>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/landing', { replace: true })}
          >
            시작 화면으로
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">로그인 중이에요...</p>
      )}
    </div>
  );
}

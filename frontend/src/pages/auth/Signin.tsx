import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signin } from '@/api/auth';
import InputField from '@/components/InputField';
import PasswordResetModal from '@/components/PasswordResetModal';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/AuthLayout';
import { useAuthStore } from '@/stores/authStore';

export default function Signin() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      const { accessToken, user } = await signin({ email: email.trim(), password });
      login(accessToken, user);
      navigate('/home', { replace: true });
    } catch {
      setError('이메일 또는 비밀번호를 다시 확인해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="다시 돌아왔군요!"
      subtitle={
        <>
          로그인하고 Buddy와 함께
          <br />
          오늘의 학습을 시작하세요.
        </>
      }
    >
      <div className="mt-10 rounded-2xl bg-background p-6 shadow-lg">
        <InputField
          className="mb-4"
          label="이메일"
          type="email"
          value={email}
          onChange={setEmail}
        />
        <InputField
          className="mb-4"
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
        />
        <div className="text-right">
          <button
            type="button"
            onClick={() => setIsResetOpen(true)}
            className="text-sm text-muted-foreground underline"
          >
            비밀번호 찾기
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button
        className="mt-8 w-full"
        size="lg"
        onClick={() => void handleSubmit()}
        disabled={!canSubmit}
      >
        {isSubmitting ? '로그인 중...' : '로그인'}
      </Button>

      {isResetOpen && <PasswordResetModal onClose={() => setIsResetOpen(false)} />}
    </AuthLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkEmailAvailable, signup } from '@/api/auth';
import InputField from '@/components/InputField';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import { MIN_PASSWORD_LENGTH } from '@/types/auth';
import { NICKNAME_MAX_LENGTH } from '@/types/user';

export default function Signup() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPasswordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const isMismatched = passwordConfirm.length > 0 && password !== passwordConfirm;
  const canSubmit =
    nickname.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password === passwordConfirm &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      // 이미 쓰는 이메일이면 가입 요청 전에 알려준다
      if (!(await checkEmailAvailable(email))) {
        setError('이미 가입된 이메일이에요.');
        return;
      }

      const { accessToken, user } = await signup({
        nickname: nickname.trim(),
        email: email.trim(),
        password,
      });
      login(accessToken, user);
      navigate('/home', { replace: true });
    } catch {
      setError('가입하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="기본 정보 입력" subtitle="가입에 필요한 정보를 입력해주세요.">
      <div className="mt-10 rounded-2xl bg-background p-6 shadow-lg">
        <InputField
          label="닉네임"
          value={nickname}
          onChange={(value) => setNickname(value.slice(0, NICKNAME_MAX_LENGTH))}
        />
        <InputField label="이메일" type="email" value={email} onChange={setEmail} />
        <InputField label="비밀번호" type="password" value={password} onChange={setPassword} />
        {isPasswordTooShort && (
          <p className="-mt-2 mb-4 text-xs text-destructive">
            {MIN_PASSWORD_LENGTH}자 이상 입력해주세요.
          </p>
        )}
        <InputField
          label="비밀번호 확인"
          type="password"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
        />
        {isMismatched && (
          <p className="-mt-2 text-xs text-destructive">비밀번호가 일치하지 않아요.</p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <Button size="sm" onClick={() => void handleSubmit()} disabled={!canSubmit}>
          {isSubmitting ? '가입 중...' : '다음'}
        </Button>
      </div>
    </AuthLayout>
  );
}

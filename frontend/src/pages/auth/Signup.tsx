import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { signup } from '@/api/auth';
import InputField from '@/components/InputField';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/AuthLayout';
import ConsentChecks from '@/pages/auth/components/ConsentChecks';
import { EMPTY_CONSENTS, hasRequiredConsents, type Consents } from '@/pages/auth/consents';
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
  const [consents, setConsents] = useState<Consents>(EMPTY_CONSENTS);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPasswordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const isMismatched = passwordConfirm.length > 0 && password !== passwordConfirm;
  const canSubmit =
    nickname.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password === passwordConfirm &&
    hasRequiredConsents(consents) &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      const { accessToken, user } = await signup({
        nickname: nickname.trim(),
        email: email.trim(),
        password,
        ...consents,
      });
      login(accessToken, user);
      navigate('/home', { replace: true });
    } catch (error) {
      // 이메일 중복은 가입을 눌렀을 때 알게 된다. 미리 물어보는 엔드포인트가
      // 있었지만, 그거 하나로 가입자 명단을 통째로 뽑을 수 있어 없앴다
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (status === 409) setError('이미 가입된 이메일이에요.');
      else if (status === 400) setError('필수 항목에 모두 동의해야 가입할 수 있어요.');
      else if (status === 429) setError('시도가 너무 잦아요. 잠시 후 다시 해주세요.');
      else setError('가입하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="기본 정보 입력" subtitle="가입에 필요한 정보를 입력해주세요.">
      <div className="mt-10 rounded-2xl bg-background p-6 shadow-lg">
        <InputField
          className="mb-4"
          label="닉네임"
          value={nickname}
          onChange={(value) => setNickname(value.slice(0, NICKNAME_MAX_LENGTH))}
        />
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
        {isPasswordTooShort && (
          <p className="-mt-2 mb-4 text-xs text-destructive">
            {MIN_PASSWORD_LENGTH}자 이상 입력해주세요.
          </p>
        )}
        <InputField
          className="mb-4"
          label="비밀번호 확인"
          type="password"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
        />
        {isMismatched && (
          <p className="-mt-2 text-xs text-destructive">비밀번호가 일치하지 않아요.</p>
        )}

        <ConsentChecks value={consents} onChange={setConsents} />

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

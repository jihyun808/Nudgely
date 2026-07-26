import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InputField from '@/components/InputField';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/AuthLayout';
import { useAuthStore } from '@/stores/authStore';

export default function Signin() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    // TODO: 백엔드 연동 시 실제 로그인 API 응답의 토큰/유저로 교체
    // 지금은 백엔드가 없어 임시 토큰/유저로 로그인 상태만 세팅
    login('dev-token', { id: email, email });
    navigate('/home');
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
          label="이메일"
          type="email"
          value={email}
          onChange={setEmail}
        />
        <InputField
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
        />
        <div className="text-right text-sm text-muted-foreground">
          비밀번호 찾기
        </div>
      </div>

      <Button className="mt-8 w-full" size="lg" onClick={handleSubmit}>
        로그인
      </Button>
    </AuthLayout>
  );
}

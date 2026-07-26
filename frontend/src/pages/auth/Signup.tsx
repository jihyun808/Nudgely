import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InputField from '@/components/InputField';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/AuthLayout';

export default function Signup() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const handleSubmit = () => {
    // TODO: 실제 회원가입 (지금은 통과 처리)
    console.log({ nickname, email, password, passwordConfirm });
    navigate('/home');
  };

  return (
    <AuthLayout
      title="기본 정보 입력"
      subtitle="가입에 필요한 정보를 입력해주세요."
    >
      <div className="mt-10 rounded-2xl bg-background p-6 shadow-lg">
        <InputField label="닉네임" value={nickname} onChange={setNickname} />
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
        <InputField
          label="비밀번호 확인"
          type="password"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
        />
      </div>

      <div className="mt-8 flex justify-end">
        <Button size="sm" onClick={handleSubmit}>
          다음
        </Button>
      </div>
    </AuthLayout>
  );
}

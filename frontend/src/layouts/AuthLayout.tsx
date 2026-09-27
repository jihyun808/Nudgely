import type { ReactNode } from 'react';
import BackButton from '@/components/BackButton';

interface AuthLayoutProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}

/**
 * 뒤로가기 + 헤더(제목/설명)를 공유하는 인증 화면 레이아웃.
 * Signin, Signup 등 폼 화면의 공통 껍데기 역할을 한다.
 */
const AuthLayout = ({ title, subtitle, children }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen bg-background px-6 pt-safe">
      <BackButton />

      <div className="mt-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      </div>

      {children}
    </div>
  );
};

export default AuthLayout;

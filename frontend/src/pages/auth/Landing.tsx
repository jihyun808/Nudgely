import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#a8c5f0] to-[#d9e4f5]">
      {/* 상단 그라데이션 아래로 둥근 흰색 시트 */}
      <div className="mt-40 min-h-[calc(100vh-10rem)] rounded-t-[2rem] bg-background px-6 pt-14">
        <div className="text-center">
          <h1 className="text-2xl font-bold">이제는 공부도 AI와 함께!</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            밀착형 AI Buddy와
            <br />
            모든 습관을 똑똑하게 관리하세요.
          </p>
        </div>

        {/* TODO: 각 제공자 SDK로 인가 코드를 받아 socialLogin({ provider, code })에 넘긴다 */}
        <div className="mt-20 flex flex-col gap-3">
          <Button variant="kakao" size="lg">
            카카오로 시작하기
          </Button>
          <Button variant="outline" size="lg">
            구글로 시작하기
          </Button>
        </div>

        <div className="my-8 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          또는
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex items-center justify-center gap-4 text-sm">
          <Link to="/signup">이메일로 회원가입</Link>
          <span className="h-4 w-px bg-border" />
          <Link to="/signin">이메일로 로그인</Link>
        </div>
      </div>
    </div>
  );
}

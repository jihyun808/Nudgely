import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 설정 — 웹 앱을 iOS/Android 껍데기에 담는다.
 *
 * 화면은 지금 React 코드를 그대로 쓴다. 네이티브가 필요한 것은 두 가지뿐이다:
 * 푸시 알림(앱이 꺼져 있을 때 닿는 유일한 길)과 나중의 카메라 권한.
 *
 * ⚠️ 패키징된 앱에는 vite 개발 서버가 없다. '/api' 상대 경로는 앱 내부를
 * 가리켜 아무 데도 닿지 않으므로, 빌드할 때 VITE_API_BASE_URL 로 절대 주소를
 * 넣어야 한다(.env.production 참고).
 */
const config: CapacitorConfig = {
  appId: 'com.nudgely.nudgely',
  appName: 'Nudgely',
  webDir: 'dist',

  // 웹뷰가 뜨기 전 흰 화면 대신 앱 배경색을 보여준다
  backgroundColor: '#ffffff',

  ios: {
    // 노치·홈 인디케이터 영역은 CSS 의 safe-area 변수로 직접 다룬다.
    // 웹뷰가 여백을 자동으로 넣으면 헤더가 두 번 밀린다
    contentInset: 'never',
  },

  android: {
    // 운영 빌드는 https 만 쓴다. 평문 허용은 로컬 백엔드를 볼 때만 잠시 켠다
    allowMixedContent: false,
  },

  // SwiftPM 패키지 이름 충돌을 피한다(플러그인 README 요구사항)
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/messaging': { symlink: true },
        },
      },
    },
  },

  plugins: {
    Keyboard: {
      // 웹뷰를 리사이즈하게 두면 키보드 애니메이션이 끝난 뒤에야 레이아웃이
      // 다시 그려져 입력창이 한 박자 늦게 올라온다. 직접 올린다(lib/native.ts)
      resize: 'none',
      resizeOnFullScreen: true,
    },
  },
};

export default config;

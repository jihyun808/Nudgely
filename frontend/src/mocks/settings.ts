// mocks/settings.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 src/mocks 폴더째 삭제한다.
import type { AppSettings } from '@/types/settings';

export const MOCK_SETTINGS: AppSettings = {
  notifications: {
    enabled: true,
    nudge: true,
    todo: true,
    deadline: true,
  },
  doNotDisturb: {
    enabled: false,
    startHour: 0,
    endHour: 7,
  },
  planner: {
    startHour: 6,
    endHour: 24,
  },
  linkedProviders: ['kakao'],
};

/** 앱 버전 (연동 시 package.json이나 빌드 변수에서 가져온다) */
export const APP_VERSION = '0.1.0';

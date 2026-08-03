// mocks/delay.ts
// API 연동 전 화면 확인용. 서버 붙이면 src/mocks 폴더째 삭제한다.

/** 응답이 오는 것처럼 보이게 잠깐 기다린다 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// mocks/messages.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 src/mocks 폴더째 삭제한다.
// 과거 메시지 불러오기(커서 페이지네이션)를 확인할 수 있도록 여러 날에 걸쳐 넉넉히 넣어뒀다.
import type { ChatMessage, ChatMessageRole } from '@/types/chat';

/** 며칠 전(dayOffset) 특정 시각의 ISO 문자열 */
const at = (dayOffset: number, hour: number, minute: number) => {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

let sequence = 0;
const message = (
  role: ChatMessageRole,
  content: string,
  createdAt: string,
  file?: ChatMessage['file'],
): ChatMessage => ({ id: `m${++sequence}`, role, content, createdAt, file });

/** 오래된 것 → 최신 순 */
export const MOCK_MESSAGES: ChatMessage[] = [
  // 3일 전
  message('assistant', '지수야, 이번 주 목표 같이 정해볼까?', at(3, 9, 0)),
  message('user', '좋아! UI/UX 강의 완주가 목표야', at(3, 9, 2)),
  message('assistant', '좋아. 하루 2강씩이면 3주 안에 끝낼 수 있어.', at(3, 9, 3)),
  message('user', '오케이 그렇게 하자', at(3, 9, 5)),
  message('assistant', '그럼 오늘은 15강부터 시작해보자!', at(3, 9, 6)),
  message('user', '완료했어 ㅎㅎ', at(3, 21, 30)),
  message('assistant', '벌써? 좋아, 내일도 이 페이스 유지해보자 🔥', at(3, 21, 31)),

  // 2일 전
  message('assistant', '오늘은 17강 차례야. 준비됐어?', at(2, 9, 0)),
  message('user', '오늘 좀 바쁜데 저녁에 할게', at(2, 9, 10)),
  message('assistant', '알겠어. 저녁 8시에 다시 알려줄게!', at(2, 9, 11)),
  message('user', '고마워', at(2, 9, 12)),
  message('assistant', '8시야! 17강 시작해볼까?', at(2, 20, 0)),
  message('user', '지금 시작', at(2, 20, 5)),

  // 어제
  message('assistant', '어제 17강 마무리 잘했어. 오늘은 19강이야.', at(1, 9, 0)),
  message('user', '19강 노트 정리도 같이 할래', at(1, 9, 4)),
  message('assistant', '좋아. 노트는 요약 3줄로 남기면 복습에 좋아.', at(1, 9, 5)),
  message('user', '오케이', at(1, 9, 6)),
  message('assistant', '오늘 집중 시간 2시간 넘겼어. 잘하고 있어!', at(1, 22, 0)),

  // 오늘
  message('assistant', '지수야, 오늘 21강 들을 차례야. 준비됐어?', at(0, 9, 0)),
  message('user', '응! 근데 20강 복습하고 싶어', at(0, 9, 2)),
  message('user', '', at(0, 9, 3), { name: '20강_요약노트.pdf', caption: '분석 완료' }),
  message('user', '', at(0, 9, 4), {
    name: '노트_인증.jpg',
    url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMyNTYzRUIiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM3REE2RjUiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNnKSIvPjx0ZXh0IHg9IjIwMCIgeT0iMTYwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+64W47Yq4IOyduOymnTwvdGV4dD48L3N2Zz4=',
  }),
  message('assistant', '정리 잘했어! 핵심 개념 시각화가 특히 좋아.', at(0, 9, 5)),
  message('assistant', '퀴즈 3문항 중 2개 맞혔어. 오답 복습할까?', at(0, 9, 6)),
  message('user', '나중에 볼게, 이따 모아보기에서', at(0, 9, 7)),
];

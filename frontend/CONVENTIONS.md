# 코드 컨벤션 (Frontend: React + TypeScript + Vite)

팀 공통 규칙입니다. 새 파일/코드를 만들 때 이 문서를 기준으로 삼아주세요.

---

## 1. 파일 · 폴더 이름

| 대상 | 규칙 | 예시 |
|------|------|------|
| **컴포넌트 파일** | `PascalCase.tsx` | `Button.tsx`, `UserCard.tsx` |
| **커스텀 훅** | `use` + camelCase | `useAuth.ts`, `useFetchUser.ts` |
| **일반 유틸/함수 파일** | `camelCase.ts` | `formatDate.ts`, `apiClient.ts` |
| **타입 정의 파일** | `camelCase.ts` | `user.ts`, `product.ts` |
| **폴더 이름** | 소문자 (`camelCase` or `kebab-case`) | `components`, `userProfile` |
| **상수 모음 파일** | `camelCase.ts` | `constants.ts` |

> 핵심: **컴포넌트만 대문자로 시작**, 나머지는 소문자로 시작.

---

## 2. 변수 · 함수 · 타입 (코드 안)

| 대상 | 규칙 | 예시 |
|------|------|------|
| 변수 / 함수 | `camelCase` | `const userName`, `function getUser()` |
| 컴포넌트 | `PascalCase` | `function UserCard() {}` |
| 상수 (고정값) | `UPPER_SNAKE_CASE` | `const MAX_COUNT = 10` |
| 타입 / 인터페이스 | `PascalCase` | `interface User`, `type ButtonProps` |
| 불리언 변수 | `is` / `has` / `can` 접두사 | `isLoading`, `hasError` |
| 이벤트 핸들러 | `handle` 접두사 | `handleClick`, `handleSubmit` |
| 핸들러 prop | `on` 접두사 | `onClick`, `onChange` |

---

## 3. 컴포넌트 작성 규칙

- 함수형 컴포넌트 + 화살표 함수 또는 `function` 선언 (팀 내 하나로 통일).
- props 타입은 `타입명 = 컴포넌트명 + Props` 로 정의.
- 한 파일에 컴포넌트 하나 (default export).

```tsx
// src/components/UserCard.tsx
interface UserCardProps {
  name: string;
  isActive?: boolean;
}

function UserCard({ name, isActive = false }: UserCardProps) {
  return <div className={isActive ? "active" : ""}>{name}</div>;
}

export default UserCard;
```

---

## 4. import 순서

위에서 아래로 그룹을 나누고, 그룹 사이엔 빈 줄:

```tsx
// 1. 외부 라이브러리
import { useState } from "react";
import axios from "axios";

// 2. 내부 절대/상대 경로 (컴포넌트, 훅, 유틸)
import UserCard from "../components/UserCard";
import { formatDate } from "../utils/formatDate";

// 3. 타입
import type { User } from "../types/user";

// 4. 스타일
import "./App.css";
```

---

## 5. 폴더별 역할

| 폴더 | 넣는 것 |
|------|---------|
| `components/` | 재사용 UI 조각 (Button, Modal, Header) |
| `pages/` | 라우트(화면) 단위 컴포넌트 (LoginPage, HomePage) |
| `hooks/` | 커스텀 훅 (`useXxx`) |
| `api/` | 서버 통신 함수 (fetch/axios 래핑) |
| `utils/` | 순수 유틸 함수 (날짜 포맷 등) |
| `types/` | 공용 타입 정의 |
| `assets/` | 이미지, 아이콘 등 정적 파일 |

---

## 6. 기타

- **들여쓰기**: 스페이스 2칸.
- **문자열**: 큰따옴표 `"` 또는 작은따옴표 `'` 중 하나로 통일 (Prettier로 자동 처리 추천).
- **세미콜론**: 붙임 (`;`).
- **any 지양**: 타입을 최대한 명시. 정말 모를 때만 `unknown` 사용.
- **커밋 메시지**: `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `chore:` 접두사 (Conventional Commits).
  - 예: `feat: 로그인 페이지 추가`, `fix: 날짜 포맷 버그 수정`

---

## 참고 자료 (표준 스타일 가이드)

- **Airbnb React/JSX Style Guide** (가장 널리 쓰임): https://github.com/airbnb/javascript/tree/master/react
- **Airbnb JavaScript Style Guide**: https://github.com/airbnb/javascript
- **React 공식 문서**: https://react.dev/learn
- **TypeScript 공식 핸드북**: https://www.typescriptlang.org/docs/handbook/intro.html
- **Conventional Commits (커밋 메시지 규칙)**: https://www.conventionalcommits.org/ko/

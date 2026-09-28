# 모바일 앱 (Capacitor)

웹 앱을 iOS/Android 껍데기에 담는다. 화면은 지금 React 코드를 **그대로** 쓴다 —
`frontend/dist` 를 웹뷰에 얹는 방식이라 화면을 다시 만들지 않는다.

네이티브가 필요한 건 두 가지뿐이다: **푸시 알림**(앱이 꺼져 있을 때 선톡이 닿는
유일한 길)과 나중의 **카메라 권한**.

RN 이 아니라 Capacitor 인 이유는 코드가 이미 10,000줄 넘게 있어서다. RN 으로 가면
`<div>` 를 `<View>` 로, Tailwind 를 StyleSheet 로 전부 다시 써야 한다.

---

## 1. 구조

```
frontend/
  capacitor.config.ts   앱 id·이름·웹뷰 설정
  ios/                  Xcode 프로젝트 (Capacitor 가 생성)
  android/              Gradle 프로젝트 (Capacitor 가 생성)
  src/lib/native.ts     네이티브에서만 도는 초기화(상태바·키보드·푸시)
  src/lib/push.ts       알림 권한 → FCM 토큰 → 서버 등록
  src/api/device.ts     POST/DELETE /devices
```

| 명령              | 하는 일                          |
| ---------------- | ------------------------------- |
| `npm run sync`   | 웹 빌드 후 네이티브 프로젝트에 복사    |
| `npm run ios`    | sync 후 Xcode 열기                |
| `npm run android`| sync 후 Android Studio 열기        |

**웹 코드를 고칠 때마다 `npm run sync` 를 해야** 앱에 반영된다. 웹뷰는 `dist` 의
사본을 보고 있고, 원본을 바로 보지 않는다.

`ios/` 와 `android/` 는 저장소에 넣는다(네이티브 설정을 손으로 고칠 일이 생긴다).
안쪽의 웹 빌드 사본과 생성 설정 파일은 Capacitor 가 만든 `.gitignore` 가 걸러낸다.

---

## 2. 서버 주소 — 제일 먼저 막히는 곳

개발할 때는 vite 프록시가 `/api` 를 백엔드로 넘겨준다. **패키징된 앱에는 그 프록시가
없다.** `/api` 는 앱 내부(`capacitor://localhost`)를 가리켜 아무 데도 닿지 않는다.

그래서 빌드할 때 절대 주소를 넣는다 (`frontend/.env.production`):

```
VITE_API_BASE_URL=https://api.example.com/api
```

- **시뮬레이터**로 로컬 백엔드를 볼 때는 `http://localhost:8000/api`
- **실기기**는 공개 HTTPS 주소가 필요하다. 평문 http 는 iOS(ATS)와
  Android(cleartext)가 기본으로 막는다 → **백엔드 배포가 선행 조건이다**

---

## 3. 푸시 — 남은 수동 설정

코드는 다 있다. **Firebase 설정 파일만 넣으면 동작한다.**

### 3.1 Firebase 프로젝트

콘솔에서 프로젝트를 만들고 앱 두 개를 등록한다. 번들 id 는
`capacitor.config.ts` 의 `appId` 와 **정확히 같아야 한다**: `com.nudgely.nudgely`

| 받는 파일                     | 넣는 곳                              |
| --------------------------- | ----------------------------------- |
| `google-services.json`      | `frontend/android/app/`             |
| `GoogleService-Info.plist`  | `frontend/ios/App/App/` (Xcode 로 추가) |
| 서비스 계정 키 JSON            | 서버 `.env` — 로컬은 `FCM_CREDENTIALS_FILE`(경로), 배포는 `FCM_CREDENTIALS_JSON`(내용) |

> ⚠️ `GoogleService-Info.plist` 는 Finder 로 폴더에 넣는 것만으로는 안 된다.
> Xcode 에서 App 타겟에 **추가**해야 번들에 들어간다. 없으면 앱이 실행 즉시 죽는다.

### 3.2 Android Gradle

`google-services.json` 을 넣은 **뒤에** 아래를 추가한다. 파일 없이 먼저 추가하면
빌드가 실패한다.

`android/build.gradle` 의 `dependencies`:

```gradle
classpath 'com.google.gms:google-services:4.4.2'
```

`android/app/build.gradle` 맨 아래:

```gradle
apply plugin: 'com.google.gms.google-services'
```

### 3.3 iOS

- **애플 개발자 계정이 필요하다**(연 $99). APNs 키를 발급해 Firebase 콘솔에
  올려야 iOS 푸시가 동작한다. Firebase 만으로는 안 된다.
- Xcode 에서 App 타겟 → Signing & Capabilities → **Push Notifications** 추가
- **시뮬레이터로는 푸시를 받을 수 없다.** 실기기여야 한다.

Android 는 계정 없이 바로 되므로 **Android 부터 확인하는 편이 빠르다.**

---

## 4. 권한을 언제 묻는가

`enablePush()` 를 **로그인 직후**에 부른다(`stores/authStore.ts`). 앱을 켜자마자
묻지 않는다 — 무엇에 쓰는지 모르는 채로 받는 물음은 대개 거절당하고, iOS 는 한 번
거절당하면 앱이 다시 묻지 못한다(설정 앱으로 보내야 한다).

거절당해도 앱은 그대로 쓴다. 푸시가 없을 뿐이다.

로그아웃할 때는 `disablePush()` 가 등록을 지운다. **안 지우면 그 기기에 이전
사용자의 선톡이 계속 뜬다** — 기기를 빌려준 사람에게 남의 공부 알림이 간다.

FCM 토큰은 재설치·오랜 미사용으로 조용히 바뀐다. 앱을 열 때마다 등록하고
(`lib/native.ts`), 발급이 갱신되면 `tokenReceived` 리스너가 다시 등록한다.
이게 없으면 어느 날부터 푸시가 조용히 끊긴다.

---

## 5. Xcode Cloud

`ci_scripts/ci_post_clone.sh` 가 저장소를 받은 직후 `npm ci` → `npm run build` →
`cap sync ios` 를 돌린다. node_modules 를 커밋하지 않는데 Capacitor 의 SPM 패키지가
그 경로를 가리켜서, 이게 없으면 "package ... doesn't exist in file system" 으로 실패한다.

서버 주소는 `frontend/.env.production` 에서 온다. 이 파일은 **커밋한다** —
비밀이 아니고(앱 바이너리에 박혀 나간다) 빌드 머신에도 있어야 한다.

## 6. 지금 상태

| | 상태 |
| --- | --- |
| Capacitor 껍데기·iOS/Android 프로젝트 | ✅ |
| 웹 빌드 → 네이티브 동기화 | ✅ |
| 푸시 코드(권한·토큰·등록·해제) | ✅ |
| 서버 푸시 발송 | ✅ (api.md §5.3) |
| Firebase 설정 파일 | ⬜ 수동 |
| 백엔드 배포 → `VITE_API_BASE_URL` | ⬜ 실기기 전제 조건 |
| 앱 아이콘·스플래시 | ⬜ |
| 스토어 배포(TestFlight·내부 테스트) | ⬜ |

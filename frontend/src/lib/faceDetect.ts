// lib/faceDetect.ts
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * 기기에서만 도는 얼굴 감지. 집중 인증이 "자리에 있나" 를 판정하는 근거다.
 *
 * 프레임은 어디로도 나가지 않는다. 여기서 보고 버린다.
 *
 * wasm·모델은 CDN 에서 받는다. 앱에 넣으면 13MB 가 붙는데, 이 앱은 AI 대화부터
 * 네트워크가 있어야 돌아가므로 번들을 키울 이유가 없다. 받아온 뒤로는 캐시된다.
 */
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
/** 230KB 라 앱에 넣는다. 네트워크 변수를 하나 줄인다 */
const MODEL_URL = '/models/blaze_face_short_range.tflite';

let detector: FaceDetector | undefined;
let loading: Promise<FaceDetector> | undefined;

/** 한 번만 받아 재사용한다. 세션마다 다시 받으면 매번 몇 초씩 기다린다 */
export function loadFaceDetector(): Promise<FaceDetector> {
  if (detector) return Promise.resolve(detector);
  loading ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const create = (delegate: 'GPU' | 'CPU') =>
      FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
    // 웹뷰에서 GPU 가 안 잡히는 기기가 있다. 느려도 도는 쪽으로 떨어진다
    detector = await create('GPU').catch(() => create('CPU'));
    return detector;
  })();
  return loading;
}

export interface FaceResult {
  hasFace: boolean;
  /** 가장 또렷하게 잡힌 얼굴의 점수(0~1). 없으면 0 */
  confidence: number;
}

/** 지금 화면에 사람이 있는지. 실패하면 '없음' 이 아니라 던진다 — 호출부가 판단한다 */
export function detectFace(detector: FaceDetector, video: HTMLVideoElement): FaceResult {
  const { detections } = detector.detect(video);
  const best = detections.reduce((max, d) => Math.max(max, d.categories[0]?.score ?? 0), 0);
  return { hasFace: detections.length > 0, confidence: best };
}

/** 세션이 끝나면 놓아준다. GPU 자원을 쥐고 있다 */
export function releaseFaceDetector(): void {
  detector?.close();
  detector = undefined;
  loading = undefined;
}

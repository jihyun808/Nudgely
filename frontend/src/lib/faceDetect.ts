// lib/faceDetect.ts
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/** 기기에서만 도는 얼굴 판정. 프레임은 여기서 보고 버린다 */
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const MODEL_URL = '/models/face_landmarker.task';

/** blendshape 점수가 이 값을 넘으면 눈을 감은 것으로 본다 */
const EYE_CLOSED = 0.5;

let landmarker: FaceLandmarker | undefined;
let loading: Promise<FaceLandmarker> | undefined;

export function loadFaceDetector(): Promise<FaceLandmarker> {
  if (landmarker) return Promise.resolve(landmarker);
  loading ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const create = (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'IMAGE',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    // 웹뷰에서 GPU 가 안 잡히는 기기가 있다
    landmarker = await create('GPU').catch(() => create('CPU'));
    return landmarker;
  })();
  return loading;
}

export interface FaceResult {
  hasFace: boolean;
  eyesClosed: boolean;
  /** 고개 각도(도). 위를 보면 +, 숙이면 − */
  pitch: number;
}

const ABSENT: FaceResult = { hasFace: false, eyesClosed: false, pitch: 0 };

/** 4x4 변환 행렬(열 우선)의 [2][1] 성분이 x축 회전을 담는다 */
function pitchOf(matrix: number[]): number {
  return (Math.asin(-Math.max(-1, Math.min(1, matrix[9]))) * 180) / Math.PI;
}

export function detectFace(detector: FaceLandmarker, video: HTMLVideoElement): FaceResult {
  const result = detector.detect(video);
  const shapes = result.faceBlendshapes?.[0]?.categories;
  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  if (!shapes || !matrix) return ABSENT;

  const isClosed = (name: string) =>
    (shapes.find((category) => category.categoryName === name)?.score ?? 0) > EYE_CLOSED;

  return {
    hasFace: true,
    eyesClosed: isClosed('eyeBlinkLeft') && isClosed('eyeBlinkRight'),
    pitch: pitchOf(matrix),
  };
}

export function releaseFaceDetector(): void {
  landmarker?.close();
  landmarker = undefined;
  loading = undefined;
}

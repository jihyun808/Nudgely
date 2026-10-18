// pages/verify/useCameraVerify.ts
import { App } from '@capacitor/app';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  finishCameraSession,
  interruptCameraSession,
  sendFocusChecks,
  startCameraSession,
  type CameraSession,
  type FocusCheck,
} from '@/api/focus';
import { detectFace, loadFaceDetector, releaseFaceDetector } from '@/lib/faceDetect';
import { showToast } from '@/stores/toastStore';

/** 판정 주기(초) */
const SAMPLE_SECONDS = 10;
/** 이만큼 모이면 서버로 한 번에 보낸다 */
const BATCH_SIZE = 6;

type Phase = 'idle' | 'preparing' | 'running' | 'done';

/** 실패한 단계를 그대로 보여준다. 한 문구로 덮으면 원인을 못 찾는다 */
function describeStartError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') return '카메라 권한이 필요해요. 설정에서 허용해주세요.';
    if (err.name === 'NotFoundError') return '쓸 수 있는 카메라가 없어요.';
    return `카메라를 열지 못했어요 (${err.name})`;
  }
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    return message ?? `세션을 시작하지 못했어요 (${code ?? err.response?.status ?? '네트워크'})`;
  }
  if (err instanceof Error) return `인식 준비에 실패했어요: ${err.message}`;
  return '카메라를 열지 못했어요.';
}

export function useCameraVerify(goalId: string | undefined) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [isPresent, setIsPresent] = useState(true);
  const [session, setSession] = useState<CameraSession>();
  const [error, setError] = useState<string>();

  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef<FocusCheck[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const secondsRef = useRef(0);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    releaseFaceDetector();
  }, []);

  const flush = useCallback(async (force = false) => {
    const id = sessionIdRef.current;
    if (!id || pendingRef.current.length === 0) return;
    if (!force && pendingRef.current.length < BATCH_SIZE) return;

    const samples = pendingRef.current;
    pendingRef.current = [];
    try {
      setSession(await sendFocusChecks(id, samples));
    } catch {
      pendingRef.current = [...samples, ...pendingRef.current];
    }
  }, []);

  const start = useCallback(async () => {
    setError(undefined);
    setPhase('preparing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await loadFaceDetector();

      const started = await startCameraSession({
        startedAt: new Date().toISOString(),
        goalId,
        consented: true,
      });
      sessionIdRef.current = started.id;
      setSession(started);
      setSeconds(0);
      secondsRef.current = 0;
      setPhase('running');
    } catch (err) {
      stopCamera();
      setPhase('idle');
      setError(describeStartError(err));
    }
  }, [goalId, stopCamera]);

  const stop = useCallback(async () => {
    const id = sessionIdRef.current;
    stopCamera();
    setPhase('done');
    if (!id) return;
    await flush(true);
    try {
      setSession(await finishCameraSession(id, secondsRef.current));
    } catch {
      showToast('결과를 저장하지 못했어요', { variant: 'warning' });
    }
    sessionIdRef.current = null;
  }, [flush, stopCamera]);

  useEffect(() => {
    if (phase !== 'running') return;
    const tick = setInterval(async () => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current % SAMPLE_SECONDS !== 0) return;

      const video = videoRef.current;
      if (!video) return;
      try {
        const result = detectFace(await loadFaceDetector(), video);
        setIsPresent(result.hasFace);
        pendingRef.current.push({
          status: result.hasFace ? 'focus' : 'absent',
          at: new Date().toISOString(),
          confidence: result.confidence,
        });
        void flush();
      } catch {
        // 한 번 못 읽은 건 다음 주기에 다시 본다
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [phase, flush]);

  // 화면이 내려가면 판정도 멈춘다. 모르고 계속하면 점수가 안 오른다
  useEffect(() => {
    if (phase !== 'running') return;
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) return;
      const id = sessionIdRef.current;
      stopCamera();
      setPhase('done');
      sessionIdRef.current = null;
      if (id) void interruptCameraSession(id, secondsRef.current).catch(() => {});
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [phase, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  return { videoRef, phase, seconds, isPresent, session, error, start, stop };
}

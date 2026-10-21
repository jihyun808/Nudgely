// pages/verify/useCameraVerify.ts
import { KeepAwake } from '@capacitor-community/keep-awake';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  finishCameraSession,
  pauseCameraSession,
  resumeCameraSession,
  sendFocusChecks,
  startCameraSession,
  type CameraSession,
  type FocusCheck,
} from '@/api/focus';
import { beep, closeBeep, unlockBeep } from '@/lib/beep';
import {
  detectFace,
  loadFaceDetector,
  releaseFaceDetector,
  type FaceResult,
} from '@/lib/faceDetect';
import { showToast } from '@/stores/toastStore';

/** 기기 판정 주기(초). 눈 감김을 보려면 촘촘해야 한다 */
const CHECK_SECONDS = 2;
/** 서버 샘플 주기(초) */
const SAMPLE_SECONDS = 10;
const BATCH_SIZE = 6;
/** 이만큼 연속이어야 문제로 본다(서버 집계와 같은 기준) */
const MIN_RUN = 3;
const CALIBRATION_SECONDS = 30;
const MIN_CALIBRATION_SAMPLES = 5;
/** 기준 자세보다 이만큼(도) 더 숙이면 딴 데 보는 것으로 본다 */
const PITCH_DROP = 30;
const DROWSY_SECONDS = 10;
type Phase = 'idle' | 'preparing' | 'running';

/** 실패한 단계를 그대로 보여준다. 한 문구로 덮으면 원인을 못 찾는다 */
function describeStartError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') return '카메라 권한이 필요해요. 설정에서 허용해주세요.';
    if (err.name === 'NotFoundError') return '쓸 수 있는 카메라가 없어요.';
    return `카메라를 열지 못했어요 (${err.name})`;
  }
  if (isAxiosError(err)) {
    const data = err.response?.data as { code?: string; message?: string } | undefined;
    return (
      data?.message ??
      `세션을 시작하지 못했어요 (${data?.code ?? err.response?.status ?? '네트워크'})`
    );
  }
  if (err instanceof Error) return `인식 준비에 실패했어요: ${err.message}`;
  return '카메라를 열지 못했어요.';
}

function openCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
}

/** 가운데 값. 잠깐 흔들린 자세에 기준이 끌려가지 않는다 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function useCameraVerify(goalId: string | undefined) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [session, setSession] = useState<CameraSession>();
  /** 첫 묶음이 올라가기 전에는 점수가 없다. 0% 로 보이면 안 된다 */
  const [isScored, setIsScored] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [wasInterrupted, setWasInterrupted] = useState(false);
  const [error, setError] = useState<string>();

  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef<FocusCheck[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const secondsRef = useRef(0);
  const missRef = useRef(0);
  const closedRef = useRef(0);
  const droopRef = useRef(0);
  const calibrationRef = useRef<number[]>([]);
  const baselineRef = useRef<number | null>(null);
  /** 이번 샘플 구간에서 한 번이라도 흐트러졌는지 */
  const sawTroubleRef = useRef(false);
  /** 백그라운드에 있는 동안은 시간도 판정도 멈춘다 */
  const isAwayRef = useRef(false);

  const stopCamera = useCallback(() => {
    closeBeep();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    releaseFaceDetector();
    void KeepAwake.allowSleep().catch(() => {});
  }, []);

  const flush = useCallback(async (id: string, force = false) => {
    if (pendingRef.current.length === 0) return;
    if (!force && pendingRef.current.length < BATCH_SIZE) return;

    const samples = pendingRef.current;
    pendingRef.current = [];
    try {
      setSession(await sendFocusChecks(id, samples));
      setIsScored(true);
    } catch {
      pendingRef.current = [...samples, ...pendingRef.current];
    }
  }, []);

  const resetView = useCallback(() => {
    setPhase('idle');
    setSeconds(0);
    setSession(undefined);
    setIsScored(false);
    setIsCalibrating(false);
    setNotice(undefined);
  }, []);

  /** 카메라를 끄고 화면을 되돌린다. 마저 보낼 세션 id 와 기록 시간을 돌려준다 */
  const endSession = useCallback(() => {
    const id = sessionIdRef.current;
    const until = secondsRef.current;
    sessionIdRef.current = null;
    secondsRef.current = 0;
    stopCamera();
    resetView();
    return { id, until };
  }, [resetView, stopCamera]);

  const updateNotice = useCallback((next: string | undefined) => {
    // 바뀌는 순간에만 울린다. 매 판정마다 울리면 시끄럽다
    setNotice((was) => {
      if (next && next !== was) {
        beep();
        void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      }
      return next;
    });
  }, []);

  const judge = useCallback(
    (result: FaceResult) => {
      const { hasFace, eyesClosed, pitch } = result;

      // 자리에 있는 동안만 자세를 익힌다
      if (hasFace && baselineRef.current === null) {
        calibrationRef.current.push(pitch);
        if (
          secondsRef.current >= CALIBRATION_SECONDS &&
          calibrationRef.current.length >= MIN_CALIBRATION_SAMPLES
        ) {
          baselineRef.current = median(calibrationRef.current);
          setIsCalibrating(false);
        }
      }

      const baseline = baselineRef.current;
      missRef.current = hasFace ? 0 : missRef.current + 1;
      closedRef.current = hasFace && eyesClosed ? closedRef.current + 1 : 0;
      droopRef.current =
        hasFace && baseline !== null && pitch < baseline - PITCH_DROP ? droopRef.current + 1 : 0;

      let next: string | undefined;
      if (missRef.current >= MIN_RUN) next = '자리에 안 보여요';
      else if (closedRef.current * CHECK_SECONDS >= DROWSY_SECONDS) next = '졸고 있나요?';
      else if (droopRef.current >= MIN_RUN) next = '딴짓 중인가요?';
      updateNotice(next);
      if (next) sawTroubleRef.current = true;

      // 구간에 한 번이라도 흐트러졌으면 absent 한 줄
      if (secondsRef.current % SAMPLE_SECONDS !== 0) return;
      pendingRef.current.push({
        status: sawTroubleRef.current ? 'absent' : 'focus',
        at: new Date().toISOString(),
      });
      sawTroubleRef.current = false;
      if (sessionIdRef.current) void flush(sessionIdRef.current);
    },
    [flush, updateNotice],
  );

  const start = useCallback(async () => {
    setError(undefined);
    setPhase('preparing');
    // 버튼을 누른 이 순간에 열어야 iOS 가 소리를 허용한다
    unlockBeep();
    try {
      const stream = await openCamera();
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
      // 화면이 잠기면 판정이 멈추고 세션이 끝난다
      await KeepAwake.keepAwake().catch(() => {});

      sessionIdRef.current = started.id;
      secondsRef.current = 0;
      pendingRef.current = [];
      missRef.current = 0;
      closedRef.current = 0;
      droopRef.current = 0;
      calibrationRef.current = [];
      baselineRef.current = null;
      sawTroubleRef.current = false;
      isAwayRef.current = false;

      resetView();
      setSession(started);
      setIsCalibrating(true);
      setWasInterrupted(false);
      setPhase('running');
    } catch (err) {
      stopCamera();
      setPhase('idle');
      setError(describeStartError(err));
    }
  }, [goalId, resetView, stopCamera]);

  const stop = useCallback(async () => {
    const { id, until } = endSession();
    if (!id) return;
    await flush(id, true);
    try {
      await finishCameraSession(id, until);
    } catch {
      showToast('결과를 저장하지 못했어요', { variant: 'warning' });
    }
  }, [endSession, flush]);

  useEffect(() => {
    if (phase !== 'running') return;
    const tick = setInterval(async () => {
      if (isAwayRef.current) return;
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current % CHECK_SECONDS !== 0) return;

      const video = videoRef.current;
      if (!video) return;
      try {
        judge(detectFace(await loadFaceDetector(), video));
      } catch {
        // 한 번 못 읽은 건 다음 주기에 다시 본다
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [phase, judge]);

  /** 백그라운드에 다녀오면 OS 가 카메라를 끊어 둔다. 살아 있으면 재생만 다시 한다 */
  const reviveCamera = useCallback(async () => {
    const isLive = streamRef.current
      ?.getVideoTracks()
      .some((track) => track.readyState === 'live' && !track.muted);
    if (!isLive) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = await openCamera();
      if (videoRef.current) videoRef.current.srcObject = streamRef.current;
    }
    await videoRef.current?.play();
  }, []);

  // 끊는 건 서버가 센다. iOS 는 백그라운드에서 JS 타이머를 멈춰서 폰이 세면 못 끊는다
  useEffect(() => {
    if (phase !== 'running') return;

    const handle = App.addListener('appStateChange', async ({ isActive }) => {
      const id = sessionIdRef.current;
      if (!id) return;

      if (!isActive) {
        isAwayRef.current = true;
        await flush(id, true);
        await pauseCameraSession(id, secondsRef.current).catch(() => {});
        return;
      }

      // 서버에 못 닿으면 일단 이어 간다. 기록을 버리는 쪽보다 낫다
      const isAlive = await resumeCameraSession(id).catch(() => true);
      if (!isAlive) {
        endSession();
        setWasInterrupted(true);
        return;
      }
      try {
        await reviveCamera();
      } catch {
        endSession();
        setError('카메라를 다시 켜지 못했어요. 다시 시작해주세요.');
        return;
      }
      missRef.current = 0;
      isAwayRef.current = false;
    });

    return () => {
      void handle.then((h) => h.remove());
    };
  }, [phase, endSession, flush, reviveCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  return {
    videoRef,
    phase,
    seconds,
    isScored,
    isCalibrating,
    notice,
    wasInterrupted,
    dismissInterrupted: () => setWasInterrupted(false),
    session,
    error,
    start,
    stop,
  };
}

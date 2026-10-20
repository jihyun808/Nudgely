// lib/beep.ts
let context: AudioContext | undefined;

/** 사용자 탭 안에서 불러야 iOS 가 소리를 허용한다 */
export function unlockBeep(): void {
  context ??= new AudioContext();
  void context.resume();
}

export function beep(): void {
  if (!context) return;
  const now = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();

  osc.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

  osc.connect(gain).connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

export function closeBeep(): void {
  void context?.close();
  context = undefined;
}

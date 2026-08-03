// utils/sound.ts

/**
 * 짧은 알림음.
 * 오디오 파일 없이 브라우저 내장 오실레이터로 '삐-' 소리를 낸다.
 * 사용자가 화면을 한 번이라도 누른 뒤에만 소리가 나는 브라우저가 있어, 실패해도 조용히 넘어간다.
 */
export function playBeep(times = 2) {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const startAt = context.currentTime;

    for (let i = 0; i < times; i += 1) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, startAt + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.2, startAt + i * 0.3 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + i * 0.3 + 0.18);

      oscillator.start(startAt + i * 0.3);
      oscillator.stop(startAt + i * 0.3 + 0.2);
    }

    // 재생이 끝나면 오디오 컨텍스트를 닫아 자원을 돌려준다
    window.setTimeout(() => void context.close(), times * 300 + 400);
  } catch {
    // 소리를 못 내도 타이머 동작에는 영향이 없다
  }
}

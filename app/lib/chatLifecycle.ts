export const CHAT_LIFETIME_MS = 5 * 60 * 60 * 1000; // 활동 시작 후 5시간

export function getChatDestroyAt(scheduledAt: string): number {
  return new Date(scheduledAt).getTime() + CHAT_LIFETIME_MS;
}

export function isChatDestroyed(scheduledAt: string): boolean {
  return Date.now() >= getChatDestroyAt(scheduledAt);
}

export function formatCountdown(destroyAt: number): string {
  const remainingMs = destroyAt - Date.now();
  if (remainingMs <= 0) return "폭파됨";

  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}분 후 폭파`;
  return `${hours}시간 ${minutes}분 후 폭파`;
}

// "다이너마이트 타이머" 같은 큰 시계형 표시용 (HH:MM:SS)
export function formatHMS(destroyAt: number): string {
  const remainingMs = Math.max(0, destroyAt - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

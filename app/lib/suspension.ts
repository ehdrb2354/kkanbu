export function isSuspended(suspendedUntil: string | null): boolean {
  return !!suspendedUntil && new Date(suspendedUntil).getTime() > Date.now();
}

export function formatSuspensionRemaining(suspendedUntil: string): string {
  const ms = new Date(suspendedUntil).getTime() - Date.now();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours <= 0) return `${Math.max(1, minutes)}분`;
  return `${hours}시간 ${minutes}분`;
}

/** 화면 표시용 포맷터. 전부 한국어 관습을 따른다. */

/** 1234567 → "123만". 유튜브 한국어 UI와 같은 방식. */
export function formatViews(n: number | null | undefined): string {
  if (n === null || n === undefined) return "조회수 -";
  if (n >= 100_000_000) return "조회수 " + trim(n / 100_000_000) + "억";
  if (n >= 10_000) return "조회수 " + trim(n / 10_000) + "만";
  return "조회수 " + n.toLocaleString("ko-KR");
}

function trim(v: number): string {
  return v >= 100 ? String(Math.floor(v)) : String(Math.round(v * 10) / 10);
}

/** 3723 → "1:02:03", 158 → "2:38" */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
}

/** "3개월 전" 같은 상대 시각. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);

  if (days < 1) return "오늘";
  if (days < 7) return days + "일 전";
  if (days < 31) return Math.floor(days / 7) + "주 전";
  if (days < 365) return Math.floor(days / 30) + "개월 전";
  return Math.floor(days / 365) + "년 전";
}

/** 마지막 방문 이후 올라온 영상인지. NEW 배지 판정에 쓴다. */
export function isNewSince(publishedAt: string, lastVisit: number | null): boolean {
  if (!lastVisit) return false;
  return new Date(publishedAt).getTime() > lastVisit;
}

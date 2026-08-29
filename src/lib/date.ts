/**
 * 달력용 날짜 도구.
 *
 * Postgres 의 date 컬럼은 "YYYY-MM-DD" 문자열로 온다. 이걸 그대로 다루고,
 * 계산이 필요할 때만 UTC 기준 Date 로 바꾼다. 로컬 타임존으로 파싱하면
 * 한국(UTC+9)에서 자정 근처 날짜가 하루씩 밀리는 사고가 난다.
 */

export type DateKey = string; // YYYY-MM-DD

export function toKey(d: Date): DateKey {
  return d.toISOString().slice(0, 10);
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toKey(d);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return toKey(d).slice(0, 7);
}

/** 오늘(한국 기준). 서버가 UTC로 돌아도 한국 날짜를 보여준다. */
export function todayKey(): DateKey {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function currentMonth(): string {
  return todayKey().slice(0, 7);
}

/** 달력에 그릴 주 단위 격자. 일요일 시작, 앞뒤 달의 날짜로 채운다. */
export function monthGrid(month: string): DateKey[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));

  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  const end = new Date(last);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  const weeks: DateKey[][] = [];
  let cursor = toKey(start);
  const endKey = toKey(end);

  while (cursor <= endKey) {
    const week: DateKey[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** "2026-09" → "2026년 9월" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** "2026-09-05" → "9월 5일 (금)" */
export function dayLabel(key: DateKey): string {
  const d = fromKey(key);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${dow})`;
}

/** "19:30:00" → "19:30" */
export function timeLabel(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

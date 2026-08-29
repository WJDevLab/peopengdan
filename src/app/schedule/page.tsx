import type { Metadata } from "next";
import Link from "next/link";
import { Calendar } from "@/components/schedule/Calendar";
import { PEOPLE, type PersonSlug } from "@/lib/constants";
import { addMonths, currentMonth, monthGrid, monthLabel } from "@/lib/date";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { EventItem } from "@/types/db";

export const metadata: Metadata = { title: "일정 · 퍼스트펭귄단" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 현재 필터를 유지한 채 한 항목만 바꾼 링크. */
function hrefWith(month: string, people: string[], patch: { month?: string; people?: string[] }) {
  const params = new URLSearchParams();
  const m = patch.month ?? month;
  const p = patch.people ?? people;
  if (m !== currentMonth()) params.set("month", m);
  if (p.length) params.set("people", p.join(","));
  const qs = params.toString();
  return qs ? `/schedule?${qs}` : "/schedule";
}

export default async function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const month = (one(sp.month) ?? currentMonth()).slice(0, 7);
  const selected = (one(sp.people) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is PersonSlug => PEOPLE.some((p) => p.slug === s));

  const db = await createClient();
  const { isAdmin } = await getViewer();

  // 앞뒤 달의 칸까지 그리므로 격자 전체 범위로 조회한다.
  const grid = monthGrid(month);
  const gridStart = grid[0][0];
  const gridEnd = grid[grid.length - 1][6];

  let events: EventItem[] = [];
  let loadError: string | null = null;

  try {
    // 인물 필터가 걸리면 해당 인물이 붙은 일정 id 를 먼저 추린다.
    let allowedIds: string[] | null = null;
    if (selected.length) {
      const { data } = await db.from("event_people").select("event_id").in("person", selected);
      allowedIds = [...new Set((data ?? []).map((r) => r.event_id as string))];
      if (allowedIds.length === 0) allowedIds = ["00000000-0000-0000-0000-000000000000"];
    }

    let q = db
      .from("events")
      .select("id, title, description, kind, starts_on, ends_on, start_time, location, link")
      .lte("starts_on", gridEnd)
      // 하루짜리(ends_on null)와 여러 날짜리를 한 번에 거른다.
      .or(`ends_on.gte.${gridStart},and(ends_on.is.null,starts_on.gte.${gridStart})`);

    if (allowedIds) q = q.in("id", allowedIds);

    const { data: rows, error } = await q.order("starts_on");
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Omit<EventItem, "people">[];

    const { data: peopleRows } = await db
      .from("event_people")
      .select("event_id, person")
      .in("event_id", list.map((e) => e.id));

    const byEvent = new Map<string, PersonSlug[]>();
    for (const r of peopleRows ?? []) {
      const arr = byEvent.get(r.event_id) ?? [];
      arr.push(r.person as PersonSlug);
      byEvent.set(r.event_id, arr);
    }

    events = list.map((e) => ({ ...e, people: byEvent.get(e.id) ?? [] }));
  } catch (e) {
    loadError = (e as Error).message;
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>일정</h1>
        <span className="sub">펭귄들의 방송 · 공연 · 업로드</span>
        <div className="spacer" />
        {isAdmin && (
          <Link className="btn" href="/schedule/edit">
            일정 추가
          </Link>
        )}
      </div>

      <div className="cal-bar">
        <Link className="btn-mini" href={hrefWith(month, selected, { month: addMonths(month, -1) })}>
          ← 이전
        </Link>
        <span className="cal-title">{monthLabel(month)}</span>
        <Link className="btn-mini" href={hrefWith(month, selected, { month: addMonths(month, 1) })}>
          다음 →
        </Link>
        <Link className="btn-mini" href={hrefWith(currentMonth(), selected, {})}>
          오늘
        </Link>

        <span className="filter-sep" aria-hidden="true" />
        <span className="filter-label">인물</span>

        <Link className="chip" data-active={selected.length === 0} href={hrefWith(month, [], {})}>
          전체
        </Link>
        {PEOPLE.map((p) => {
          const on = selected.includes(p.slug);
          // 눌러서 켜고 끄는 다중 선택. 여러 명을 겹쳐 볼 수 있다.
          const next = on ? selected.filter((s) => s !== p.slug) : [...selected, p.slug];
          return (
            <Link key={p.slug} className="chip" data-active={on} href={hrefWith(month, selected, { people: next })}>
              {p.name}
            </Link>
          );
        })}
      </div>

      {loadError ? (
        <div className="empty">
          <span className="glyph" aria-hidden="true">
            🧊
          </span>
          <h2>일정을 불러오지 못했습니다</h2>
          <p style={{ opacity: 0.7, fontSize: ".8rem" }}>{loadError}</p>
        </div>
      ) : (
        <>
          <Calendar month={month} events={events} isAdmin={isAdmin} />
          {events.length === 0 && (
            <p style={{ padding: "0 1.8rem 2rem", color: "var(--muted)", fontSize: ".87rem" }}>
              이 달에는 등록된 일정이 없습니다.
              {selected.length > 0 && " 인물 필터를 풀면 더 보일 수 있습니다."}
            </p>
          )}
        </>
      )}
    </main>
  );
}

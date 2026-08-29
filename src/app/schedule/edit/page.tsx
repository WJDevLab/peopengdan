import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EVENT_KINDS, PEOPLE } from "@/lib/constants";
import { createEvent, updateEvent } from "@/lib/actions";
import { todayKey } from "@/lib/date";
import { createClient, getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "일정 편집 · 퍼스트펭귄단" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function EventEditPage({ searchParams }: { searchParams: SearchParams }) {
  const { isAdmin } = await getViewer();
  if (!isAdmin) redirect("/schedule");

  const id = one((await searchParams).id);
  let event: {
    id: string;
    title: string;
    description: string | null;
    kind: string;
    starts_on: string;
    ends_on: string | null;
    start_time: string | null;
    location: string | null;
    link: string | null;
  } | null = null;
  let people: string[] = [];

  if (id) {
    const db = await createClient();
    const [{ data }, { data: peopleRows }] = await Promise.all([
      db
        .from("events")
        .select("id, title, description, kind, starts_on, ends_on, start_time, location, link")
        .eq("id", id)
        .single(),
      db.from("event_people").select("person").eq("event_id", id),
    ]);
    event = data;
    people = (peopleRows ?? []).map((r) => r.person as string);
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>{event ? "일정 수정" : "일정 추가"}</h1>
        <div className="spacer" />
        <Link className="btn btn--ghost" href="/schedule">
          취소
        </Link>
      </div>

      <form className="form" action={event ? updateEvent : createEvent}>
        {event && <input type="hidden" name="id" value={event.id} />}

        <div className="field">
          <label htmlFor="title">제목</label>
          <input
            className="input"
            id="title"
            name="title"
            required
            maxLength={120}
            defaultValue={event?.title ?? ""}
            placeholder="예: SBS 열혈농구단2 방송"
          />
        </div>

        <div className="field">
          <label>종류</label>
          <div className="radio-chips">
            {EVENT_KINDS.map((k, i) => (
              <span key={k.slug}>
                <input
                  type="radio"
                  id={`kind-${k.slug}`}
                  name="kind"
                  value={k.slug}
                  defaultChecked={event ? event.kind === k.slug : i === 0}
                />
                <label htmlFor={`kind-${k.slug}`}>{k.label}</label>
              </span>
            ))}
          </div>
          <span className="help">달력에서 색으로 구분됩니다.</span>
        </div>

        <div className="field">
          <label>출연 인물</label>
          <div className="radio-chips">
            {PEOPLE.map((p) => (
              <span key={p.slug}>
                <input
                  type="checkbox"
                  id={`person-${p.slug}`}
                  name="people"
                  value={p.slug}
                  defaultChecked={people.includes(p.slug)}
                />
                <label htmlFor={`person-${p.slug}`}>{p.name}</label>
              </span>
            ))}
          </div>
          <span className="help">여러 명 선택할 수 있습니다. 인물 필터에 쓰입니다.</span>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="starts_on">시작 날짜</label>
            <input
              className="input"
              type="date"
              id="starts_on"
              name="starts_on"
              required
              defaultValue={event?.starts_on ?? todayKey()}
            />
          </div>
          <div className="field">
            <label htmlFor="ends_on">종료 날짜</label>
            <input
              className="input"
              type="date"
              id="ends_on"
              name="ends_on"
              defaultValue={event?.ends_on ?? ""}
            />
            <span className="help">하루짜리면 비워두세요.</span>
          </div>
          <div className="field">
            <label htmlFor="start_time">시간</label>
            <input
              className="input"
              type="time"
              id="start_time"
              name="start_time"
              defaultValue={event?.start_time?.slice(0, 5) ?? ""}
            />
            <span className="help">미정이면 비워두세요.</span>
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="location">장소 · 채널</label>
            <input
              className="input"
              id="location"
              name="location"
              defaultValue={event?.location ?? ""}
              placeholder="예: SBS / 올림픽공원 / 유튜브"
            />
          </div>
          <div className="field">
            <label htmlFor="link">링크</label>
            <input
              className="input"
              type="url"
              id="link"
              name="link"
              defaultValue={event?.link ?? ""}
              placeholder="https://"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="description">설명</label>
          <textarea
            className="textarea"
            id="description"
            name="description"
            style={{ minHeight: "130px" }}
            defaultValue={event?.description ?? ""}
            placeholder="달력에서 일정을 눌렀을 때 보이는 내용입니다."
          />
        </div>

        <div className="form-actions">
          <button className="btn" type="submit">
            {event ? "수정하기" : "등록하기"}
          </button>
        </div>
      </form>
    </main>
  );
}

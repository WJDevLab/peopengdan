"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EVENT_KINDS, PEOPLE, eventKind } from "@/lib/constants";
import { dayLabel, fromKey, monthGrid, timeLabel, todayKey } from "@/lib/date";
import { deleteEvent } from "@/lib/actions";
import type { EventItem } from "@/types/db";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const personName = (slug: string) => PEOPLE.find((p) => p.slug === slug)?.name ?? slug;

export function Calendar({
  month,
  events,
  isAdmin,
}: {
  month: string;
  events: EventItem[];
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState<EventItem | null>(null);
  const weeks = monthGrid(month);
  const today = todayKey();

  /** 그 날짜에 걸쳐 있는 일정들. 시간 있는 것부터, 그다음 제목순. */
  function eventsOn(day: string) {
    return events
      .filter((e) => day >= e.starts_on && day <= (e.ends_on ?? e.starts_on))
      .sort((a, b) => (a.start_time ?? "99").localeCompare(b.start_time ?? "99"));
  }

  return (
    <>
      <div className="calendar">
        <div className="cal-grid">
          {DOW.map((d, i) => (
            <div key={d} className="cal-dow" data-weekend={i === 0 ? "sun" : undefined}>
              {d}
            </div>
          ))}

          {weeks.flat().map((day) => {
            const inMonth = day.slice(0, 7) === month;
            const dow = fromKey(day).getUTCDay();

            return (
              <div
                key={day}
                className="cal-cell"
                data-outside={!inMonth}
                data-today={day === today}
              >
                <span className="cal-date" data-weekend={dow === 0 ? "sun" : undefined}>
                  {Number(day.slice(8, 10))}
                </span>

                {eventsOn(day).map((e) => {
                  const end = e.ends_on ?? e.starts_on;
                  const seg =
                    e.starts_on === end
                      ? "single"
                      : day === e.starts_on
                        ? "start"
                        : day === end
                          ? "end"
                          : "mid";
                  // 이어지는 막대는 주가 바뀌는 지점(일요일)에서만 제목을 다시 보여준다.
                  const showTitle = seg === "single" || seg === "start" || dow === 0;

                  return (
                    <button
                      key={e.id + day}
                      className="evt"
                      data-seg={seg}
                      data-hidden-title={!showTitle}
                      style={{ ["--evt" as string]: eventKind(e.kind).color }}
                      onClick={() => setOpen(e)}
                      title={e.title}
                    >
                      {timeLabel(e.start_time) ? `${timeLabel(e.start_time)} ` : ""}
                      {e.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="cal-legend">
          {EVENT_KINDS.map((k) => (
            <span className="legend-item" key={k.slug}>
              <span className="legend-dot" style={{ ["--evt" as string]: k.color }} />
              {k.label}
            </span>
          ))}
        </div>
      </div>

      {open && <EventDetail event={open} isAdmin={isAdmin} onClose={() => setOpen(null)} />}
    </>
  );
}

function EventDetail({
  event,
  isAdmin,
  onClose,
}: {
  event: EventItem;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const kind = eventKind(event.kind);
  const end = event.ends_on ?? event.starts_on;
  const multi = end !== event.starts_on;

  function remove() {
    if (!window.confirm(`"${event.title}" 일정을 삭제할까요?`)) return;
    startTransition(async () => {
      const res = await deleteEvent(event.id);
      if (!res.ok) alert(res.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={event.title} onClick={onClose}>
      <div
        className="modal"
        style={{ width: "min(520px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="evt-detail">
          <div style={{ display: "flex", gap: ".35rem", alignItems: "center", flexWrap: "wrap" }}>
            <span
              className="badge"
              style={{ borderColor: kind.color, color: kind.color }}
            >
              {kind.label}
            </span>
            {event.people.map((p) => (
              <span className="badge" key={p}>
                {personName(p)}
              </span>
            ))}
          </div>

          <h2>{event.title}</h2>

          <dl>
            <dt>날짜</dt>
            <dd>
              {dayLabel(event.starts_on)}
              {multi && ` → ${dayLabel(end)}`}
              {multi && (
                <span style={{ color: "var(--muted)", marginLeft: ".35rem" }}>
                  ({Math.round((fromKey(end).getTime() - fromKey(event.starts_on).getTime()) / 86400000) + 1}일간)
                </span>
              )}
            </dd>

            {event.start_time && (
              <>
                <dt>시간</dt>
                <dd>{timeLabel(event.start_time)}</dd>
              </>
            )}

            {event.location && (
              <>
                <dt>장소</dt>
                <dd>{event.location}</dd>
              </>
            )}
          </dl>

          {event.description && <p className="desc">{event.description}</p>}

          <div className="modal-actions">
            {event.link && (
              <a className="link-out" href={event.link} target="_blank" rel="noopener noreferrer">
                링크 열기 ↗
              </a>
            )}
            {isAdmin && (
              <>
                <Link className="btn-mini" href={`/schedule/edit?id=${event.id}`}>
                  수정
                </Link>
                <button className="btn-mini btn-mini--danger" onClick={remove} disabled={pending}>
                  삭제
                </button>
              </>
            )}
            <button className="btn btn--ghost" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORIES, DEFAULT_SORT, ORIENTATIONS, PEOPLE, SORTS } from "@/lib/constants";
import type { VideoFilters } from "@/lib/queries";

type ChannelOption = { youtube_channel_id: string; title: string; trust_tier: string };

/** 현재 필터를 유지한 채 한 항목만 바꾼 링크 (ADR-013). */
function hrefWith(basePath: string, filters: VideoFilters, patch: Partial<VideoFilters>): string {
  const m = { ...filters, ...patch };
  const p = new URLSearchParams();
  if (m.person && m.person !== "all") p.set("person", m.person);
  if (m.category && m.category !== "all") p.set("category", m.category);
  if (m.channel && m.channel !== "all") p.set("channel", m.channel);
  if (m.orientation && m.orientation !== "all") p.set("orientation", m.orientation);
  if (m.sort && m.sort !== DEFAULT_SORT) p.set("sort", m.sort);
  if (m.q) p.set("q", m.q);
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function FilterPanel({
  filters,
  channels,
  resultCount,
  basePath = "/",
}: {
  filters: VideoFilters;
  channels: ChannelOption[];
  resultCount: number;
  /** 다른 경로(예: 어드민 숨김 영상 화면)에서 재사용할 때 넘긴다. */
  basePath?: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(filters.q ?? "");

  const person = filters.person ?? "all";
  const category = filters.category ?? "all";
  const channel = filters.channel ?? "all";
  const orientation = filters.orientation ?? "all";
  const sort = filters.sort ?? DEFAULT_SORT;

  // 패널 안에 걸린 것만 센다. 유형과 정렬은 상단 바에 항상 보이므로 제외.
  const activeCount =
    (person !== "all" ? 1 : 0) +
    (category !== "all" ? 1 : 0) +
    (channel !== "all" ? 1 : 0) +
    (filters.q ? 1 : 0);

  // 뭔가 걸려 있으면 펼친 채로 시작한다. 안 보이면 왜 결과가 적은지 알 수 없다.
  const [open, setOpen] = useState(activeCount > 0);

  useEffect(() => setTerm(filters.q ?? ""), [filters.q]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    router.push(hrefWith(basePath, filters, { q: term.trim() || undefined }));
  }

  return (
    <div className="filter-zone">
      <div className="filter-top">
        <div className="seg" role="group" aria-label="정렬">
          {SORTS.map((s) => (
            <Link
              key={s.slug}
              className="seg-opt"
              data-active={sort === s.slug}
              href={hrefWith(basePath, filters, { sort: s.slug })}
            >
              {s.label}
            </Link>
          ))}
        </div>

        <div className="filter-top-right">
          <div className="seg" role="group" aria-label="영상 유형">
            <Link
              className="seg-opt"
              data-active={orientation === "all"}
              href={hrefWith(basePath, filters, { orientation: "all" })}
            >
              전체
            </Link>
            {ORIENTATIONS.map((o) => (
              <Link
                key={o.slug}
                className="seg-opt"
                data-active={orientation === o.slug}
                href={hrefWith(basePath, filters, { orientation: o.slug })}
              >
                {o.label}
              </Link>
            ))}
          </div>

          <button className="filter-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            필터 · 검색
            {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
            <span className="caret" aria-hidden="true">
              {open ? "▲" : "▼"}
            </span>
          </button>
        </div>
      </div>

      <p className="filter-result">
        {resultCount.toLocaleString("ko-KR")}편
        {activeCount > 0 && (
          <>
            {" · "}
            <Link href={basePath}>필터 초기화</Link>
          </>
        )}
      </p>

      {open && (
        <div className="filter-panel">
          <form className="filter-row" onSubmit={search}>
            <span className="filter-label">검색</span>
            <input
              className="search"
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="제목 · 설명으로 찾기"
              aria-label="영상 검색"
            />
            <button className="btn" type="submit">
              찾기
            </button>
          </form>

          <Row label="인물">
            <Chip on={person === "all"} href={hrefWith(basePath, filters, { person: "all" })}>
              전체
            </Chip>
            {PEOPLE.map((p) => (
              <Chip key={p.slug} on={person === p.slug} href={hrefWith(basePath, filters, { person: p.slug })}>
                {p.name}
              </Chip>
            ))}
          </Row>

          <Row label="분류">
            <Chip on={category === "all"} href={hrefWith(basePath, filters, { category: "all" })}>
              전체
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip
                key={c.slug}
                on={category === c.slug}
                href={hrefWith(basePath, filters, { category: c.slug })}
              >
                {c.label}
              </Chip>
            ))}
          </Row>

          <Row label="채널">
            <Chip on={channel === "all"} href={hrefWith(basePath, filters, { channel: "all" })}>
              전체
            </Chip>
            {channels.map((c) => (
              <Chip
                key={c.youtube_channel_id}
                on={channel === c.youtube_channel_id}
                href={hrefWith(basePath, filters, { channel: c.youtube_channel_id })}
              >
                {c.title}
              </Chip>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  on,
  href,
  children,
}: {
  on: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="chip" data-active={on} href={href}>
      {children}
    </Link>
  );
}

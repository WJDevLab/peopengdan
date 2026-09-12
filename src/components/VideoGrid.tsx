"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, PEOPLE } from "@/lib/constants";
import { formatDuration, formatRelative, formatViews, isNewSince } from "@/lib/format";
import { deleteVideo, publishHiddenVideo, toggleVideoPin } from "@/lib/actions";
import { Icon } from "./Icon";
import type { VideoCard } from "@/types/db";

const LAST_VISIT_KEY = "peopengdan:lastVisit";
const WATCHED_KEY = "peopengdan:watched";
/** 무한정 쌓이지 않게 최근 N개만 남긴다. */
const WATCHED_LIMIT = 3000;

function loadWatched(): Set<string> {
  try {
    const raw = window.localStorage.getItem(WATCHED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveWatched(ids: Set<string>) {
  try {
    const list = Array.from(ids).slice(-WATCHED_LIMIT);
    window.localStorage.setItem(WATCHED_KEY, JSON.stringify(list));
  } catch {
    // 저장 실패해도 화면 표시는 이번 세션 동안 유지된다.
  }
}

const personName = (slug: string) => PEOPLE.find((p) => p.slug === slug)?.name ?? slug;
const categoryLabel = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;

export function VideoGrid({
  videos,
  isAdmin,
  variant = "main",
}: {
  videos: VideoCard[];
  isAdmin: boolean;
  variant?: "main" | "maybe" | "pinned" | "hidden";
}) {
  const [lastVisit, setLastVisit] = useState<number | null>(null);
  const [playing, setPlaying] = useState<VideoCard | null>(null);
  const [watched, setWatched] = useState<Set<string>>(() => new Set());
  const gridRef = useRef<HTMLDivElement>(null);

  // Small grid tracks let each card end independently of its taller neighbours.
  // Observe cards as well as the container: fonts, wrapping and resizing change heights.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;
    const layout = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
        const cards = Array.from(grid.children) as HTMLElement[];
        const spans = cards.map(card => Math.ceil(card.getBoundingClientRect().height + gap));
        cards.forEach((card, index) => {
          const span = spans[index];
          card.style.gridRowEnd = `span ${span}`;
        });
        grid.dataset.masonry = "ready";
      });
    };
    const observer = new ResizeObserver(layout);
    observer.observe(grid);
    for (const card of Array.from(grid.children)) observer.observe(card);
    layout();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [videos]);

  // 이전 방문 시각을 읽어 NEW 배지 기준으로 삼고, 곧바로 이번 방문 시각으로 갱신한다.
  // 배지는 이번 세션 동안 그대로 남고, 다음 방문 때 기준이 바뀐다.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAST_VISIT_KEY);
      setLastVisit(stored ? Number(stored) : null);
      window.localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    } catch {
      // 시크릿 모드 등에서 저장소 접근이 막히면 NEW 배지만 생략된다.
    }
    setWatched(loadWatched());
  }, []);

  // 로그인 여부와 무관하게 이 기기에서 본 영상만 기억한다 (ADR-011: 열람엔 로그인 마찰이 없어야 함).
  function play(video: VideoCard) {
    setPlaying(video);
    setWatched((prev) => {
      if (prev.has(video.id)) return prev;
      const next = new Set(prev);
      next.add(video.id);
      saveWatched(next);
      return next;
    });
  }

  return (
    <>
      <div
        ref={gridRef}
        className={
          variant === "maybe" ? "grid grid--maybe" : variant === "pinned" ? "grid grid--pinned" : "grid"
        }
      >
        {videos.map((video) => (
          <Card
            key={video.id}
            video={video}
            isAdmin={isAdmin}
            variant={variant}
            isNew={variant === "main" && isNewSince(video.published_at, lastVisit)}
            watched={watched.has(video.id)}
            onPlay={() => play(video)}
          />
        ))}
      </div>

      {playing && <PlayerModal video={playing} onClose={() => setPlaying(null)} />}
    </>
  );
}

function Card({
  video,
  isAdmin,
  variant,
  isNew,
  watched,
  onPlay,
}: {
  video: VideoCard;
  isAdmin: boolean;
  variant: "main" | "maybe" | "pinned" | "hidden";
  isNew: boolean;
  watched: boolean;
  onPlay: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [published, setPublished] = useState(false);
  const router = useRouter();
  const duration = formatDuration(video.duration_seconds);

  function remove() {
    const ok = window.confirm(
      `"${video.title}"\n\n이 영상을 삭제합니다. 차단 목록에 등록되어 다음 수집 때 다시 올라오지 않습니다. 되돌릴 수 없습니다.`,
    );
    if (!ok) return;

    startTransition(async () => {
      const res = await deleteVideo(video.id);
      if (!res.ok) alert("삭제하지 못했습니다: " + res.error);
      else router.refresh();
    });
  }

  function togglePin() {
    startTransition(async () => {
      const res = await toggleVideoPin(video.id, !video.is_pinned);
      if (!res.ok) alert("고정을 바꾸지 못했습니다: " + res.error);
      else router.refresh();
    });
  }

  function publish() {
    startTransition(async () => {
      const res = await publishHiddenVideo(video.id);
      if (!res.ok) alert("공개 전환하지 못했습니다: " + res.error);
      else setPublished(true);
    });
  }

  return (
    <article className={video.is_short ? "card card--short" : "card"}>
      {isAdmin && (
        <div className="card-admin">
          {variant === "hidden" ? (
            <button
              className="btn-icon"
              data-on={published}
              onClick={publish}
              disabled={pending || published}
              aria-label="공개로 전환"
              title={published ? "공개됨" : "공개로 전환"}
            >
              <Icon name={published ? "video" : "eye-off"} size={15} />
            </button>
          ) : (
            <button
              className="btn-icon"
              data-on={video.is_pinned}
              onClick={togglePin}
              disabled={pending}
              aria-label={video.is_pinned ? "고정 해제" : "맨 위에 고정"}
              title={video.is_pinned ? "고정 해제" : "맨 위에 고정"}
            >
              <Icon name="pin" size={15} />
            </button>
          )}
          <button
            className="btn-icon btn-icon--danger"
            onClick={remove}
            disabled={pending}
            aria-label={`${video.title} 삭제`}
            title="삭제"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      )}

      <button className="card-open" onClick={onPlay}>
        <div className={watched ? "thumb thumb--watched" : "thumb"}>
          {/* YouTube CDN URL을 직접 참조한다. 서버로 프록시하지 않는다 (ADR-002). */}
          {video.thumbnail_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={video.thumbnail_url} alt="" loading="lazy" decoding="async" />
          )}
          {watched && (
            <span className="badge-watched" title="본 영상">
              ✓ 봄
            </span>
          )}
          {variant === "hidden" ? (
            published ? (
              <span className="badge-new badge-new--pin">공개됨</span>
            ) : (
              <span className="badge-new badge-new--score">{video.relevance_score}점</span>
            )
          ) : (
            <>
              {video.is_pinned && <span className="badge-new badge-new--pin">고정</span>}
              {!video.is_pinned && isNew && <span className="badge-new">NEW</span>}
            </>
          )}
          {duration && <span className="badge-dur">{duration}</span>}
        </div>

        <div className="card-body">
          <h3 className="card-title">{video.title}</h3>
          <p className="card-sub">
            {video.channel?.title ?? "알 수 없는 채널"} · {formatViews(video.view_count)} ·{" "}
            {formatRelative(video.published_at)}
          </p>
          <div className="tags">
            {video.people.map((p) => (
              <span key={p} className="tag">
                {personName(p)}
              </span>
            ))}
            <span className="tag tag--cat">{categoryLabel(video.category)}</span>
          </div>
        </div>
      </button>
    </article>
  );
}

function PlayerModal({ video, onClose }: { video: VideoCard; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const watchUrl = `https://www.youtube.com/watch?v=${video.youtube_video_id}`;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-player">
          {/* 재생은 YouTube 임베드 플레이어로만. 조회수와 광고 수익은 원저작자에게 간다. */}
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtube_video_id}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="modal-body">
          <h2>{video.title}</h2>
          <p className="card-sub">
            {video.channel?.title ?? "알 수 없는 채널"} · {formatViews(video.view_count)} ·{" "}
            {formatRelative(video.published_at)}
          </p>
          <div className="modal-actions">
            <a className="link-out" href={watchUrl} target="_blank" rel="noopener noreferrer">
              유튜브에서 보기 ↗
            </a>
            <button className="btn btn--ghost" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

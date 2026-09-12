"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { loadMoreVideos } from "@/lib/actions";
import type { VideoFilters } from "@/lib/queries";
import type { VideoCard } from "@/types/db";
import { VideoGrid } from "./VideoGrid";

/**
 * 영상 그리드 + 무한 스크롤.
 *
 * 서버가 첫 페이지(확실한 것 + 애매한 것 각 48건)를 미리 그려주고, 여기서는
 * 화면 밑에 다다르면 다음 묶음을 이어 붙인다. sureOffset/unsureOffset은 각각
 * 몇 건까지 이미 불러왔는지를 추적한다 — 서버 액션이 "확실한 것을 다 썼는지"
 * 판단해 애매한 것으로 자연스럽게 넘어간다 (ADR-023 순서 유지).
 *
 * IntersectionObserver 대신 scroll 이벤트로 감지한다. 로딩 중 판정은 state가
 * 아니라 ref로 둔다 — 진행 중에도 스크롤 이벤트가 계속 들어오는데, state로
 * 판정하면 effect가 다시 걸리기 전까지 옛 값을 참조해 중복 호출될 수 있다.
 */
export function InfiniteVideoList({
  initialVideos,
  filters,
  isAdmin,
  initialSureCount,
  initialUnsureCount,
}: {
  initialVideos: VideoCard[];
  filters: VideoFilters;
  isAdmin: boolean;
  initialSureCount: number;
  initialUnsureCount: number;
}) {
  const [videos, setVideos] = useState(initialVideos);
  const [done, setDone] = useState(initialSureCount === 0 && initialUnsureCount === 0);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();
  const sureOffset = useRef(initialSureCount);
  const unsureOffset = useRef(initialUnsureCount);
  const loadingRef = useRef(false);
  const doneRef = useRef(done);

  // 필터·정렬이 바뀌어 서버가 새 첫 페이지를 내려주면 처음부터 다시 센다.
  useEffect(() => {
    setVideos(initialVideos);
    sureOffset.current = initialSureCount;
    unsureOffset.current = initialUnsureCount;
    const startDone = initialSureCount === 0 && initialUnsureCount === 0;
    setDone(startDone);
    doneRef.current = startDone;
  }, [initialVideos, initialSureCount, initialUnsureCount]);

  function loadMore() {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setPending(true);
    setFailed(false);

    startTransition(async () => {
      try {
        const { sure, unsure } = await loadMoreVideos(filters, sureOffset.current, unsureOffset.current);
        sureOffset.current += sure.length;
        unsureOffset.current += unsure.length;

        if (sure.length === 0 && unsure.length === 0) {
          doneRef.current = true;
          setDone(true);
          return;
        }
        setVideos((prev) => {
          const seen = new Set(prev.map(v => v.id));
          return [...prev, ...[...sure, ...unsure].filter(v => !seen.has(v.id))];
        });
      } catch {
        setFailed(true);
      } finally {
        loadingRef.current = false;
        setPending(false);
      }
    });
  }

  useEffect(() => {
    function onScroll() {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 900;
      if (nearBottom) loadMore();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // 초기 화면이 짧아 스크롤할 게 없는 경우도 채운다
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <>
      <VideoGrid videos={videos} isAdmin={isAdmin} />
      {!done && (
        <div className="grid-sentinel">
          {failed && <button className="btn" onClick={loadMore} disabled={pending}>불러오지 못했어요 · 다시 시도</button>}
          <span className={pending ? "grid-loading" : "grid-loading grid-loading--idle"}>
            {pending ? "불러오는 중…" : ""}
          </span>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { loadMoreHiddenVideos } from "@/lib/actions";
import type { VideoFilters } from "@/lib/queries";
import type { VideoCard } from "@/types/db";
import { VideoGrid } from "./VideoGrid";

/** 숨김 영상 목록 + 무한 스크롤. InfiniteVideoList와 같은 scroll 기반 방식이다. */
export function InfiniteHiddenVideoList({
  initialVideos,
  filters,
  initialCount,
}: {
  initialVideos: VideoCard[];
  filters: VideoFilters;
  initialCount: number;
}) {
  const [videos, setVideos] = useState(initialVideos);
  const [done, setDone] = useState(initialCount === 0);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const offset = useRef(initialCount);
  const loadingRef = useRef(false);
  const doneRef = useRef(done);

  useEffect(() => {
    setVideos(initialVideos);
    offset.current = initialCount;
    const startDone = initialCount === 0;
    setDone(startDone);
    doneRef.current = startDone;
  }, [initialVideos, initialCount]);

  function loadMore() {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setPending(true);

    startTransition(async () => {
      try {
        const next = await loadMoreHiddenVideos(filters, offset.current);
        offset.current += next.length;
        if (next.length === 0) {
          doneRef.current = true;
          setDone(true);
          return;
        }
        setVideos((prev) => [...prev, ...next]);
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
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <>
      <VideoGrid videos={videos} isAdmin variant="hidden" />
      {!done && (
        <div className="grid-sentinel">
          <span className={pending ? "grid-loading" : "grid-loading grid-loading--idle"}>
            {pending ? "불러오는 중…" : ""}
          </span>
        </div>
      )}
    </>
  );
}

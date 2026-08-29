import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FilterPanel } from "@/components/FilterPanel";
import { InfiniteHiddenVideoList } from "@/components/InfiniteHiddenVideoList";
import {
  countHiddenVideos,
  fetchFilterChannels,
  fetchHiddenVideos,
  type VideoFilters,
} from "@/lib/queries";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "숨김 영상 · 퍼스트펭귄단" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * 어드민 전용. 채점에서 걸러진 숨김 영상을 훑어보고 오판이면 공개로 되돌린다.
 * (ADR-025 이후로 인물 신호가 없으면 무조건 숨기는데, 규칙이 완벽하진 않다.)
 */
export default async function HiddenVideosPage({ searchParams }: { searchParams: SearchParams }) {
  const { isAdmin } = await getViewer();
  if (!isAdmin) redirect("/");

  const sp = await searchParams;
  const filters: VideoFilters = {
    person: one(sp.person),
    category: one(sp.category),
    channel: one(sp.channel),
    orientation: one(sp.orientation),
    sort: one(sp.sort),
    q: one(sp.q),
  };

  const [videos, resultCount, channels] = await Promise.all([
    fetchHiddenVideos(filters),
    countHiddenVideos(filters),
    fetchFilterChannels(),
  ]);

  return (
    <main className="page">
      <div className="page-head">
        <h1>숨김 영상</h1>
        <span className="sub">채점에서 걸러진 영상입니다. 오판이면 공개로 되돌리세요.</span>
      </div>

      <FilterPanel filters={filters} channels={channels} resultCount={resultCount} basePath="/admin/hidden" />

      {resultCount === 0 ? (
        <div className="empty">
          <span className="glyph" aria-hidden="true">
            🐧
          </span>
          <h2>숨겨진 영상이 없습니다</h2>
          <p>조건에 걸리는 숨김 영상이 없습니다.</p>
        </div>
      ) : (
        <InfiniteHiddenVideoList initialVideos={videos} filters={filters} initialCount={videos.length} />
      )}
    </main>
  );
}

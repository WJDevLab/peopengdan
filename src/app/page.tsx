import { FilterPanel } from "@/components/FilterPanel";
import { VideoGrid } from "@/components/VideoGrid";
import { InfiniteVideoList } from "@/components/InfiniteVideoList";
import { Icon } from "@/components/Icon";
import {
  countVideos,
  fetchFilterChannels,
  fetchVideoStats,
  fetchVideos,
  type VideoFilters,
} from "@/lib/queries";
import { getViewer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (n: number) => n.toLocaleString("ko-KR");

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters: VideoFilters = {
    person: one(sp.person),
    category: one(sp.category),
    channel: one(sp.channel),
    orientation: one(sp.orientation),
    sort: one(sp.sort),
    q: one(sp.q),
  };

  let pinned: Awaited<ReturnType<typeof fetchVideos>> = [];
  let sure: Awaited<ReturnType<typeof fetchVideos>> = [];
  let unsure: Awaited<ReturnType<typeof fetchVideos>> = [];
  let stats: Awaited<ReturnType<typeof fetchVideoStats>> | null = null;
  let channels: Awaited<ReturnType<typeof fetchFilterChannels>> = [];
  let isAdmin = false;
  let setupError: string | null = null;

  let sureTotal = 0;
  let unsureTotal = 0;

  try {
    const [
      pinnedSure,
      pinnedMaybe,
      sureRest,
      unsureRest,
      sureCount,
      unsureCount,
      statsRes,
      channelsRes,
      viewer,
    ] = await Promise.all([
      fetchVideos(filters, "published", true),
      fetchVideos(filters, "maybe", true),
      fetchVideos(filters, "published", false),
      fetchVideos(filters, "maybe", false),
      countVideos(filters, "published", false),
      countVideos(filters, "maybe", false),
      fetchVideoStats(),
      fetchFilterChannels(),
      getViewer(),
    ]);
    // 고정 영상은 상태(published/maybe)와 무관하게 한 섹션에 모은다.
    pinned = [...pinnedSure, ...pinnedMaybe];
    sure = sureRest;
    unsure = unsureRest;
    sureTotal = sureCount;
    unsureTotal = unsureCount;
    stats = statsRes;
    channels = channelsRes;
    isAdmin = viewer.isAdmin;
  } catch (err) {
    console.error("Video page load failed", err instanceof Error ? err.name : "UnknownError");
    setupError = "영상을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (setupError) return <SetupNotice message={setupError} />;

  // 한 그리드에 함께 넣되 확실한 것을 앞에, 애매한 것을 뒤에 둔다 (ADR-023).
  // 처음엔 이 중 최대 96건만 그려지고, 나머지는 스크롤하면서 이어 불러온다.
  const videos = [...sure, ...unsure];
  const resultCount = sureTotal + unsureTotal + pinned.length;
  const searching = Object.entries(filters).some(
    ([k, v]) => v && v !== "all" && k !== "sort",
  );

  return (
    <main className="page">
      <div className="page-head">
        <h1>영상</h1>
        <span className="sub">퍼펭단 관련 유튜브 콘텐츠 아카이브</span>
      </div>

      {stats && (
        <dl className="stats">
          <Stat label="모아둔 영상" value={num(stats.published + stats.maybe)} />
          <Stat label="이용주" value={num(stats.yongju)} />
          <Stat label="이선민" value={num(stats.seonmin)} />
          <Stat label="유영우" value={num(stats.yeongwoo)} />
          <Stat label="가로 영상" value={num(stats.wide)} />
          <Stat label="세로 영상" value={num(stats.vertical)} />
        </dl>
      )}

      <FilterPanel filters={filters} channels={channels} resultCount={resultCount} />

      {resultCount === 0 ? (
        <EmptyState searching={searching} />
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="pinned-zone">
              <div className="pinned-zone-head">
                <Icon name="pin" size={16} />
                <h2>고정된 영상</h2>
                <span className="pinned-zone-count">{pinned.length}편</span>
              </div>
              <VideoGrid videos={pinned} isAdmin={isAdmin} variant="pinned" />
            </section>
          )}
          {videos.length > 0 && (
            <InfiniteVideoList
              key={JSON.stringify(filters)}
              initialVideos={videos}
              filters={filters}
              isAdmin={isAdmin}
              initialSureCount={sure.length}
              initialUnsureCount={unsure.length}
            />
          )}
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        {value}
        <small>편</small>
      </dd>
    </div>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="empty">
      <span className="glyph" aria-hidden="true">
        🐧
      </span>
      <h2>{searching ? "물속에 아무것도 없네요" : "아직 수집된 영상이 없습니다"}</h2>
      <p>
        {searching ? (
          "조건을 바꿔서 다시 찾아보세요. '필터 초기화'를 누르면 전부 다시 보입니다."
        ) : (
          <>
            <code>npm run resolve:channels</code> 로 채널을 등록한 뒤{" "}
            <code>npm run collect</code> 를 실행하면 여기가 채워집니다.
          </>
        )}
      </p>
    </div>
  );
}

function SetupNotice({ message }: { message: string }) {
  return (
    <main className="page">
      <div className="empty">
        <span className="glyph" aria-hidden="true">
          🧊
        </span>
        <h2>잠시 쉬어 가고 있어요</h2>
        <p>{message}</p>
        <a className="btn" href="/">다시 불러오기</a>
      </div>
    </main>
  );
}

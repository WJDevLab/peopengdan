import { createClient } from "@/lib/supabase/server";
import { resolveSort, type PersonSlug } from "@/lib/constants";
import type { CollectionRunRow, VideoCard, VideoStatusFilter } from "@/types/db";

/** 최근 수집 회차 기록. 어드민 전용(`/admin/collections`). RLS가 실제 접근을 막는다. */
export async function fetchCollectionRuns(limit = 30): Promise<CollectionRunRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collection_runs")
    .select("id, started_at, finished_at, quota_used, videos_seen, videos_new, status, error_message")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("수집 기록 조회 실패: " + error.message);
  return (data ?? []) as CollectionRunRow[];
}

export type VideoFilters = {
  person?: string;
  category?: string;
  /** 출처 채널 (youtube_channel_id). 내용 분류와 별개 축이다. */
  channel?: string;
  /** 형식. wide = 가로, vertical = 세로(숏츠). */
  orientation?: string;
  sort?: string;
  q?: string;
};

/** 필터 칩에 띄울 신뢰 채널 목록. 검색으로 걸린 잡다한 채널은 빼고 보여준다. */
export async function fetchFilterChannels() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("channels")
    .select("youtube_channel_id, title, trust_tier")
    .eq("is_active", true)
    .order("trust_tier")
    .order("title");
  return data ?? [];
}

const PAGE_SIZE = 48;

const SELECT_BASE =
  "id, youtube_video_id, title, published_at, duration_seconds, is_short, thumbnail_url," +
  " view_count, category, relevance_score, status, is_pinned," +
  " channel:channels ( title, youtube_channel_id, trust_tier )";

/**
 * 영상 목록을 가져온다.
 *
 * 인물 필터는 video_people 을 inner join 해서 거르는데, 그러면 조인 결과에
 * 필터로 지정한 인물만 남아 태그 표시가 불완전해진다. 그래서 태그는 항상
 * 두 번째 쿼리로 따로 가져온다. 페이지당 최대 48건이라 부담은 없다.
 */
export async function fetchVideos(
  filters: VideoFilters,
  status: VideoStatusFilter,
  /** true = 고정된 것만, false = 고정 안 된 것만, undefined = 전부 */
  pinned?: boolean,
  /** 이어서 더 불러올 때 쓰는 시작 위치. 무한 스크롤(loadMoreVideos)이 넘긴다. */
  offset = 0,
): Promise<VideoCard[]> {
  const supabase = await createClient();
  const sort = resolveSort(filters.sort);

  const byPerson = filters.person && filters.person !== "all";
  const byChannel = filters.channel && filters.channel !== "all";

  // 채널로 거를 때는 조인을 inner 로 바꿔야 부모 행까지 걸러진다.
  let select = byChannel
    ? SELECT_BASE.replace("channel:channels (", "channel:channels!inner (")
    : SELECT_BASE;
  if (byPerson) select += ", video_people!inner ( person )";

  let query = supabase.from("videos").select(select).eq("status", status);

  if (pinned !== undefined) query = query.eq("is_pinned", pinned);
  if (byPerson) query = query.eq("video_people.person", filters.person!);
  if (byChannel) query = query.eq("channels.youtube_channel_id", filters.channel!);

  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  // 유형은 내용 분류와 독립이라 함께 걸 수 있다 (예: 세로 영상인 급습편).
  if (filters.orientation === "vertical") query = query.eq("is_short", true);
  else if (filters.orientation === "wide") query = query.eq("is_short", false);

  if (filters.q?.trim()) {
    const term = filters.q.trim().replace(/[%,]/g, "");
    if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw new Error("영상 조회 실패: " + error.message);

  const rows = (data ?? []) as unknown as VideoCard[];
  if (rows.length === 0) return [];

  const { data: tags } = await supabase
    .from("video_people")
    .select("video_id, person")
    .in(
      "video_id",
      rows.map((r) => r.id),
    );

  const byVideo = new Map<string, PersonSlug[]>();
  for (const t of tags ?? []) {
    const list = byVideo.get(t.video_id) ?? [];
    list.push(t.person as PersonSlug);
    byVideo.set(t.video_id, list);
  }

  return rows.map((r) => ({ ...r, people: byVideo.get(r.id) ?? [] }));
}

/** 필터에 맞는 진짜 총 개수. 그리드는 페이지당 48건만 불러오므로 "N편" 표시는 따로 센다. */
export async function countVideos(
  filters: VideoFilters,
  status: VideoStatusFilter,
  pinned?: boolean,
): Promise<number> {
  const supabase = await createClient();

  const byPerson = filters.person && filters.person !== "all";
  const byChannel = filters.channel && filters.channel !== "all";

  let select = byChannel ? "id, channel:channels!inner ( id )" : "id";
  if (byPerson) select += ", video_people!inner ( person )";

  let query = supabase
    .from("videos")
    .select(select, { count: "exact", head: true })
    .eq("status", status);

  if (pinned !== undefined) query = query.eq("is_pinned", pinned);
  if (byPerson) query = query.eq("video_people.person", filters.person!);
  if (byChannel) query = query.eq("channels.youtube_channel_id", filters.channel!);

  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters.orientation === "vertical") query = query.eq("is_short", true);
  else if (filters.orientation === "wide") query = query.eq("is_short", false);

  if (filters.q?.trim()) {
    const term = filters.q.trim().replace(/[%,]/g, "");
    if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { count, error } = await query;
  if (error) throw new Error("영상 집계 실패: " + error.message);
  return count ?? 0;
}

/**
 * 숨김 영상 목록. 어드민 전용 관리 화면(`/admin/hidden`)에서만 쓴다.
 * `fetchVideos`는 타입으로 hidden 조회를 막아뒀으므로(VideoStatusFilter) 일부러
 * 별도 함수로 뒀다 — 실수로 공개 화면 경로에 숨김 영상이 새어나가지 않게 한다.
 */
export async function fetchHiddenVideos(filters: VideoFilters, offset = 0): Promise<VideoCard[]> {
  const supabase = await createClient();
  const sort = resolveSort(filters.sort);

  const byPerson = filters.person && filters.person !== "all";
  const byChannel = filters.channel && filters.channel !== "all";

  let select = byChannel
    ? SELECT_BASE.replace("channel:channels (", "channel:channels!inner (")
    : SELECT_BASE;
  if (byPerson) select += ", video_people!inner ( person )";

  let query = supabase.from("videos").select(select).eq("status", "hidden");

  if (byPerson) query = query.eq("video_people.person", filters.person!);
  if (byChannel) query = query.eq("channels.youtube_channel_id", filters.channel!);
  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category);
  if (filters.orientation === "vertical") query = query.eq("is_short", true);
  else if (filters.orientation === "wide") query = query.eq("is_short", false);
  if (filters.q?.trim()) {
    const term = filters.q.trim().replace(/[%,]/g, "");
    if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw new Error("숨김 영상 조회 실패: " + error.message);

  const rows = (data ?? []) as unknown as VideoCard[];
  if (rows.length === 0) return [];

  const { data: tags } = await supabase
    .from("video_people")
    .select("video_id, person")
    .in(
      "video_id",
      rows.map((r) => r.id),
    );

  const byVideo = new Map<string, PersonSlug[]>();
  for (const t of tags ?? []) {
    const list = byVideo.get(t.video_id) ?? [];
    list.push(t.person as PersonSlug);
    byVideo.set(t.video_id, list);
  }
  return rows.map((r) => ({ ...r, people: byVideo.get(r.id) ?? [] }));
}

export async function countHiddenVideos(filters: VideoFilters): Promise<number> {
  const supabase = await createClient();

  const byPerson = filters.person && filters.person !== "all";
  const byChannel = filters.channel && filters.channel !== "all";

  let select = byChannel ? "id, channel:channels!inner ( id )" : "id";
  if (byPerson) select += ", video_people!inner ( person )";

  let query = supabase
    .from("videos")
    .select(select, { count: "exact", head: true })
    .eq("status", "hidden");

  if (byPerson) query = query.eq("video_people.person", filters.person!);
  if (byChannel) query = query.eq("channels.youtube_channel_id", filters.channel!);
  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category);
  if (filters.orientation === "vertical") query = query.eq("is_short", true);
  else if (filters.orientation === "wide") query = query.eq("is_short", false);
  if (filters.q?.trim()) {
    const term = filters.q.trim().replace(/[%,]/g, "");
    if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { count, error } = await query;
  if (error) throw new Error("숨김 영상 집계 실패: " + error.message);
  return count ?? 0;
}

/**
 * 상단 현황판 숫자.
 *
 * 인물별 집계는 반드시 published 로 한정한다. video_people 만 세면
 * 화면에 안 보이는 hidden 영상까지 들어가서 "수집된 영상 284편인데
 * 이용주 790편" 같은 앞뒤 안 맞는 숫자가 나온다.
 */
export async function fetchVideoStats() {
  const supabase = await createClient();

  // 화면에 실제로 나오는 두 단계(published + maybe)만 센다.
  const SHOWN = ["published", "maybe"];

  const visible = () =>
    supabase.from("videos").select("id", { count: "exact", head: true }).in("status", SHOWN);

  const byPerson = (person: string) =>
    supabase
      .from("video_people")
      .select("video_id, videos!inner(status)", { count: "exact", head: true })
      .eq("person", person)
      .in("videos.status", SHOWN);

  const [published, maybe, yongju, seonmin, yeongwoo, wide, vertical] = await Promise.all([
    supabase.from("videos").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("videos").select("id", { count: "exact", head: true }).eq("status", "maybe"),
    byPerson("yongju"),
    byPerson("seonmin"),
    byPerson("yeongwoo"),
    visible().eq("is_short", false),
    visible().eq("is_short", true),
  ]);

  return {
    published: published.count ?? 0,
    maybe: maybe.count ?? 0,
    yongju: yongju.count ?? 0,
    seonmin: seonmin.count ?? 0,
    yeongwoo: yeongwoo.count ?? 0,
    wide: wide.count ?? 0,
    vertical: vertical.count ?? 0,
  };
}

/** DB가 아직 비어 있는지. 첫 실행 안내 화면을 띄울지 판단하는 데 쓴다. */
export async function isDatabaseEmpty(): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true });
  if (error) return false;
  return (count ?? 0) === 0;
}

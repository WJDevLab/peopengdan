/**
 * 콘텐츠 수집기.
 *
 * 경로 2가지 (Notion 기획 문서 7.1):
 *   1) 채널 스캔   — channels 테이블의 활성 채널 업로드 목록을 통째로 순회. 사실상 공짜.
 *   2) 키워드 검색 — search_keywords 로 유튜브 전체 검색. 호출당 100유닛이라 비싸다.
 *
 * 수집한 영상은 규칙 기반으로 인물/카테고리/신뢰도 점수를 매겨 저장한다.
 *
 *   npm run collect              # 전체
 *   npm run collect -- --no-search   # 채널 스캔만 (할당량 절약)
 */

import { config } from "dotenv";
import { probeIsShort, QuotaTracker, YouTubeClient, type YtVideo } from "../src/lib/youtube";
import { createAdminClient } from "../src/lib/supabase/admin";
import {
  classifyCategory,
  detectPeople,
  isShort,
  qualifyingHits,
  scoreRelevance,
  statusFromScore,
} from "../src/lib/classify";
import type { PersonSlug, TrustTier } from "../src/lib/constants";

config({ path: ".env.local" });

/** 회차당 안전 상한. 하루 6회(4시간 주기) 돌려도 할당량의 66% 수준. */
const QUOTA_BUDGET_PER_RUN = 1600;
const SEARCH_PAGES_PER_KEYWORD = 2;
/** 직전 실행 이후만 검색하되, 놓친 회차를 대비해 하루 정도 겹쳐서 본다. */
const SEARCH_LOOKBACK_BUFFER_MS = 24 * 60 * 60 * 1000;

/** 키워드를 한 번도 안 돌렸으면 undefined(전체 검색, 첫 백필용). */
function publishedAfterFor(lastRunAt: string | null): string | undefined {
  if (!lastRunAt) return undefined;
  return new Date(new Date(lastRunAt).getTime() - SEARCH_LOOKBACK_BUFFER_MS).toISOString();
}

type ChannelLite = {
  id: string;
  youtube_channel_id: string;
  title: string;
  trust_tier: TrustTier;
  owner_person: PersonSlug | null;
};

async function main() {
  const skipSearch = process.argv.includes("--no-search");

  const db = createAdminClient();
  const yt = new YouTubeClient(
    process.env.YOUTUBE_API_KEY ?? "",
    new QuotaTracker(QUOTA_BUDGET_PER_RUN),
  );

  const { data: run } = await db
    .from("collection_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  const runId = run?.id as string | undefined;

  let seen = 0;
  let created = 0;
  let failure: string | null = null;

  try {
    const { data: channels, error } = await db
      .from("channels")
      .select("id, youtube_channel_id, title, trust_tier, owner_person")
      .eq("is_active", true);
    if (error) throw new Error("channels 조회 실패: " + error.message);

    const known = new Map<string, ChannelLite>();
    for (const c of (channels ?? []) as ChannelLite[]) known.set(c.youtube_channel_id, c);

    if (known.size === 0) {
      throw new Error("channels 테이블이 비어 있습니다. 먼저 `npm run resolve:channels` 를 실행하세요.");
    }

    // ── 1) 채널 스캔 ─────────────────────────────────────────────
    for (const channel of known.values()) {
      console.log("[채널] " + channel.title);
      const meta = await yt.resolveChannel(channel.youtube_channel_id);
      if (!meta) {
        console.warn("  채널을 찾을 수 없습니다: " + channel.youtube_channel_id);
        continue;
      }

      const ids = await yt.listAllUploadIds(meta.uploadsPlaylistId);
      const fresh = await filterUnknown(db, ids);
      console.log("  업로드 " + ids.length + "건 중 신규 " + fresh.length + "건");

      if (fresh.length) {
        const videos = await yt.listVideos(fresh);
        seen += videos.length;
        created += await persist(db, videos, known, "channel_scan");
      }
    }

    // ── 2) 키워드 검색 ───────────────────────────────────────────
    if (!skipSearch) {
      const { data: keywords } = await db
        .from("search_keywords")
        .select("id, keyword, last_run_at")
        .eq("is_active", true);

      for (const kw of keywords ?? []) {
        console.log("[검색] " + kw.keyword);
        const publishedAfter = publishedAfterFor(kw.last_run_at);
        const ids = await yt.searchVideoIds(kw.keyword, SEARCH_PAGES_PER_KEYWORD, publishedAfter);
        const fresh = await filterUnknown(db, ids);
        console.log("  결과 " + ids.length + "건 중 신규 " + fresh.length + "건");

        if (fresh.length) {
          const videos = await yt.listVideos(fresh);
          seen += videos.length;
          created += await persist(db, videos, known, "keyword_search");
        }

        await db
          .from("search_keywords")
          .update({ last_run_at: new Date().toISOString() })
          .eq("id", kw.id);
      }
    }
  } catch (err) {
    // 예산 소진은 정상적인 조기 종료다. 여기까지 모은 것은 이미 저장되어 있다.
    failure = (err as Error).message;
    console.warn("중단: " + failure);
  }

  if (runId) {
    await db
      .from("collection_runs")
      .update({
        finished_at: new Date().toISOString(),
        quota_used: yt.quota.used,
        videos_seen: seen,
        videos_new: created,
        status: failure ? "failed" : "success",
        error_message: failure,
      })
      .eq("id", runId);
  }

  console.log(
    "\n완료 — 조회 " + seen + "건 / 신규 " + created + "건 / 할당량 " + yt.quota.used + " 유닛",
  );
}

/**
 * 상세 조회가 필요 없는 videoId를 걸러낸다. 제외 대상은 두 가지다.
 *   1) 이미 videos 에 있는 것        — 중복 조회 낭비
 *   2) blocked_videos 에 있는 것     — 어드민이 지운 영상 (ADR-012)
 *
 * 2번이 없으면 어드민이 지운 영상이 다음 회차에 그대로 되살아난다.
 */
async function filterUnknown(db: ReturnType<typeof createAdminClient>, ids: string[]) {
  if (ids.length === 0) return [];
  const skip = new Set<string>();

  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);

    const [existing, blocked] = await Promise.all([
      db.from("videos").select("youtube_video_id").in("youtube_video_id", chunk),
      db.from("blocked_videos").select("youtube_video_id").in("youtube_video_id", chunk),
    ]);

    for (const row of existing.data ?? []) skip.add(row.youtube_video_id);
    for (const row of blocked.data ?? []) skip.add(row.youtube_video_id);
  }
  return ids.filter((id) => !skip.has(id));
}

/** 분류·점수 산정 후 videos / video_people 에 기록한다. */
async function persist(
  db: ReturnType<typeof createAdminClient>,
  videos: YtVideo[],
  known: Map<string, ChannelLite>,
  discoveredVia: "channel_scan" | "keyword_search",
): Promise<number> {
  let count = 0;

  for (const v of videos) {
    // 검색으로 발견된 낯선 채널은 external 등급으로 등록한다.
    let channel = known.get(v.channelId);
    if (!channel) {
      const { data } = await db
        .from("channels")
        .upsert(
          {
            youtube_channel_id: v.channelId,
            title: v.channelTitle,
            trust_tier: "external",
            is_active: false, // 스캔 대상은 아님. 검색으로 걸린 것만 담는다.
          },
          { onConflict: "youtube_channel_id" },
        )
        .select("id, youtube_channel_id, title, trust_tier, owner_person")
        .single();
      if (!data) continue;
      channel = data as ChannelLite;
      known.set(v.channelId, channel);
    }

    const input = {
      title: v.title,
      description: v.description,
      channelTitle: v.channelTitle,
      trustTier: channel.trust_tier,
      ownerPerson: channel.owner_person,
    };

    const score = scoreRelevance(input);
    const people = detectPeople(input);
    // 점수 미달(hidden) 영상도 행은 남긴다. 나중에 기준을 조정하면 재평가할 수 있고,
    // 무엇보다 같은 영상을 매 회차마다 다시 상세 조회하는 낭비를 막는다.
    const status = statusFromScore(score, channel.trust_tier, qualifyingHits(people));
    // CDN 판정이 실패하면(네트워크 문제 등) 길이 기반으로 대체한다.
    const shortProbe = await probeIsShort(v.id);
    const isVertical = shortProbe ?? isShort(v.durationSeconds);

    const { data: saved, error } = await db
      .from("videos")
      .upsert(
        {
          youtube_video_id: v.id,
          channel_id: channel.id,
          title: v.title,
          description: v.description,
          published_at: v.publishedAt,
          duration_seconds: v.durationSeconds,
          is_short: isVertical,
          thumbnail_url: v.thumbnailUrl,
          view_count: v.viewCount,
          like_count: v.likeCount,
          comment_count: v.commentCount,
          category: classifyCategory(v.title, v.description),
          relevance_score: score,
          status,
          discovered_via: discoveredVia,
          stats_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "youtube_video_id" },
      )
      .select("id")
      .single();

    if (error || !saved) {
      console.error("  ✗ " + v.title + " — " + (error?.message ?? "저장 실패"));
      continue;
    }

    if (people.length) {
      await db
        .from("video_people")
        .upsert(
          people.map((p) => ({ video_id: saved.id, person: p.person, source: p.source })),
          { onConflict: "video_id,person" },
        );
    }
    count++;
  }

  return count;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

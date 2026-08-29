/**
 * 채널 핸들/사용자명을 실제 channelId(UC...)로 확정하고 channels 테이블에 시드한다.
 *
 * 핸들은 소유자가 언제든 바꿀 수 있어서 수집 로직이 조용히 깨질 수 있다.
 * 그래서 최초 1회 이걸로 ID를 못박아두고, 이후 수집기는 ID만 쓴다 (ADR-004).
 *
 *   npm run resolve:channels
 *   npm run resolve:channels -- @어떤채널 UCxxxx
 */

import { config } from "dotenv";
import { YouTubeClient } from "../src/lib/youtube";
import { createAdminClient } from "../src/lib/supabase/admin";
import type { TrustTier } from "../src/lib/constants";

config({ path: ".env.local" });

/**
 * 수집 대상 채널.
 *
 * 2026-08-29 실행으로 확정된 사실:
 *   - @YonjourLeeyongju 와 레거시 angaru86 은 **동일 채널**이다.
 *     둘 다 UCEdixbN7er9w3--3v3ResOQ 로 환원된다.
 *   - 피식대학 핸들은 @pssdaehak 이 아니라 @psickuniv 다.
 */
const SEEDS: { input: string; tier: TrustTier }[] = [
  // 인물 본인 채널 — owner_person 이 지정되어 있어 전 영상이 노출된다 (ADR-026)
  { input: "UCEdixbN7er9w3--3v3ResOQ", tier: "primary" }, // 용쥬르이용주 (이용주)
  { input: "UCQmGQPqJyCE722ML7GoOL8Q", tier: "primary" }, // 유스데스크 (유영우)
  { input: "UCDItsw2i7cSkRkU59afcLuA", tier: "primary" }, // 퍼스트펭귄 이선민 (이선민)
  { input: "UCGX5sP4ehBkihHwt5bs5wvg", tier: "affiliate" }, // 피식대학 Psick Univ
  { input: "UCZu0XtdsIBylrVyRyvah02w", tier: "affiliate" }, // Metacomedy
  { input: "UC-OcDPFxfY9Hhdf5P9zq7-A", tier: "affiliate" }, // 메타코미디클럽
  { input: "UCEUL40nXJFCBv9z3Q1V6YMQ", tier: "affiliate" }, // 면상들
  { input: "UCL78V7SKGFWqIaNinBcn7-A", tier: "affiliate" }, // 더면상
];

async function main() {
  const extra = process.argv.slice(2);
  const targets = extra.length
    ? extra.map((input) => ({ input, tier: "external" as TrustTier }))
    : SEEDS;

  const yt = new YouTubeClient(process.env.YOUTUBE_API_KEY ?? "");
  const db = createAdminClient();

  const seen = new Map<string, string>();

  for (const { input, tier } of targets) {
    let channel;
    try {
      channel = await yt.resolveChannel(input);
    } catch (err) {
      console.error("  ✗ " + input + " — 조회 실패: " + (err as Error).message);
      continue;
    }

    if (!channel) {
      console.warn("  ? " + input + " — 채널을 찾지 못했습니다 (핸들이 바뀌었을 수 있음)");
      continue;
    }

    const dup = seen.get(channel.id);
    if (dup) {
      console.log("  = " + input + " 는 " + dup + " 와 동일한 채널입니다 (" + channel.id + ")");
      continue;
    }
    seen.set(channel.id, input);

    const { error } = await db.from("channels").upsert(
      {
        youtube_channel_id: channel.id,
        handle: channel.handle ?? null,
        title: channel.title,
        thumbnail_url: channel.thumbnailUrl ?? null,
        trust_tier: tier,
        // 검색으로 먼저 발견돼 is_active=false 로 들어와 있던 채널도 여기서 켜준다.
        is_active: true,
      },
      { onConflict: "youtube_channel_id" },
    );

    if (error) {
      console.error("  ✗ " + channel.title + " — DB 저장 실패: " + error.message);
      continue;
    }

    console.log("  ✓ " + channel.title);
    console.log("      channelId : " + channel.id);
    console.log("      handle    : " + (channel.handle ?? "-"));
    console.log("      uploads   : " + channel.uploadsPlaylistId);
    console.log("      trust_tier: " + tier);
  }

  console.log("\n사용한 할당량: " + yt.quota.used + " 유닛");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

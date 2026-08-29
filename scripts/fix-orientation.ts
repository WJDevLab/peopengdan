/**
 * 기존에 수집된 영상의 is_short(세로/쇼츠 여부)를 다시 판정한다.
 *
 * 60초 길이 컷으로 판정하던 기존 로직이, 유튜브가 쇼츠 최대 길이를
 * 60초에서 3분으로 늘리면서 60~180초짜리 실제 쇼츠를 "가로 영상"으로
 * 잘못 분류하는 사고를 냈다. probeIsShort() 는 길이 대신 유튜브 CDN의
 * oar2.jpg(쇼츠 전용 세로 썸네일) 존재 여부로 판정하므로 정확하다.
 * Data API를 부르지 않아 할당량을 전혀 쓰지 않는다.
 *
 *   npm run fix:orientation
 */

import { config } from "dotenv";
import { createAdminClient } from "../src/lib/supabase/admin";
import { probeIsShort } from "../src/lib/youtube";

config({ path: ".env.local" });

const PAGE = 500;
const CONCURRENCY = 15;

async function pooledMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function main() {
  const db = createAdminClient();

  let from = 0;
  let scanned = 0;
  let changed = 0;
  let probeFailed = 0;

  for (;;) {
    const { data: rows, error } = await db
      .from("videos")
      .select("id, youtube_video_id, duration_seconds, is_short")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error("videos 조회 실패: " + error.message);
    if (!rows?.length) break;

    const results = await pooledMap(rows, CONCURRENCY, async (v) => ({
      row: v,
      probe: await probeIsShort(v.youtube_video_id as string),
    }));

    for (const { row: v, probe } of results) {
      scanned++;
      if (probe === null) {
        probeFailed++;
        continue;
      }
      if (probe === v.is_short) continue;

      const { error: upError } = await db
        .from("videos")
        .update({ is_short: probe, updated_at: new Date().toISOString() })
        .eq("id", v.id);
      if (upError) {
        console.error("  ✗ " + v.youtube_video_id + " — " + upError.message);
        continue;
      }
      changed++;
    }

    from += PAGE;
    console.log("  " + scanned + "건 확인 · " + changed + "건 수정…");
  }

  console.log("\n완료 — 확인 " + scanned + "건 / 수정 " + changed + "건 / 판정 실패 " + probeFailed + "건");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

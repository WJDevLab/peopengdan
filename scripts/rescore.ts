/**
 * 이미 수집된 영상을 다시 채점한다. YouTube API를 한 번도 부르지 않는다.
 *
 * 점수 기준을 바꾸거나 채널 등급(trust_tier)을 조정하면 기존 행의 점수가
 * 옛 기준에 머물러 있게 된다. 그때 이걸 돌린다. 채점 규칙은 src/lib/classify.ts
 * 한 곳에만 있으므로 수집기와 결과가 항상 일치한다.
 *
 *   npm run rescore
 */

import { config } from "dotenv";
import { createAdminClient } from "../src/lib/supabase/admin";
import {
  classifyCategory,
  detectPeople,
  qualifyingHits,
  scoreRelevance,
  statusFromScore,
} from "../src/lib/classify";
import type { PersonSlug, TrustTier } from "../src/lib/constants";

config({ path: ".env.local" });

const PAGE = 500;

async function main() {
  const db = createAdminClient();

  const { data: channels, error: chError } = await db
    .from("channels")
    .select("id, title, trust_tier, owner_person");
  if (chError) throw new Error("channels 조회 실패: " + chError.message);

  const tierOf = new Map<string, { title: string; tier: TrustTier; owner: PersonSlug | null }>();
  for (const c of channels ?? []) {
    tierOf.set(c.id as string, {
      title: c.title as string,
      tier: c.trust_tier as TrustTier,
      owner: (c.owner_person as PersonSlug | null) ?? null,
    });
  }

  let from = 0;
  let scanned = 0;
  let changed = 0;
  const statusCount: Record<string, number> = { published: 0, maybe: 0, hidden: 0 };

  for (;;) {
    const { data: rows, error } = await db
      .from("videos")
      .select("id, channel_id, title, description, relevance_score, status, category, manual_override")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error("videos 조회 실패: " + error.message);
    if (!rows?.length) break;

    for (const v of rows) {
      // 어드민이 숨김 영상을 수동으로 공개 전환한 행은 재계산하지 않는다.
      if (v.manual_override) { scanned++; continue; }

      const channel = tierOf.get(v.channel_id as string);
      if (!channel) continue;

      const input = {
        title: v.title as string,
        description: v.description as string | null,
        channelTitle: channel.title,
        trustTier: channel.tier,
        ownerPerson: channel.owner,
      };

      const score = scoreRelevance(input);
      const people = detectPeople(input);
      const status = statusFromScore(score, channel.tier, qualifyingHits(people));
      const category = classifyCategory(input.title, input.description);
      statusCount[status]++;
      scanned++;

      if (score === v.relevance_score && status === v.status && category === v.category) continue;

      const { error: upError } = await db
        .from("videos")
        .update({ relevance_score: score, status, category, updated_at: new Date().toISOString() })
        .eq("id", v.id);
      if (upError) {
        console.error("  ✗ " + v.title + " — " + upError.message);
        continue;
      }

      // 등급이 올라가면서 새로 붙는 인물 태그가 있을 수 있다.
      if (people.length) {
        await db
          .from("video_people")
          .upsert(
            people.map((p) => ({ video_id: v.id, person: p.person, source: p.source })),
            { onConflict: "video_id,person" },
          );
      }
      changed++;
    }

    from += PAGE;
    console.log("  " + scanned + "건 처리…");
  }

  console.log("\n완료 — 검사 " + scanned + "건 / 변경 " + changed + "건");
  console.log(
    "  노출 " + statusCount.published +
    " / 애매 " + statusCount.maybe +
    " / 숨김 " + statusCount.hidden,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

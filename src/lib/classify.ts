/**
 * 제목·설명·채널로부터 인물 / 카테고리 / 신뢰도 점수를 산출한다.
 * 규칙 기반이며 외부 API를 호출하지 않는다 (ADR-005: LLM 판정은 유료라 배제).
 */

import {
  BLACKLIST_KEYWORDS,
  CATEGORIES,
  PEOPLE,
  SCORE,
  SERIES_KEYWORDS,
  SHORT_MAX_SECONDS,
  THRESHOLD,
  type CategorySlug,
  type PersonSlug,
  type TrustTier,
  type VideoStatus,
} from "./constants";

export type PersonSource = "channel" | "title" | "hashtag" | "description";
export type PersonHit = { person: PersonSlug; source: PersonSource };

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase();

/**
 * 설명란의 해시태그(#이름)만 뽑는다. 해시태그는 업로더가 "이 영상"의 내용을
 * 콕 집어 붙인 태그라 영상마다 다르다. 반면 인스타 링크 같은 크레딧 문단은
 * 여러 영상에 그대로 복사되는 고정 문구라 여전히 믿지 않는다 (ADR-027).
 */
function hashtagsOf(text: string): Set<string> {
  const tags = new Set<string>();
  for (const m of text.matchAll(/#([^\s#]+)/g)) tags.add(m[1]);
  return tags;
}

export type ClassifyInput = {
  title: string;
  description?: string | null;
  channelTitle?: string | null;
  trustTier: TrustTier;
  /** 이 채널이 세 사람 중 한 명의 본인 채널이면 그 slug. (ADR-026) */
  ownerPerson?: PersonSlug | null;
};

/**
 * 등장 인물을 찾는다. 인물당 가장 신뢰도 높은 출처 하나만 기록한다.
 * 출처 우선순위: channel > title > hashtag > description.
 */
export function detectPeople(input: ClassifyInput): PersonHit[] {
  const title = norm(input.title);
  const description = norm(input.description);
  const channelTitle = norm(input.channelTitle);
  const descHashtags = hashtagsOf(description);
  const hits: PersonHit[] = [];

  for (const p of PEOPLE) {
    const name = p.name.toLowerCase();

    if (input.ownerPerson === p.slug || channelTitle.includes(name)) {
      hits.push({ person: p.slug, source: "channel" });
    } else if (title.includes(name)) {
      hits.push({ person: p.slug, source: "title" });
    } else if (descHashtags.has(name)) {
      hits.push({ person: p.slug, source: "hashtag" });
    } else if (description.includes(name)) {
      hits.push({ person: p.slug, source: "description" });
    }
  }
  return hits;
}

/**
 * 노출 자격이 있는 인물 신호의 수.
 *
 * 설명란의 일반 문장 매칭은 세지 않는다(ADR-027). 많은 채널이 설명란에
 * 고정 문구로 출연진과 인스타 링크를 박아두기 때문에, 그것만 믿으면 그
 * 채널 영상 전부가 통과해버린다 — 실제로 유스데스크 1,674건이 그렇게
 * 새어 들어왔다. 다만 해시태그(#이름)는 영상마다 다르게 붙는 구체적
 * 태그라 title과 동급으로 인정한다.
 */
export function qualifyingHits(hits: PersonHit[]): number {
  return hits.filter((h) => h.source !== "description").length;
}

/** 카테고리는 위에서부터 순서대로 판정하고 첫 매치에서 멈춘다. */
export function classifyCategory(title: string, description?: string | null): CategorySlug {
  const haystack = `${norm(title)} ${norm(description)}`;
  for (const c of CATEGORIES) {
    if (c.keywords.some((k) => haystack.includes(k.toLowerCase()))) return c.slug;
  }
  return "etc";
}

export function isShort(durationSeconds: number | null | undefined): boolean {
  return (
    typeof durationSeconds === "number" &&
    durationSeconds > 0 &&
    durationSeconds <= SHORT_MAX_SECONDS
  );
}

/** 0~100 신뢰도 점수. Notion 7.4 표와 1:1 대응한다. */
export function scoreRelevance(input: ClassifyInput): number {
  const title = norm(input.title);
  const description = norm(input.description);
  const channelTitle = norm(input.channelTitle);

  let score: number = SCORE.tier[input.trustTier];

  // 본인 채널이면 제목에 이름이 없어도 확실한 관련 콘텐츠다.
  if (input.ownerPerson) score += SCORE.ownerChannel;

  // 해시태그는 title과 동급으로 센다 (qualifyingHits와 동일한 기준).
  const descHashtags = hashtagsOf(description);
  const inTitleOrTag = PEOPLE.filter(
    (p) => title.includes(p.name.toLowerCase()) || descHashtags.has(p.name.toLowerCase()),
  );
  if (inTitleOrTag.length >= 2) score += SCORE.titleTwoPlusPeople;
  else if (inTitleOrTag.length === 1) score += SCORE.titleOnePerson;

  if (PEOPLE.some((p) => description.includes(p.name.toLowerCase()))) {
    score += SCORE.descriptionPerson;
  }

  if (SERIES_KEYWORDS.some((k) => `${title} ${description}`.includes(k.toLowerCase()))) {
    score += SCORE.seriesKeyword;
  }

  if (PEOPLE.some((p) => channelTitle.includes(p.name.toLowerCase()))) {
    score += SCORE.channelNamePerson;
  }

  // 풀네임 없이 이름만 등장하면 동명이인일 확률이 높다.
  const fullNameAnywhere = PEOPLE.some((p) =>
    `${title} ${description}`.includes(p.name.toLowerCase()),
  );
  const givenNameOnly =
    !fullNameAnywhere && PEOPLE.some((p) => title.includes(p.given.toLowerCase()));
  if (givenNameOnly) score += SCORE.givenNameOnly;

  // 블랙리스트는 external 채널에만 적용한다 (본 채널 오탐 방지).
  if (input.trustTier === "external") {
    const haystack = `${title} ${description} ${channelTitle}`;
    if (BLACKLIST_KEYWORDS.some((k) => haystack.includes(k))) score += SCORE.blacklist;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 노출 여부 판정 (ADR-006, ADR-025, ADR-026).
 *
 *   1) 인물 본인 채널(primary)은 점수와 무관하게 항상 노출.
 *   2) 그 외 채널은 **제목이나 채널명에서 인물이 잡히지 않으면 숨김.**
 *      채널 등급은 "관련도를 높이는 근거"이지 "관련의 증거"가 아니다.
 *   3) 인물이 잡힌 경우에만 점수로 확실/애매를 가른다.
 */
export function statusFromScore(
  score: number,
  trustTier: TrustTier,
  qualifying: number,
): VideoStatus {
  if (trustTier === "primary") return "published";
  if (qualifying === 0) return "hidden";
  if (score >= THRESHOLD.published) return "published";
  if (score >= THRESHOLD.maybe) return "maybe";
  return "hidden";
}

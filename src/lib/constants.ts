/**
 * 퍼스트펭귄단 — 분류 및 점수 산정 기준값.
 * Notion 기획 문서 7번 섹션 "콘텐츠 수집 기준"과 동기화되어 있음.
 */

export const PEOPLE = [
  { slug: "yongju", name: "이용주", given: "용주" },
  { slug: "seonmin", name: "이선민", given: "선민" },
  { slug: "yeongwoo", name: "유영우", given: "영우" },
] as const;

export type PersonSlug = (typeof PEOPLE)[number]["slug"];

export const CATEGORIES = [
  { slug: "raid", label: "급습 시리즈", keywords: ["급습"] },
  {
    slug: "music",
    label: "음악·밈",
    keywords: ["리믹스", "비트박스", "불후의 명곡", "알바몬", "커버", "노래"],
  },
  { slug: "vlog", label: "브이로그", keywords: ["브이로그", "vlog", "일상"] },
  { slug: "etc", label: "기타", keywords: [] },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export type TrustTier = "primary" | "affiliate" | "external";
export type VideoStatus = "published" | "maybe" | "hidden";

/** 이 팬덤 고유의 시리즈·구호 키워드. 등장하면 관련도가 크게 올라간다. */
export const SERIES_KEYWORDS = [
  "급습",
  "퍼스트펭귄",
  "퍼스트 펭귄",
  "용쥬르",
  "선민이네",
];

/**
 * 동명이인 배제용 블랙리스트.
 * 주의: external 채널에만 적용한다. 급습 시리즈의 시초가 "축구 보기"였으므로
 * '축구' 같은 넓은 단어는 절대 넣지 말 것 — 본편이 통째로 걸러진다.
 */
export const BLACKLIST_KEYWORDS = [
  "수원fc",
  "k리그",
  "프로축구",
  "축구선수",
  "아나운서",
  "앵커",
  "국회의원",
  "변호사",
  "교수님",
];

export const SCORE = {
  tier: { primary: 60, affiliate: 35, external: 0 },
  /** 세 사람 중 한 명의 본인 채널 (ADR-026). */
  ownerChannel: 30,
  titleOnePerson: 25,
  titleTwoPlusPeople: 35,
  descriptionPerson: 10,
  seriesKeyword: 15,
  channelNamePerson: 10,
  givenNameOnly: -15,
  blacklist: -40,
} as const;

/**
 * 점수 임계값 (ADR-023).
 *
 * 70점 이상은 확실한 것, 25~69점은 애매한 것. 둘 다 같은 그리드에 넣되
 * 확실한 쪽을 앞에 둔다. 별도 '관련 있을지도' 섹션은 없앴다.
 * 25점까지 낮춘 이유는 영상 수가 너무 적었기 때문이다.
 */
export const THRESHOLD = { published: 70, maybe: 25 } as const;

/** 숏츠 판정 기준(초). 형식 플래그이며 category와 독립적이다. */
export const SHORT_MAX_SECONDS = 60;

/**
 * 영상 유형. 내용(category)과 완전히 별개인 형식 축이다 (ADR-024).
 * 숏츠를 분류 칩에서 빼고 여기로 옮겼다 — 숏츠로 올라온 급습편이 존재하므로
 * 둘을 한 줄에 섞으면 "급습이면서 숏츠"인 영상을 가리킬 방법이 없어진다.
 */
export const ORIENTATIONS = [
  { slug: "wide", label: "가로 영상" },
  { slug: "vertical", label: "세로 영상" },
] as const;

export type OrientationSlug = (typeof ORIENTATIONS)[number]["slug"];

/** 정렬 옵션. URL 쿼리(?sort=)에 그대로 실린다 (ADR-013). */
export const SORTS = [
  { slug: "latest", label: "최신순", column: "published_at", ascending: false },
  { slug: "views", label: "조회수순", column: "view_count", ascending: false },
  { slug: "oldest", label: "과거순", column: "published_at", ascending: true },
] as const;

export type SortSlug = (typeof SORTS)[number]["slug"];
export const DEFAULT_SORT: SortSlug = "latest";

export function resolveSort(input: string | undefined) {
  return SORTS.find((s) => s.slug === input) ?? SORTS[0];
}

/** 좌측 사이드바 메뉴 (ADR-017). */
export const NAV = [
  { href: "/", label: "영상", icon: "video" },
  { href: "/board", label: "게시판", icon: "board" },
  { href: "/schedule", label: "일정", icon: "calendar" },
  { href: "/report", label: "제보하기", icon: "report" },
] as const;

/** 게시판 말머리. */
export const BOARD_CATEGORIES = [
  { slug: "chat", label: "잡담" },
  { slug: "recommend", label: "영상추천" },
  { slug: "question", label: "질문" },
  { slug: "review", label: "후기" },
  { slug: "goods", label: "굿즈" },
] as const;

export type BoardCategory = (typeof BOARD_CATEGORIES)[number]["slug"];

export const boardCategoryLabel = (slug: string) =>
  BOARD_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;

/**
 * 일정 종류. 달력에서 색으로 구분한다.
 * 물 위에서도 물속에서도 읽히도록 채도를 낮추지 않았다.
 */
export const EVENT_KINDS = [
  { slug: "broadcast", label: "방송", color: "#2F80D8" },
  { slug: "show", label: "공연", color: "#D64B12" },
  { slug: "upload", label: "업로드", color: "#129E6A" },
  { slug: "etc", label: "기타", color: "#8558D6" },
] as const;

export type EventKind = (typeof EVENT_KINDS)[number]["slug"];

export const eventKind = (slug: string) =>
  EVENT_KINDS.find((k) => k.slug === slug) ?? EVENT_KINDS[3];

/** 제보 처리 상태. */
export const REPORT_STATUS = [
  { slug: "received", label: "접수됨" },
  { slug: "reviewing", label: "확인 중" },
  { slug: "done", label: "처리 완료" },
] as const;

export type ReportStatus = (typeof REPORT_STATUS)[number]["slug"];

export const reportStatusLabel = (slug: string) =>
  REPORT_STATUS.find((s) => s.slug === slug)?.label ?? slug;

export const REPORT_KINDS = [
  { slug: "video", label: "영상 문제" },
  { slug: "post", label: "게시글 문제" },
  { slug: "etc", label: "기타 문의" },
] as const;

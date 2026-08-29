import type { CategorySlug, PersonSlug, TrustTier, VideoStatus } from "@/lib/constants";

export type ChannelRow = {
  id: string;
  youtube_channel_id: string;
  handle: string | null;
  title: string;
  thumbnail_url: string | null;
  trust_tier: TrustTier;
  is_active: boolean;
  created_at: string;
};

export type VideoRow = {
  id: string;
  youtube_video_id: string;
  channel_id: string;
  title: string;
  description: string | null;
  published_at: string;
  duration_seconds: number | null;
  is_short: boolean;
  thumbnail_url: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  category: CategorySlug;
  relevance_score: number;
  status: VideoStatus;
  discovered_via: "channel_scan" | "keyword_search" | null;
  stats_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoPeopleRow = {
  video_id: string;
  person: PersonSlug;
  source: "channel" | "title" | "description" | "manual";
};

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: "member" | "admin";
  created_at: string;
};

export type BlockedVideoRow = {
  youtube_video_id: string;
  title: string | null;
  reason: string | null;
  blocked_by: string | null;
  blocked_at: string;
};

/** 목록 화면에서 실제로 쓰는 컬럼만 추린 형태. */
export type VideoCard = {
  id: string;
  youtube_video_id: string;
  title: string;
  published_at: string;
  duration_seconds: number | null;
  is_short: boolean;
  thumbnail_url: string | null;
  view_count: number | null;
  category: CategorySlug;
  relevance_score: number;
  status: VideoStatus;
  is_pinned: boolean;
  channel: Pick<ChannelRow, "title" | "youtube_channel_id" | "trust_tier"> | null;
  people: PersonSlug[];
};

/** 화면에 실제로 노출하는 두 단계. 'hidden' 은 조회하지 않는다. */
export type VideoStatusFilter = Extract<VideoStatus, "published" | "maybe">;

/** 글쓴이 표시용. 이메일은 컬럼 GRANT 로 잠겨 있어 여기에 없다. */
export type AuthorLite = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "member" | "admin";
} | null;

export type PostListItem = {
  id: string;
  category: string;
  title: string;
  is_notice: boolean;
  is_pinned: boolean;
  view_count: number;
  comment_count: number;
  created_at: string;
  author: AuthorLite;
};

export type PostDetail = PostListItem & {
  body: string;
  updated_at: string;
  author_id: string;
};

export type CommentItem = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: AuthorLite;
};

export type EventItem = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  starts_on: string;
  ends_on: string | null;
  start_time: string | null;
  location: string | null;
  link: string | null;
  people: PersonSlug[];
};

export type ReportItem = {
  id: string;
  kind: string;
  target_url: string | null;
  message: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  reporter_id: string;
  reporter: AuthorLite;
};

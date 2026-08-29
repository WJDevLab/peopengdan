-- 퍼스트펭귄단 초기 스키마
-- Notion 기획 문서 6번 섹션 "데이터 구조"와 동기화되어 있음.

-- ── 채널 마스터 ──────────────────────────────────────────────────
create table if not exists channels (
  id                 uuid primary key default gen_random_uuid(),
  youtube_channel_id text unique not null,                  -- UC... (핸들이 아닌 ID로 고정: ADR-004)
  handle             text,
  title              text not null,
  thumbnail_url      text,
  trust_tier         text not null default 'external'
                     check (trust_tier in ('primary', 'affiliate', 'external')),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ── 영상 ────────────────────────────────────────────────────────
create table if not exists videos (
  id               uuid primary key default gen_random_uuid(),
  youtube_video_id text unique not null,
  channel_id       uuid not null references channels(id) on delete cascade,
  title            text not null,
  description      text,
  published_at     timestamptz not null,
  duration_seconds int,
  is_short         boolean not null default false,          -- 형식. category와 독립 (ADR-007)
  thumbnail_url    text,
  view_count       bigint,
  like_count       bigint,
  comment_count    bigint,
  category         text not null default 'etc'
                   check (category in ('raid', 'vlog', 'music', 'etc')),
  relevance_score  int not null default 0,
  status           text not null default 'hidden'
                   check (status in ('published', 'maybe', 'hidden')),
  discovered_via   text check (discovered_via in ('channel_scan', 'keyword_search')),
  stats_updated_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists videos_feed_idx     on videos (status, published_at desc);
create index if not exists videos_category_idx on videos (category);
create index if not exists videos_channel_idx  on videos (channel_id);
create index if not exists videos_search_idx   on videos
  using gin (to_tsvector('simple', title || ' ' || coalesce(description, '')));

-- ── 영상 ↔ 인물 (다대다) ─────────────────────────────────────────
create table if not exists video_people (
  video_id uuid not null references videos(id) on delete cascade,
  person   text not null check (person in ('yongju', 'seonmin', 'yeongwoo')),
  source   text not null check (source in ('channel', 'title', 'description', 'manual')),
  primary key (video_id, person)
);

create index if not exists video_people_person_idx on video_people (person);

-- ── 타 채널 탐색용 검색어 (코드가 아닌 DB로 관리: ADR-008) ────────
create table if not exists search_keywords (
  id          uuid primary key default gen_random_uuid(),
  keyword     text unique not null,
  is_active   boolean not null default true,
  last_run_at timestamptz
);

-- ── 수집 실행 로그 (할당량 추적) ─────────────────────────────────
create table if not exists collection_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  quota_used    int not null default 0,
  videos_seen   int not null default 0,
  videos_new    int not null default 0,
  status        text not null default 'running'
                check (status in ('running', 'success', 'failed')),
  error_message text
);

-- ── 웹 푸시 구독 (Post-MVP) ─────────────────────────────────────
create table if not exists push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  endpoint         text unique not null,
  p256dh           text not null,
  auth             text not null,
  created_at       timestamptz not null default now(),
  last_notified_at timestamptz
);

-- ── RLS: 공개 읽기 전용. 쓰기는 service_role 키를 쓰는 수집기만 ──
alter table channels           enable row level security;
alter table videos             enable row level security;
alter table video_people       enable row level security;
alter table push_subscriptions enable row level security;

-- 운영용 내부 테이블. 정책을 하나도 만들지 않으면 anon 키로는 아무것도 못 한다.
-- service_role 은 RLS를 우회하므로 수집기만 접근할 수 있다.
alter table search_keywords  enable row level security;
alter table collection_runs  enable row level security;

create policy "public read channels"     on channels     for select using (true);
create policy "public read videos"       on videos       for select using (true);
create policy "public read video_people" on video_people for select using (true);
-- 푸시 구독은 누구나 등록 가능하되 조회는 불가
create policy "public insert push" on push_subscriptions for insert with check (true);

-- ── 초기 검색어 시드 ────────────────────────────────────────────
insert into search_keywords (keyword) values
  ('이용주 이선민'),
  ('이용주 유영우'),
  ('용쥬르'),
  ('퍼스트펭귄 이용주'),
  ('선민이네 급습')
on conflict (keyword) do nothing;

-- 퍼스트펭귄단 — 게시판 · 일정 · 제보 · 고정
-- Notion ADR-017 ~ ADR-020 참조.

-- ═══════════════════════════════════════════════════════════
-- 0. 최초 어드민 자동 지정
-- ═══════════════════════════════════════════════════════════
-- 이메일을 미리 등록해두면 그 계정이 처음 로그인하는 순간 어드민이 된다.
-- 로그인 전에는 auth.users 에 행이 없어서 수동 UPDATE 가 불가능하기 때문.
create table if not exists bootstrap_admins (
  email text primary key
);

insert into bootstrap_admins (email) values ('wjdevlab@gmail.com')
on conflict (email) do nothing;

alter table bootstrap_admins enable row level security;
-- 정책 없음: service_role 과 security definer 함수만 접근한다.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  assigned_role text := 'member';
begin
  if exists (
    select 1 from bootstrap_admins
    where lower(email) = lower(new.email)
  ) then
    assigned_role := 'admin';
  end if;

  insert into profiles (id, email, display_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    assigned_role
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- 1. 영상 고정
-- ═══════════════════════════════════════════════════════════
alter table videos add column if not exists is_pinned boolean not null default false;
create index if not exists videos_pinned_idx on videos (is_pinned desc, published_at desc);

drop policy if exists "어드민만 영상 수정" on videos;
create policy "어드민만 영상 수정" on videos
  for update using (is_admin()) with check (is_admin());

-- ═══════════════════════════════════════════════════════════
-- 2. 게시판
-- ═══════════════════════════════════════════════════════════
create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references profiles(id) on delete cascade,
  category      text not null default 'chat'
                check (category in ('chat', 'recommend', 'question', 'review', 'goods')),
  title         text not null check (length(btrim(title)) between 1 and 120),
  body          text not null check (length(btrim(body)) between 1 and 20000),
  is_notice     boolean not null default false,
  is_pinned     boolean not null default false,
  view_count    int not null default 0,
  comment_count int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists posts_feed_idx     on posts (is_notice desc, is_pinned desc, created_at desc);
create index if not exists posts_category_idx on posts (category, created_at desc);
create index if not exists posts_author_idx   on posts (author_id);

create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_post_idx on comments (post_id, created_at);

/**
 * 공지·고정은 어드민 전용 표식이다.
 * RLS의 with check 로는 "이 컬럼만은 못 바꾼다"를 표현하기 어려워서 트리거로 막는다.
 * 일반 회원이 어떤 경로로 true 를 보내든 여기서 되돌린다.
 */
create or replace function guard_post_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_notice := false;
    new.is_pinned := false;
  else
    new.is_notice := old.is_notice;
    new.is_pinned := old.is_pinned;
    -- 조회수·댓글수는 트리거와 RPC가 관리한다. 회원이 직접 바꾸지 못한다.
    new.view_count := old.view_count;
    new.comment_count := old.comment_count;
  end if;
  return new;
end;
$fn$;

revoke all on function public.guard_post_flags() from public, anon, authenticated;

drop trigger if exists posts_guard_flags on posts;
create trigger posts_guard_flags
  before insert or update on posts
  for each row execute function guard_post_flags();

/** 댓글 수를 게시글에 반영한다. 목록에서 매번 세지 않으려는 것. */
create or replace function sync_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  else
    update posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    return old;
  end if;
end;
$fn$;

revoke all on function public.sync_comment_count() from public, anon, authenticated;

drop trigger if exists comments_sync_count on comments;
create trigger comments_sync_count
  after insert or delete on comments
  for each row execute function sync_comment_count();

-- 조회수 증가는 RPC로 열지 않는다. public 스키마 함수는 REST(`/rest/v1/rpc/...`)에
-- 자동 노출되는데, SECURITY DEFINER 함수를 익명에게 여는 셈이 되기 때문이다.
-- 대신 게시글 상세 서버 컴포넌트가 service_role 클라이언트로 직접 올린다.

alter table posts enable row level security;
alter table comments enable row level security;

drop policy if exists "게시글 공개 조회" on posts;
create policy "게시글 공개 조회" on posts for select using (true);

drop policy if exists "회원만 글쓰기" on posts;
create policy "회원만 글쓰기" on posts
  for insert with check (auth.uid() = author_id);

drop policy if exists "본인 또는 어드민이 수정" on posts;
create policy "본인 또는 어드민이 수정" on posts
  for update using (author_id = auth.uid() or is_admin());

drop policy if exists "본인 또는 어드민이 삭제" on posts;
create policy "본인 또는 어드민이 삭제" on posts
  for delete using (author_id = auth.uid() or is_admin());

drop policy if exists "댓글 공개 조회" on comments;
create policy "댓글 공개 조회" on comments for select using (true);

drop policy if exists "회원만 댓글" on comments;
create policy "회원만 댓글" on comments
  for insert with check (auth.uid() = author_id);

drop policy if exists "본인 또는 어드민이 댓글 수정" on comments;
create policy "본인 또는 어드민이 댓글 수정" on comments
  for update using (author_id = auth.uid() or is_admin());

drop policy if exists "본인 또는 어드민이 댓글 삭제" on comments;
create policy "본인 또는 어드민이 댓글 삭제" on comments
  for delete using (author_id = auth.uid() or is_admin());

-- 글쓴이 표시(닉네임·아바타·등급)를 위해 프로필 공개 조회를 연다.
drop policy if exists "본인 프로필 조회" on profiles;
create policy "프로필 조회" on profiles for select using (true);

-- 다만 RLS는 "어느 행"만 통제할 뿐 "어느 컬럼"은 통제하지 않는다.
-- 위 정책만 두면 anon 키로 `select email from profiles` 가 그대로 통한다.
-- 그래서 컬럼 단위 GRANT 로 이메일만 잠근다.
revoke select on profiles from anon;
revoke select on profiles from authenticated;
grant select (id, display_name, avatar_url, role, created_at) on profiles to anon;
grant select (id, display_name, avatar_url, role, created_at) on profiles to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 3. 일정
-- ═══════════════════════════════════════════════════════════
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) between 1 and 120),
  description text,
  kind        text not null default 'etc'
              check (kind in ('broadcast', 'show', 'upload', 'etc')),
  starts_on   date not null,
  ends_on     date,                       -- null 이면 하루짜리
  start_time  time,                       -- null 이면 시간 미정
  location    text,                       -- 방송사 · 공연장 · 플랫폼
  link        text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index if not exists events_range_idx on events (starts_on, ends_on);

create table if not exists event_people (
  event_id uuid not null references events(id) on delete cascade,
  person   text not null check (person in ('yongju', 'seonmin', 'yeongwoo')),
  primary key (event_id, person)
);

create index if not exists event_people_person_idx on event_people (person);

alter table events       enable row level security;
alter table event_people enable row level security;

drop policy if exists "일정 공개 조회" on events;
create policy "일정 공개 조회" on events for select using (true);

drop policy if exists "어드민만 일정 등록" on events;
create policy "어드민만 일정 등록" on events for insert with check (is_admin());

drop policy if exists "어드민만 일정 수정" on events;
create policy "어드민만 일정 수정" on events for update using (is_admin()) with check (is_admin());

drop policy if exists "어드민만 일정 삭제" on events;
create policy "어드민만 일정 삭제" on events for delete using (is_admin());

drop policy if exists "일정 인물 공개 조회" on event_people;
create policy "일정 인물 공개 조회" on event_people for select using (true);

drop policy if exists "어드민만 일정 인물 등록" on event_people;
create policy "어드민만 일정 인물 등록" on event_people for insert with check (is_admin());

drop policy if exists "어드민만 일정 인물 삭제" on event_people;
create policy "어드민만 일정 인물 삭제" on event_people for delete using (is_admin());

-- ═══════════════════════════════════════════════════════════
-- 4. 제보 (1대1)
-- ═══════════════════════════════════════════════════════════
create table if not exists reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references profiles(id) on delete cascade,
  kind            text not null default 'etc'
                  check (kind in ('video', 'post', 'etc')),
  target_video_id uuid references videos(id) on delete set null,
  target_post_id  uuid references posts(id) on delete set null,
  target_url      text,
  message         text not null check (length(btrim(message)) between 1 and 4000),
  status          text not null default 'received'
                  check (status in ('received', 'reviewing', 'done')),
  admin_reply     text,
  replied_at      timestamptz,
  replied_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists reports_reporter_idx on reports (reporter_id, created_at desc);
create index if not exists reports_status_idx   on reports (status, created_at desc);

alter table reports enable row level security;

-- 제보는 1대1이다. 본인 것과 어드민만 볼 수 있다.
drop policy if exists "본인 제보 또는 어드민" on reports;
create policy "본인 제보 또는 어드민" on reports
  for select using (reporter_id = auth.uid() or is_admin());

drop policy if exists "회원만 제보" on reports;
create policy "회원만 제보" on reports
  for insert with check (auth.uid() = reporter_id);

-- 상태 변경과 답변은 어드민만. 제보자는 보낸 뒤 수정할 수 없다.
drop policy if exists "어드민만 제보 처리" on reports;
create policy "어드민만 제보 처리" on reports
  for update using (is_admin()) with check (is_admin());

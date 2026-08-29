-- 퍼스트펭귄단 — 로그인 · 권한 · 영상 차단
-- Notion 기획 문서 ADR-011, ADR-012 참조.

-- ═══════════════════════════════════════════════════════════
-- 1. 사용자 프로필과 역할
-- ═══════════════════════════════════════════════════════════
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  role         text not null default 'member' check (role in ('member', 'admin')),
  created_at   timestamptz not null default now()
);

-- 구글로 처음 로그인하면 프로필이 자동으로 생긴다.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

/**
 * 현재 로그인한 사용자가 어드민인지 판정한다.
 * security definer 라서 profiles 의 RLS를 우회하고, 그래서 정책 안에서 자기 자신을
 * 다시 조회하는 무한 재귀가 생기지 않는다.
 */
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table profiles enable row level security;

drop policy if exists "본인 프로필 조회" on profiles;
create policy "본인 프로필 조회" on profiles
  for select using (id = auth.uid() or is_admin());

drop policy if exists "본인 프로필 수정" on profiles;
create policy "본인 프로필 수정" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- 2. 차단된 영상 (재수집 방지)
-- ═══════════════════════════════════════════════════════════
create table if not exists blocked_videos (
  youtube_video_id text primary key,
  title            text,
  reason           text,
  blocked_by       uuid references profiles(id) on delete set null,
  blocked_at       timestamptz not null default now()
);

/**
 * 핵심 안전장치 (ADR-012).
 *
 * videos 에서 행이 지워지면 무조건 blocked_videos 에 흔적을 남긴다.
 * 앱 코드가 아니라 DB 트리거에 둔 이유: 어드민 화면이든, SQL 콘솔이든,
 * 나중에 추가될 어떤 경로로 지우든 차단 등록이 절대 누락되지 않게 하려는 것.
 * 이게 없으면 다음 수집(4시간 뒤)에 같은 영상이 그대로 되살아난다.
 */
create or replace function block_deleted_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into blocked_videos (youtube_video_id, title, blocked_by, reason)
  values (old.youtube_video_id, old.title, auth.uid(), '어드민 삭제')
  on conflict (youtube_video_id) do nothing;
  return old;
end;
$$;

drop trigger if exists on_video_deleted on videos;
create trigger on_video_deleted
  before delete on videos
  for each row execute function block_deleted_video();

alter table blocked_videos enable row level security;

drop policy if exists "어드민만 차단 목록 조회" on blocked_videos;
create policy "어드민만 차단 목록 조회" on blocked_videos
  for select using (is_admin());

drop policy if exists "어드민만 차단 해제" on blocked_videos;
create policy "어드민만 차단 해제" on blocked_videos
  for delete using (is_admin());

-- ═══════════════════════════════════════════════════════════
-- 3. 어드민에게 영상 삭제 권한 부여
-- ═══════════════════════════════════════════════════════════
drop policy if exists "어드민만 영상 삭제" on videos;
create policy "어드민만 영상 삭제" on videos
  for delete using (is_admin());

-- ═══════════════════════════════════════════════════════════
-- 4. 최초 어드민 지정
-- ═══════════════════════════════════════════════════════════
-- 구글로 한 번 로그인한 뒤, 아래 줄의 이메일을 본인 것으로 바꿔 실행하세요.
-- (로그인 전에는 auth.users 에 계정이 없어서 아무 행도 바뀌지 않습니다.)
--
--   update profiles set role = 'admin' where email = 'wjjeon77@gmail.com';

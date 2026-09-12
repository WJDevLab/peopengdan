-- Restrict direct Data API writes; server-maintained fields are not user input.
revoke update, insert on public.posts from anon, authenticated;
grant insert(author_id,title,body,category,is_notice,is_pinned) on public.posts to authenticated;
grant update(title,body,category,is_notice,is_pinned) on public.posts to authenticated;
revoke update, insert on public.comments from anon, authenticated;
grant insert(post_id,author_id,body) on public.comments to authenticated;
grant update(body) on public.comments to authenticated;

create or replace function public.guard_post_flags() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.role() = 'service_role' or pg_trigger_depth() > 1 or public.is_admin() then return new; end if;
  if tg_op='INSERT' then
    new.is_notice:=false; new.is_pinned:=false; new.view_count:=0; new.comment_count:=0;
  else
    new.is_notice:=old.is_notice; new.is_pinned:=old.is_pinned;
    new.view_count:=old.view_count; new.comment_count:=old.comment_count;
  end if;
  return new;
end; $$;
revoke all on function public.guard_post_flags() from public,anon,authenticated;

create or replace function public.limit_member_writes() returns trigger
language plpgsql security definer set search_path=public as $$
declare recent_count integer; max_count integer; actor uuid := auth.uid();
begin
  if actor is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || tg_table_name,0));
  new.created_at:=now();
  if tg_table_name='posts' then
    select count(*) into recent_count from posts where author_id=actor and created_at>now()-interval '1 minute';
    max_count:=3;
  elsif tg_table_name='comments' then
    select count(*) into recent_count from comments where author_id=actor and created_at>now()-interval '1 minute';
    max_count:=10;
  elsif tg_table_name='reports' then
    select count(*) into recent_count from reports where reporter_id=actor and created_at>now()-interval '1 minute';
    max_count:=3;
  else raise exception 'Unsupported write target';
  end if;
  if recent_count>=max_count then raise exception '잠시 후 다시 작성해 주세요. 너무 빠르게 등록하고 있습니다.' using errcode='P0001'; end if;
  return new;
end; $$;
revoke all on function public.limit_member_writes() from public,anon,authenticated;
create trigger posts_write_limit before insert on public.posts for each row execute function public.limit_member_writes();
create trigger comments_write_limit before insert on public.comments for each row execute function public.limit_member_writes();
create trigger reports_write_limit before insert on public.reports for each row execute function public.limit_member_writes();
create index if not exists posts_author_time_idx on public.posts(author_id,created_at desc);
create index if not exists comments_author_time_idx on public.comments(author_id,created_at desc);
create index if not exists reports_reporter_time_idx on public.reports(reporter_id,created_at desc);
create index if not exists blocked_videos_blocked_by_idx on public.blocked_videos(blocked_by);
create index if not exists events_created_by_idx on public.events(created_by);
create index if not exists reports_replied_by_idx on public.reports(replied_by);
create index if not exists reports_target_post_idx on public.reports(target_post_id);
create index if not exists reports_target_video_idx on public.reports(target_video_id);

revoke update on public.profiles from anon, authenticated;
grant update(display_name) on public.profiles to authenticated;
alter policy "public read videos" on public.videos using (status in ('published','maybe'));
create policy "admin read hidden videos" on public.videos for select to authenticated using ((select public.is_admin()));
alter policy "public read video_people" on public.video_people using (exists (select 1 from public.videos v where v.id=video_id));
revoke insert on public.reports from anon, authenticated;
grant insert(reporter_id,kind,target_url,target_video_id,target_post_id,message) on public.reports to authenticated;
drop policy if exists "public insert push" on public.push_subscriptions;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,display_name,avatar_url,role)
 values(new.id,new.email,public.generate_penguin_nickname(),null,'member')
 on conflict(id) do nothing;
 return new;
end; $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;

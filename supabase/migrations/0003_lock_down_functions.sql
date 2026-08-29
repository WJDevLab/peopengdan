-- 퍼스트펭귄단 — SECURITY DEFINER 함수 노출 차단
--
-- Supabase 보안 린터(0028/0029) 지적 사항 대응.
-- public 스키마의 함수는 자동으로 REST API(`/rest/v1/rpc/...`)에 노출되는데,
-- SECURITY DEFINER 함수는 정의자 권한으로 돌기 때문에 노출된 채로 두면 안 된다.

-- ── 트리거 전용 함수 ────────────────────────────────────────────
-- 이 둘은 트리거가 부를 때만 의미가 있고 직접 호출될 일이 없다.
-- 트리거 발화는 호출자의 EXECUTE 권한을 확인하지 않으므로 회수해도 안전하다.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

revoke all on function public.block_deleted_video() from public;
revoke all on function public.block_deleted_video() from anon;
revoke all on function public.block_deleted_video() from authenticated;

-- ── is_admin() ──────────────────────────────────────────────────
-- 이건 RLS 정책 안에서 쓰이므로 authenticated 에게는 EXECUTE 를 남겨야 한다.
-- 정책 표현식은 질의하는 역할의 권한으로 평가되기 때문에, 회수하면
-- 어드민의 삭제가 "permission denied for function is_admin" 으로 실패한다.
-- 비로그인(anon)은 이 함수를 쓸 일이 없으므로 회수한다.
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- ── 참고: 정책 없이 RLS만 켜둔 테이블 ───────────────────────────
-- search_keywords 와 collection_runs 는 정책을 일부러 만들지 않았다.
-- 정책이 하나도 없으면 anon·authenticated 는 아무것도 할 수 없고,
-- RLS를 우회하는 service_role(수집기)만 접근한다. 린터의 INFO 알림은
-- 이 의도된 상태를 가리키는 것이므로 조치하지 않는다.

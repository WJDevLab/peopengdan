import { createClient } from "@supabase/supabase-js";

/**
 * service_role 키를 쓰는 클라이언트. RLS를 전부 우회한다.
 * 수집 스크립트와 서버 라우트에서만 쓰고, 절대 브라우저 번들에 넣지 말 것.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

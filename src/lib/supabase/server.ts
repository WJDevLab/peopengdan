import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * 서버 컴포넌트 · 라우트 핸들러용 클라이언트.
 * 로그인 세션을 쿠키에서 읽어오므로 auth.uid() 기반 RLS가 그대로 적용된다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 미들웨어가 담당하므로
            // 여기서 실패하는 것은 정상이며 무시해도 된다.
          }
        },
      },
    },
  );
}

/** 현재 로그인 사용자와 프로필(역할 포함)을 함께 가져온다. */
export const getViewer = cache(async function getViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null, isAdmin: false };

  // email 은 컬럼 단위 GRANT 로 잠겨 있으므로 조회하지 않는다.
  // 어차피 auth.getUser() 가 본인 이메일을 주므로 필요도 없다.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  return { user, profile, isAdmin: profile?.role === "admin" };
});

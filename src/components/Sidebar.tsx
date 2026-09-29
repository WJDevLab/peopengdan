import Link from "next/link";
import { createClient, getViewer } from "@/lib/supabase/server";
import { AuthButton } from "./AuthButton";
import { Nav } from "./Nav";
import { SideAccount } from "./SideAccount";

/** 좌측 사이드바. 로고 · 로그인 카드 · 메뉴 (ADR-017). */
export async function Sidebar() {
  let viewer: Awaited<ReturnType<typeof getViewer>> = {
    user: null,
    profile: null,
    isAdmin: false,
  };
  let counts: Record<string, number> = {};

  try {
    viewer = await getViewer();
  } catch {
    // .env.local 미설정 상태에서도 사이드바는 그려야 한다.
  }

  try {
    const db = await createClient();
    const [videos, posts, hidden] = await Promise.all([
      db.from("videos").select("id", { count: "exact", head: true }).in("status", ["published", "maybe"]),
      db.from("posts").select("id", { count: "exact", head: true }),
      viewer.isAdmin
        ? db.from("videos").select("id", { count: "exact", head: true }).eq("status", "hidden")
        : Promise.resolve({ count: null }),
    ]);
    counts = {
      "/": videos.count ?? 0,
      "/board": posts.count ?? 0,
      "/admin/hidden": hidden.count ?? 0,
    };
  } catch {
    counts = {};
  }

  // 이메일이 아니라 닉네임만 보여준다. 이메일은 사이드바에도 띄우지 않는다.
  const name = viewer.profile?.display_name ?? null;
  const signedIn = Boolean(viewer.user);

  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <span className="glyph" aria-hidden="true">
          🐧
        </span>
        퍼스트펭귄단
      </Link>
      <p className="brand-sub">First Penguin Archive</p>

      <SideAccount initial={signedIn ? (name?.charAt(0) ?? "나") : null}>
        {name ? (
          <div className="who">
            <span className="avatar" aria-hidden="true">
              {name.charAt(0)}
            </span>
            <span className="name">{name}</span>
          </div>
        ) : (
          <p className="hint">로그인하면 글을 쓰고 제보를 보낼 수 있습니다.</p>
        )}

        <AuthButton signedIn={signedIn} isAdmin={viewer.isAdmin} />
      </SideAccount>

      <Nav counts={counts} isAdmin={viewer.isAdmin} />

      <p className="side-foot">
        유튜브 임베드 기반 팬 아카이브입니다.
        <br />
        모든 영상의 권리는 원저작자에게 있습니다.
      </p>
    </aside>
  );
}

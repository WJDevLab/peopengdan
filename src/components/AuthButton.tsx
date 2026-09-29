"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = { signedIn: boolean; isAdmin: boolean };

/** 사이드바 로그인 카드의 버튼 부분. 신원 표시는 Sidebar 가 그린다. */
export function AuthButton({ signedIn, isAdmin }: Props) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    setBusy(false);
  }

  if (!signedIn) {
    return (
      <Link className="btn" href="/login">
        로그인 · 가입
      </Link>
    );
  }

  return (
    <div className="auth-actions">
      {isAdmin && <span className="role-badge">ADMIN</span>}
      <Link className="btn-mini" href="/me">
        내 정보
      </Link>
      {isAdmin && (
        <Link className="btn-mini" href="/admin/collections">
          수집 현황
        </Link>
      )}
      <button className="btn-mini" onClick={signOut} disabled={busy}>
        로그아웃
      </button>
    </div>
  );
}

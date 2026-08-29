"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <main className="auth-wrap">
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </main>
  );
}

function LoginCard() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function google() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (error) return setError(translate(error.message));
      if (!data.session) {
        return setNotice("가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 인증을 마쳐주세요.");
      }
      router.push(next);
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(translate(error.message));
    router.push(next);
    router.refresh();
  }

  return (
    <div className="auth-card">
      <div className="auth-head">
        <span className="glyph" aria-hidden="true">
          🐧
        </span>
        <h1>퍼스트펭귄단</h1>
        <p>글쓰기 · 댓글 · 제보를 하려면 로그인이 필요합니다</p>
      </div>

      <div className="auth-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === "signin"}
          className="auth-tab"
          onClick={() => setMode("signin")}
        >
          로그인
        </button>
        <button
          role="tab"
          aria-selected={mode === "signup"}
          className="auth-tab"
          onClick={() => setMode("signup")}
        >
          회원가입
        </button>
      </div>

      <form onSubmit={submit} className="auth-form">
        <div className="field">
          <label htmlFor="email">이메일</label>
          <input
            className="input"
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input
            className="input"
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "8자 이상" : ""}
          />
        </div>

        {error && <p className="error-text">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}

        <button className="btn auth-submit" type="submit" disabled={busy}>
          {busy ? "처리 중…" : mode === "signup" ? "가입하기" : "로그인"}
        </button>
      </form>

      <div className="auth-simple">
        <span className="auth-simple-label">간편 로그인</span>
        <button
          className="oauth-circle"
          type="button"
          onClick={google}
          disabled={busy}
          aria-label="구글 계정으로 로그인"
          title="구글 계정으로 로그인"
        >
          <GoogleMark />
        </button>
      </div>

      <p className="auth-foot">
        가입하면 펭귄 닉네임이 자동으로 부여됩니다.
        <br />
        구글 계정의 실명과 프로필 사진은 저장하지 않습니다.
      </p>

      <Link className="btn-mini auth-back" href="/">
        영상 보러 가기
      </Link>
    </div>
  );
}

/** 구글 브랜드 마크. 4색 그대로 써야 구글 가이드라인에 맞는다. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/** Supabase 오류 메시지를 사람 말로 바꾼다. */
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "이메일 또는 비밀번호가 맞지 않습니다.";
  if (m.includes("already registered")) return "이미 가입된 이메일입니다. 로그인을 선택해 주세요.";
  if (m.includes("password should be")) return "비밀번호가 너무 짧습니다. 8자 이상으로 정해주세요.";
  if (m.includes("email not confirmed")) return "메일 인증이 아직 끝나지 않았습니다. 받은 메일함을 확인해 주세요.";
  if (m.includes("rate limit")) return "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
  return message;
}

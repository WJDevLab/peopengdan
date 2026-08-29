"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BOARD_CATEGORIES } from "@/lib/constants";

type Existing = {
  id: string;
  title: string;
  body: string;
  category: string;
  is_notice: boolean;
};

const DRAFT_KEY = "peopengdan:draft";

export function PostForm({
  action,
  existing,
  isAdmin,
}: {
  action: (formData: FormData) => void;
  existing: Existing | null;
  isAdmin: boolean;
}) {
  const [category, setCategory] = useState(existing?.category ?? "chat");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [draftSaved, setDraftSaved] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // 새 글일 때만 임시저장을 쓴다. 수정 중에는 원본이 기준이라 헷갈린다.
  const useDraft = !existing;

  useEffect(() => {
    if (!useDraft) return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.title || d.body) {
        setCategory(d.category ?? "chat");
        setTitle(d.title ?? "");
        setBody(d.body ?? "");
        setRestored(true);
      }
    } catch {
      // 저장소 접근이 막힌 브라우저면 임시저장만 조용히 포기한다.
    }
  }, [useDraft]);

  // 타이핑이 멎고 0.8초 뒤에 저장한다. 매 글자마다 쓰면 낭비다.
  useEffect(() => {
    if (!useDraft) return;
    if (!title && !body) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ category, title, body }));
        setDraftSaved(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
      } catch {
        /* 무시 */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [useDraft, category, title, body]);

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* 무시 */
    }
  }

  // Ctrl(⌘) + Enter 로 등록. 긴 글을 쓰다 마우스로 손을 옮기지 않아도 된다.
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (title.trim() && body.trim()) formRef.current?.requestSubmit();
    }
  }

  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="compose-wrap">
      <form
        ref={formRef}
        className="compose"
        action={action}
        onSubmit={clearDraft}
        onKeyDown={onKeyDown}
      >
        <div className="compose-head">
          <h1>{existing ? "글 수정" : "글쓰기"}</h1>
          <Link className="btn-mini" href={existing ? `/board/${existing.id}` : "/board"}>
            취소
          </Link>
        </div>

        {restored && (
          <p className="compose-restored">
            작성하던 글을 불러왔습니다.{" "}
            <button
              type="button"
              className="btn-mini"
              onClick={() => {
                clearDraft();
                setTitle("");
                setBody("");
                setRestored(false);
                setDraftSaved(null);
              }}
            >
              지우고 새로 쓰기
            </button>
          </p>
        )}

        {existing && <input type="hidden" name="id" value={existing.id} />}
        <input type="hidden" name="category" value={category} />

        <div className="field">
          <label>말머리</label>
          <div className="radio-chips">
            {BOARD_CATEGORIES.map((c) => (
              <span key={c.slug}>
                <input
                  type="radio"
                  id={`cat-${c.slug}`}
                  name="category-ui"
                  checked={category === c.slug}
                  onChange={() => setCategory(c.slug)}
                />
                <label htmlFor={`cat-${c.slug}`}>{c.label}</label>
              </span>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="label-row">
            <label htmlFor="title">제목</label>
            <span className="counter" data-over={title.length > 120}>
              {title.length} / 120
            </span>
          </div>
          <input
            className="input"
            id="title"
            name="title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="무슨 이야기인가요?"
          />
        </div>

        <div className="field">
          <div className="label-row">
            <label htmlFor="body">내용</label>
            <span className="counter">{body.length.toLocaleString("ko-KR")}자</span>
          </div>
          <textarea
            className="textarea compose-body"
            id="body"
            name="body"
            required
            maxLength={20000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="자유롭게 적어주세요."
          />
        </div>

        {isAdmin && (
          <label className="check-row" htmlFor="is_notice">
            <input
              type="checkbox"
              id="is_notice"
              name="is_notice"
              defaultChecked={existing?.is_notice ?? false}
            />
            <span>
              <strong>공지로 등록</strong>
              <em>말머리와 무관하게 목록 맨 위에 고정됩니다</em>
            </span>
          </label>
        )}

        <div className="compose-foot">
          <span className="compose-hint">
            {useDraft && draftSaved ? `${draftSaved} 임시저장됨` : "Ctrl + Enter 로도 등록됩니다"}
          </span>
          <button className="btn" type="submit" disabled={!canSubmit}>
            {existing ? "수정하기" : "등록하기"}
          </button>
        </div>
      </form>
    </div>
  );
}

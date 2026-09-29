"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * 사이드바 로그인 카드의 껍데기.
 * PC에선 카드 그대로 펼쳐 보이고, 모바일 상단 바에선 아바타 하나로 접혔다가
 * 누르면 아래로 메뉴가 열린다 — 좁은 바에 버튼 네 개를 욱여넣지 않기 위해서다.
 */
export function SideAccount({
  initial,
  children,
}: {
  /** 로그인한 경우 아바타에 띄울 글자. 비로그인이면 null — 접지 않고 버튼만 보인다. */
  initial: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // 메뉴에서 페이지를 옮기면 닫는다.
  useEffect(() => setOpen(false), [pathname]);

  // 바깥을 누르거나 Esc 를 누르면 닫는다.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="side-account" data-collapsible={initial !== null} data-open={open}>
      {initial !== null && (
        <button
          type="button"
          className="account-toggle"
          aria-expanded={open}
          aria-label="내 계정 메뉴"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="avatar" aria-hidden="true">
            {initial}
          </span>
        </button>
      )}
      <div className="side-account-panel">{children}</div>
    </div>
  );
}

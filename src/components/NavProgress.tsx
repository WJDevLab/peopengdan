"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * 링크를 누른 순간 화면 맨 위에 얇은 진행 막대를 띄운다.
 * 정렬·필터처럼 같은 페이지에서 주소(?sort=)만 바뀌는 이동은 loading.tsx 뼈대가
 * 뜨지 않아서, 서버 응답을 기다리는 동안 눌렸는지조차 알 수 없었다.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);

  // 주소가 바뀌었다 = 새 화면이 도착했다.
  useEffect(() => setActive(false), [pathname, searchParams]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setActive(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // 혹시 이동이 취소돼도 막대가 영원히 남지 않게.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 10000);
    return () => clearTimeout(t);
  }, [active]);

  return <div className="nav-progress" data-active={active} aria-hidden="true" />;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/constants";
import { Icon, type IconName } from "./Icon";

const ADMIN_NAV = [{ href: "/admin/hidden", label: "숨김 영상", icon: "eye-off" }] as const;

export function Nav({
  counts,
  isAdmin = false,
}: {
  counts?: Partial<Record<string, number>>;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <nav className="nav" aria-label="주요 메뉴">
      {items.map((item) => {
        // "/" 는 정확히 일치할 때만, 나머지는 하위 경로까지 활성으로 본다.
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const count = counts?.[item.href];

        return (
          <Link
            key={item.href}
            href={item.href}
            className="nav-item"
            data-active={active}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={item.icon as IconName} />
            {item.label}
            {typeof count === "number" && <span className="count">{count.toLocaleString("ko-KR")}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

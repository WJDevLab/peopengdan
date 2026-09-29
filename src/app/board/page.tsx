import type { Metadata } from "next";
import Link from "next/link";
import { BOARD_CATEGORIES, boardCategoryLabel } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { PostListItem } from "@/types/db";

export const metadata: Metadata = { title: "게시판 · 퍼스트펭귄단" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const SELECT =
  "id, category, title, is_notice, is_pinned, view_count, comment_count, created_at," +
  " author:profiles ( id, display_name, avatar_url, role )";

export default async function BoardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const category = one(sp.category) ?? "all";
  const requestedPage = Number(one(sp.page) ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const offset = (page - 1) * 50;
  const pageHref = (n: number) => `/board?${new URLSearchParams({ category, page: String(n) })}`;

  const db = await createClient();
  const { user } = await getViewer();

  // 공지는 말머리 필터와 무관하게 항상 맨 위에 붙는다.
  const noticesQuery = db.from("posts").select(SELECT).eq("is_notice", true).order("created_at", { ascending: false });

  let normalQuery = db.from("posts").select(SELECT, { count: "exact" }).eq("is_notice", false);
  if (category !== "all") normalQuery = normalQuery.eq("category", category);

  const [notices, normal] = await Promise.all([
    noticesQuery,
    normalQuery.order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).order("id").range(offset, offset + 49),
  ]);

  const noticeRows = (notices.data ?? []) as unknown as PostListItem[];
  const rows = (normal.data ?? []) as unknown as PostListItem[];
  const total = normal.count ?? rows.length;

  return (
    <main className="page">
      <div className="page-head">
        <h1>게시판</h1>
        <span className="sub">퍼펭단끼리 이야기하는 곳입니다</span>
        <div className="spacer" />
        {user ? (
          <Link className="btn" href="/board/write">
            글쓰기
          </Link>
        ) : (
          <span className="sub">글을 쓰려면 로그인하세요</span>
        )}
      </div>

      <div className="filters">
        <span className="filter-label">말머리</span>
        <Link className="chip" data-active={category === "all"} href="/board">
          전체
        </Link>
        {BOARD_CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            className="chip"
            data-active={category === c.slug}
            href={`/board?category=${c.slug}`}
          >
            {c.label}
          </Link>
        ))}
        <span className="filter-label filters-total">
          전체 {total.toLocaleString("ko-KR")}개
        </span>
      </div>

      {noticeRows.length === 0 && rows.length === 0 ? (
        <div className="empty">
          <span className="glyph" aria-hidden="true">
            🐧
          </span>
          <h2>아직 아무도 안 뛰어들었네요</h2>
          <p>첫 글을 남겨보세요. 퍼스트 펭귄은 원래 제일 먼저 뛰어드는 쪽입니다.</p>
        </div>
      ) : (
        <div className="list-wrap">
          <div className="list-scroll">
          <table className="list">
            <thead>
              <tr>
                <th scope="col">번호</th>
                <th scope="col">말머리</th>
                <th scope="col">제목</th>
                <th scope="col">글쓴이</th>
                <th scope="col">시각</th>
                <th scope="col">조회</th>
              </tr>
            </thead>
            <tbody>
              {noticeRows.map((p) => (
                <Row key={p.id} post={p} number="—" />
              ))}
              {rows.map((p, i) => (
                <Row key={p.id} post={p} number={p.is_pinned ? "—" : String(total - offset - i)} />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      {(page > 1 || offset + 50 < total) && <nav className="grid-sentinel" aria-label="게시판 페이지">
        {page > 1 && <Link className="btn btn--ghost" href={pageHref(page - 1)}>이전</Link>}
        <span>{page} 페이지</span>
        {offset + 50 < total && <Link className="btn btn--ghost" href={pageHref(page + 1)}>다음</Link>}
      </nav>}
    </main>
  );
}

function Row({ post, number }: { post: PostListItem; number: string }) {
  const name = post.author?.display_name ?? "탈퇴한 회원";

  return (
    <tr data-notice={post.is_notice}>
      <td className="num">{number}</td>
      <td>
        {post.is_notice ? (
          <span className="badge badge--notice">공지</span>
        ) : post.is_pinned ? (
          <span className="badge badge--pin">고정</span>
        ) : (
          <span className="badge">{boardCategoryLabel(post.category)}</span>
        )}
      </td>
      <td className="cell-title">
        <Link href={`/board/${post.id}`}>{post.title}</Link>
        {post.comment_count > 0 && <span className="replies">[{post.comment_count}]</span>}
      </td>
      <td>
        <span className="author">
          {post.author?.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="avatar-sm" src={post.author.avatar_url} alt="" />
          ) : (
            <span className="avatar-sm" aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          {name}
          {post.author?.role === "admin" && <span className="badge badge--admin">운영</span>}
        </span>
      </td>
      <td className="meta">{formatRelative(post.created_at)}</td>
      <td className="meta">{post.view_count.toLocaleString("ko-KR")}</td>
    </tr>
  );
}

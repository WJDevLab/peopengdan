import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { boardCategoryLabel } from "@/lib/constants";
import { createComment } from "@/lib/actions";
import { formatRelative } from "@/lib/format";
import { createClient, getViewer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CommentDelete, PostActions } from "@/components/board/PostActions";
import type { CommentItem, PostDetail } from "@/types/db";

export const dynamic = "force-dynamic";

/** 카톡 등으로 게시글을 공유하면 글 제목·본문 일부가 미리보기에 뜨게 한다. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const db = await createClient();
  const { data } = await db.from("posts").select("title, body").eq("id", id).single();
  if (!data) return {};

  const excerpt = data.body.replace(/\s+/g, " ").trim().slice(0, 100);
  const title = `${data.title} · 퍼스트펭귄단`;
  return {
    title,
    description: excerpt,
    openGraph: { title, description: excerpt },
    twitter: { title, description: excerpt },
  };
}

/** 닉네임 첫 글자로 만드는 아바타. 외부 이미지를 쓰지 않는다 (ADR-028). */
function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span className={size === "md" ? "avatar" : "avatar-sm"} aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { user, isAdmin } = await getViewer();

  const { data } = await db
    .from("posts")
    .select(
      "id, category, title, body, is_notice, is_pinned, view_count, comment_count," +
        " created_at, updated_at, author_id, author:profiles ( id, display_name, avatar_url, role )",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const post = data as unknown as PostDetail;

  const { data: commentRows } = await db
    .from("comments")
    .select("id, post_id, body, created_at, author_id, author:profiles ( id, display_name, avatar_url, role )")
    .eq("post_id", id)
    .order("created_at", { ascending: true });

  const comments = (commentRows ?? []) as unknown as CommentItem[];

  // 조회수는 RPC로 열지 않고 여기서 service_role 로 올린다 (ADR-019).
  try {
    const admin = createAdminClient();
    await admin.from("posts").update({ view_count: post.view_count + 1 }).eq("id", id);
  } catch {
    // 조회수는 실패해도 본문 표시를 막지 않는다.
  }

  const authorName = post.author?.display_name ?? "탈퇴한 회원";
  const canEdit = Boolean(user && user.id === post.author_id);
  const edited = post.updated_at !== post.created_at;

  return (
    <main className="page">
      <div className="page-head">
        <h1>게시판</h1>
        <div className="spacer" />
        <Link className="btn btn--ghost" href="/board">
          목록
        </Link>
      </div>

      <div className="post-wrap">
        <article className="post">
          <header className="post-head">
            <div className="post-badges">
              {post.is_notice && <span className="badge badge--notice">공지</span>}
              {post.is_pinned && <span className="badge badge--pin">고정</span>}
              <span className="badge">{boardCategoryLabel(post.category)}</span>
            </div>

            <h2 className="post-title">{post.title}</h2>

            <div className="post-meta">
              <Avatar name={authorName} />
              <strong>{authorName}</strong>
              {post.author?.role === "admin" && <span className="badge badge--admin">운영</span>}
              <span className="dot" aria-hidden="true">
                ·
              </span>
              <time dateTime={post.created_at}>{formatRelative(post.created_at)}</time>
              {edited && <span className="post-edited">(수정됨)</span>}
              <span className="post-counts">
                조회 {post.view_count.toLocaleString("ko-KR")} · 댓글{" "}
                {post.comment_count.toLocaleString("ko-KR")}
              </span>
            </div>
          </header>

          <div className="post-body">{post.body}</div>

          <footer className="post-foot">
            <Link className="btn-mini" href="/board">
              목록으로
            </Link>
            <PostActions
              postId={post.id}
              isNotice={post.is_notice}
              isPinned={post.is_pinned}
              canEdit={canEdit}
              isAdmin={isAdmin}
            />
          </footer>
        </article>

        <section className="comments">
          <h3 className="comments-head">
            댓글 <span>{comments.length.toLocaleString("ko-KR")}</span>
          </h3>

          {comments.length === 0 ? (
            <p className="comments-empty">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>
          ) : (
            <ul className="comment-list">
              {comments.map((c) => {
                const name = c.author?.display_name ?? "탈퇴한 회원";
                const mine = Boolean(user && user.id === c.author_id);
                return (
                  <li className="comment" key={c.id}>
                    <Avatar name={name} />
                    <div className="comment-main">
                      <div className="comment-head">
                        <strong>{name}</strong>
                        {c.author?.role === "admin" && (
                          <span className="badge badge--admin">운영</span>
                        )}
                        <time className="when" dateTime={c.created_at}>
                          {formatRelative(c.created_at)}
                        </time>
                        {(mine || isAdmin) && <CommentDelete id={c.id} postId={post.id} />}
                      </div>
                      <p className="comment-body">{c.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {user ? (
            <form action={createComment} className="comment-form">
              <input type="hidden" name="post_id" value={post.id} />
              <textarea
                className="textarea"
                name="body"
                required
                maxLength={2000}
                placeholder="댓글을 남겨보세요."
                aria-label="댓글 내용"
              />
              <button className="btn" type="submit">
                댓글 등록
              </button>
            </form>
          ) : (
            <p className="comments-empty">
              댓글을 쓰려면 <Link href={`/login?next=/board/${post.id}`}>로그인</Link>하세요.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

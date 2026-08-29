import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createPost, updatePost } from "@/lib/actions";
import { PostForm } from "@/components/board/PostForm";
import { createClient, getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "글쓰기 · 퍼스트펭귄단" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function WritePage({ searchParams }: { searchParams: SearchParams }) {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect("/login?next=/board/write");

  const editId = one((await searchParams).edit);
  let existing = null;

  if (editId) {
    const db = await createClient();
    const { data } = await db
      .from("posts")
      .select("id, title, body, category, is_notice, author_id")
      .eq("id", editId)
      .single();

    // 남의 글을 수정하려 들면 돌려보낸다. DB의 RLS가 최종 방어선이다.
    if (data && data.author_id !== user.id && !isAdmin) redirect(`/board/${editId}`);
    existing = data;
  }

  return (
    <main className="page">
      <PostForm
        action={existing ? updatePost : createPost}
        existing={existing}
        isAdmin={isAdmin}
      />
    </main>
  );
}

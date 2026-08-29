"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteComment, deletePost, togglePostFlag } from "@/lib/actions";

type Props = {
  postId: string;
  isNotice: boolean;
  isPinned: boolean;
  canEdit: boolean;
  isAdmin: boolean;
};

export function PostActions({ postId, isNotice, isPinned, canEdit, isAdmin }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function flag(name: "is_notice" | "is_pinned", value: boolean) {
    startTransition(async () => {
      const res = await togglePostFlag(postId, name, value);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("이 글을 삭제합니다. 댓글도 함께 사라지고 되돌릴 수 없습니다.")) return;
    startTransition(async () => {
      const res = await deletePost(postId);
      if (!res.ok) alert(res.error);
      else router.push("/board");
    });
  }

  if (!canEdit && !isAdmin) return null;

  return (
    <div className="form-actions" style={{ marginTop: ".2rem" }}>
      {canEdit && (
        <Link className="btn-mini" href={`/board/write?edit=${postId}`}>
          수정
        </Link>
      )}
      {isAdmin && (
        <>
          <button className="btn-mini" disabled={pending} onClick={() => flag("is_pinned", !isPinned)}>
            {isPinned ? "고정 해제" : "맨 위 고정"}
          </button>
          <button className="btn-mini" disabled={pending} onClick={() => flag("is_notice", !isNotice)}>
            {isNotice ? "공지 해제" : "공지로 등록"}
          </button>
        </>
      )}
      {(canEdit || isAdmin) && (
        <button className="btn-mini btn-mini--danger" disabled={pending} onClick={remove}>
          삭제
        </button>
      )}
    </div>
  );
}

export function CommentDelete({ id, postId }: { id: string; postId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      className="btn-mini btn-mini--danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("댓글을 삭제할까요?")) return;
        startTransition(async () => {
          const res = await deleteComment(id, postId);
          if (!res.ok) alert(res.error);
          else router.refresh();
        });
      }}
    >
      삭제
    </button>
  );
}

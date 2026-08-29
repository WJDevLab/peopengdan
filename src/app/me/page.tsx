import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { updateNickname } from "@/lib/actions";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "내 정보 · 퍼스트펭귄단" };
export const dynamic = "force-dynamic";

export default async function MePage() {
  const { user, profile, isAdmin } = await getViewer();
  if (!user) redirect("/login?next=/me");

  return (
    <main className="page">
      <div className="page-head">
        <h1>내 정보</h1>
        <span className="sub">게시판과 댓글에 표시되는 이름입니다</span>
      </div>

      <form className="form" action={updateNickname} style={{ maxWidth: "460px" }}>
        <div className="field">
          <label htmlFor="display_name">닉네임</label>
          <input
            className="input"
            id="display_name"
            name="display_name"
            required
            minLength={2}
            maxLength={16}
            defaultValue={profile?.display_name ?? ""}
          />
          <span className="help">2~16자. 다른 회원에게 보이는 유일한 이름입니다.</span>
        </div>

        <div className="form-actions">
          <button className="btn" type="submit">
            저장
          </button>
          {isAdmin && <span className="role-badge">ADMIN</span>}
        </div>
      </form>

      <section className="form" style={{ maxWidth: "560px", paddingTop: 0 }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 750 }}>공개되는 정보</h2>
        <div className="privacy-list">
          <div>
            <span className="badge badge--pin">공개</span>
            <p>닉네임 · 가입 시각 · 작성한 글과 댓글</p>
          </div>
          <div>
            <span className="badge badge--done">비공개</span>
            <p>
              이메일 주소. 데이터베이스 권한으로 잠겨 있어 다른 회원은 물론 사이트 코드에서도
              읽지 않습니다.
            </p>
          </div>
          <div>
            <span className="badge badge--done">저장 안 함</span>
            <p>
              구글 계정의 실명과 프로필 사진. 가입할 때 아예 가져오지 않고 펭귄 닉네임을
              대신 부여합니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import { REPORT_KINDS, REPORT_STATUS, reportStatusLabel } from "@/lib/constants";
import { createReport, replyToReport } from "@/lib/actions";
import { formatRelative } from "@/lib/format";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { ReportItem } from "@/types/db";

export const metadata: Metadata = { title: "제보하기 · 퍼스트펭귄단" };
export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const { user, isAdmin } = await getViewer();

  if (!user) {
    return (
      <main className="page">
        <div className="page-head">
          <h1>제보하기</h1>
          <span className="sub">잘못 올라간 영상이나 문제되는 글을 1대1로 알려주세요</span>
        </div>
        <div className="empty">
          <span className="glyph" aria-hidden="true">
            🐧
          </span>
          <h2>로그인이 필요해요</h2>
          <p>
            제보는 1대1로 주고받습니다. 답변을 전달하려면 누가 보냈는지 알아야 해서 로그인한
            분만 보낼 수 있습니다. 왼쪽에서 구글로 로그인해 주세요.
          </p>
        </div>
      </main>
    );
  }

  const db = await createClient();
  // RLS가 알아서 걸러준다 — 일반 회원은 본인 것만, 어드민은 전부 보인다.
  const { data } = await db
    .from("reports")
    .select(
      "id, kind, target_url, message, status, admin_reply, replied_at, created_at," +
        " reporter_id, reporter:profiles!reports_reporter_id_fkey ( id, display_name, avatar_url, role )",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const reports = (data ?? []) as unknown as ReportItem[];

  return (
    <main className="page">
      <div className="page-head">
        <h1>제보하기</h1>
        <span className="sub">
          {isAdmin ? "들어온 제보를 확인하고 답변합니다" : "보낸 제보와 답변을 여기서 확인합니다"}
        </span>
      </div>

      {!isAdmin && (
        <div className="compose-wrap">
        <form className="compose" action={createReport}>
          <div className="compose-head">
            <h1>제보 보내기</h1>
          </div>
          <div className="field">
            <label>무엇에 대한 제보인가요?</label>
            <div className="radio-chips">
              {REPORT_KINDS.map((k, i) => (
                <span key={k.slug}>
                  <input
                    type="radio"
                    id={`kind-${k.slug}`}
                    name="kind"
                    value={k.slug}
                    defaultChecked={i === 0}
                  />
                  <label htmlFor={`kind-${k.slug}`}>{k.label}</label>
                </span>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="target_url">해당 주소</label>
            <input
              className="input"
              id="target_url"
              name="target_url"
              placeholder="문제되는 영상이나 글의 주소 (선택)"
            />
            <span className="help">
              유튜브 주소든 이 사이트의 게시글 주소든 괜찮습니다. 없으면 비워두세요.
            </span>
          </div>

          <div className="field">
            <label htmlFor="message">내용</label>
            <textarea
              className="textarea"
              id="message"
              name="message"
              required
              maxLength={4000}
              placeholder="어떤 점이 문제인지 적어주세요. 관리자만 볼 수 있습니다."
            />
          </div>

          <div className="compose-foot">
            <span className="compose-hint">관리자와 본인만 볼 수 있습니다</span>
            <button className="btn" type="submit">
              제보 보내기
            </button>
          </div>
        </form>
        </div>
      )}

      <section className="list-wrap" style={{ display: "flex", flexDirection: "column", gap: ".8rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 750 }}>
          {isAdmin ? `들어온 제보 ${reports.length}건` : `내가 보낸 제보 ${reports.length}건`}
        </h2>

        {reports.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: ".88rem", margin: 0 }}>
            {isAdmin ? "아직 들어온 제보가 없습니다." : "아직 보낸 제보가 없습니다."}
          </p>
        ) : (
          reports.map((r) => <ReportCard key={r.id} report={r} isAdmin={isAdmin} />)
        )}
      </section>
    </main>
  );
}

function ReportCard({ report, isAdmin }: { report: ReportItem; isAdmin: boolean }) {
  const kindLabel = REPORT_KINDS.find((k) => k.slug === report.kind)?.label ?? "기타";
  const done = report.status === "done";

  return (
    <article className="comment" style={{ gap: ".55rem" }}>
      <div className="comment-head" style={{ flexWrap: "wrap" }}>
        <span className={done ? "badge badge--done" : "badge badge--status"}>
          {reportStatusLabel(report.status)}
        </span>
        <span className="badge">{kindLabel}</span>
        {isAdmin && (
          <strong style={{ fontWeight: 600 }}>{report.reporter?.display_name ?? "알 수 없음"}</strong>
        )}
        <span className="when">{formatRelative(report.created_at)}</span>
      </div>

      {report.target_url && (
        <p style={{ margin: 0, fontSize: ".78rem", wordBreak: "break-all" }}>
          <span style={{ color: "var(--muted)" }}>대상: </span>
          <a className="link-out" href={report.target_url} target="_blank" rel="noopener noreferrer">
            {report.target_url}
          </a>
        </p>
      )}

      <div className="comment-body">{report.message}</div>

      {report.admin_reply && (
        <div
          style={{
            borderLeft: "2px solid var(--accent)",
            paddingLeft: ".75rem",
            display: "flex",
            flexDirection: "column",
            gap: ".2rem",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: ".64rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            운영자 답변
          </span>
          <div className="comment-body">{report.admin_reply}</div>
        </div>
      )}

      {isAdmin && (
        <form action={replyToReport} style={{ display: "flex", flexDirection: "column", gap: ".45rem" }}>
          <input type="hidden" name="id" value={report.id} />
          <textarea
            className="textarea"
            name="admin_reply"
            style={{ minHeight: "70px" }}
            defaultValue={report.admin_reply ?? ""}
            placeholder="답변을 적으면 제보자에게 보입니다."
            aria-label="운영자 답변"
          />
          <div className="form-actions">
            <select className="select" name="status" defaultValue={report.status} style={{ maxWidth: "160px" }}>
              {REPORT_STATUS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
            <button className="btn" type="submit">
              저장
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

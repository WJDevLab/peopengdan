import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { fetchCollectionRuns } from "@/lib/queries";
import { getViewer } from "@/lib/supabase/server";
import type { CollectionRunRow } from "@/types/db";

export const metadata: Metadata = { title: "수집 현황 · 퍼스트펭귄단" };
export const dynamic = "force-dynamic";

/** 하루 무료 할당량. Notion 기획 문서 7.7 참조. */
const DAILY_BUDGET = 10_000;

const STATUS_LABEL: Record<CollectionRunRow["status"], string> = {
  running: "진행 중",
  success: "성공",
  failed: "중단",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(startIso: string, endIso: string | null) {
  if (!endIso) return "-";
  const sec = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

export default async function CollectionsPage() {
  const { isAdmin } = await getViewer();
  if (!isAdmin) redirect("/");

  const runs = await fetchCollectionRuns(30);

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const last24h = runs.filter((r) => new Date(r.started_at).getTime() >= since);
  const quotaToday = last24h.reduce((sum, r) => sum + r.quota_used, 0);
  const quotaPct = Math.min(100, Math.round((quotaToday / DAILY_BUDGET) * 100));

  const latest = runs[0];
  const latestFailed = latest?.status === "failed";

  return (
    <main className="page">
      <div className="page-head">
        <h1>수집 현황</h1>
        <span className="sub">4시간 주기 자동 수집 기록과 할당량 사용량입니다</span>
      </div>

      <dl className="stats">
        <div className="stat">
          <dt>최근 24시간 할당량</dt>
          <dd>
            {quotaToday.toLocaleString("ko-KR")}
            <small>/ {DAILY_BUDGET.toLocaleString("ko-KR")}</small>
          </dd>
        </div>
        <div className="stat">
          <dt>최근 24시간 회차</dt>
          <dd>
            {last24h.length}
            <small>회</small>
          </dd>
        </div>
        <div className="stat">
          <dt>최근 신규 영상</dt>
          <dd>
            {(latest?.videos_new ?? 0).toLocaleString("ko-KR")}
            <small>편</small>
          </dd>
        </div>
        <div className="stat">
          <dt>마지막 회차</dt>
          <dd style={{ fontSize: "1rem" }}>
            {latest ? (
              <span className={latestFailed ? "badge badge--status" : "badge"}>
                {STATUS_LABEL[latest.status]}
              </span>
            ) : (
              "-"
            )}
          </dd>
        </div>
      </dl>

      <div style={{ padding: "0 clamp(1.1rem, 3vw, 1.8rem)" }}>
        <div className="quota-bar" aria-hidden="true">
          <div className="quota-bar-fill" style={{ width: `${quotaPct}%` }} />
        </div>
        <p className="filter-result" style={{ textAlign: "left", padding: ".4rem 0" }}>
          일일 무료 할당량의 {quotaPct}% 사용 — 회차당 예산 상한 1,600 유닛, 4시간 주기 기준 하루 최대 약 9,600 유닛
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="empty">
          <span className="glyph" aria-hidden="true">
            🐧
          </span>
          <h2>아직 수집 기록이 없습니다</h2>
          <p>
            <code>npm run collect</code> 를 실행하거나 GitHub Actions 자동 수집이 돌면 여기에 쌓입니다.
          </p>
        </div>
      ) : (
        <div className="list-wrap">
          <div className="list-scroll">
            <table className="list">
              <thead>
                <tr>
                  <th scope="col">시작 시각</th>
                  <th scope="col">상태</th>
                  <th scope="col">소요 시간</th>
                  <th scope="col">조회</th>
                  <th scope="col">신규</th>
                  <th scope="col">할당량</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} data-notice={r.status === "failed"}>
                    <td className="meta">{fmtDateTime(r.started_at)}</td>
                    <td>
                      <span className={r.status === "failed" ? "badge badge--status" : "badge"}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.error_message && (
                        <div style={{ fontSize: ".72rem", color: "var(--muted)", marginTop: ".2rem" }}>
                          {r.error_message}
                        </div>
                      )}
                    </td>
                    <td className="meta">{fmtDuration(r.started_at, r.finished_at)}</td>
                    <td className="meta">{r.videos_seen.toLocaleString("ko-KR")}</td>
                    <td className="meta">{r.videos_new.toLocaleString("ko-KR")}</td>
                    <td className="meta">{r.quota_used.toLocaleString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

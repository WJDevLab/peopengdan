/**
 * 페이지를 옮기는 동안 곧바로 보이는 뼈대 화면.
 * 서버 응답을 기다리는 사이 화면이 멈춘 것처럼 보이지 않게 한다.
 * 사이드바(레이아웃)는 그대로 두고 본문만 바뀐다.
 */
export default function Loading() {
  return (
    <main className="page" aria-busy="true" aria-label="불러오는 중">
      <div className="page-head">
        <span className="skel skel--title" />
      </div>
      <div className="skel-bar">
        <span className="skel skel--pill" />
        <span className="skel skel--pill" />
        <span className="skel skel--pill" />
      </div>
      <div className="skel-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skel-card">
            <span className="skel skel--thumb" />
            <span className="skel skel--line" />
            <span className="skel skel--line skel--short" />
          </div>
        ))}
      </div>
    </main>
  );
}

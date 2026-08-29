import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "퍼스트펭귄단 — 이용주 · 이선민 · 유영우 팬 아카이브";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OG_TEXT = "퍼스트펭귄단이용주이선민유영우팬아카이브🐧";

/**
 * Satori(next/og 내부 렌더러)는 기본 폰트가 한글 글리프를 못 그린다.
 * 구글 폰트 CSS에서 실제 폰트 파일 URL을 뽑아 직접 fetch해 넘겨준다.
 * text= 파라미터로 필요한 글자만 요청해서 가볍게 유지한다.
 */
async function loadKoreanFont() {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Jua&text=${encodeURIComponent(OG_TEXT)}`,
  ).then((r) => r.text());
  const fontUrl = css.match(/url\((https:\/\/[^)]+)\)/)?.[1];
  if (!fontUrl) throw new Error("Jua 폰트 URL을 찾지 못했습니다.");
  return fetch(fontUrl).then((r) => r.arrayBuffer());
}

/**
 * 카카오톡 등에서 링크를 공유할 때 뜨는 기본 미리보기 이미지.
 * 영상은 별도 라우트가 없어(모달 재생) 페이지별 커스텀은 두지 않고,
 * 사이트 전체에 이 기본 이미지 하나를 쓴다.
 */
export default async function OpengraphImage() {
  const juaFont = await loadKoreanFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #0B1E2A 0%, #062B37 45%, #02323F 100%)",
          fontFamily: "Jua",
        }}
      >
        <div style={{ fontSize: 160, lineHeight: 1, display: "flex" }}>🐧</div>
        <div
          style={{
            marginTop: 28,
            fontSize: 84,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "-0.01em",
            display: "flex",
          }}
        >
          퍼스트펭귄단
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 34,
            color: "#FF8348",
            fontWeight: 600,
            display: "flex",
          }}
        >
          이용주 · 이선민 · 유영우 팬 아카이브
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Jua", data: juaFont, style: "normal", weight: 400 }] },
  );
}

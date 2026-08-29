import type { Metadata, Viewport } from "next";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const SITE_URL = "https://peopengdan.vercel.app";
const TITLE = "퍼스트펭귄단";
const DESCRIPTION = "이용주 · 이선민 · 유영우 관련 유튜브 콘텐츠를 한 곳에 모아 보는 팬 아카이브.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // 기존 페이지들이 이미 title에 " · 퍼스트펭귄단"을 직접 붙이고 있어 template은 쓰지 않는다.
  title: TITLE,
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: TITLE, statusBarStyle: "default" },
  // 카카오톡 등 메신저 링크 미리보기용. 이미지는 opengraph-image.tsx가 만든다.
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E6F1F7" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1E2A" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 읽는 글 전부. 자체 호스팅(동적 서브셋)이라 외부 요청이 없다. */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendard.css" />
        {/* 로고와 빈 화면 메시지용 Jua, 숫자·라벨용 IBM Plex Mono. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Jua&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <div className="app">
          <Sidebar />
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}

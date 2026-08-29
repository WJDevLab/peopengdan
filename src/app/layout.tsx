import type { Metadata, Viewport } from "next";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "퍼스트펭귄단",
  description:
    "이용주 · 이선민 · 유영우 관련 유튜브 콘텐츠를 한 곳에 모아 보는 팬 아카이브.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "퍼스트펭귄단", statusBarStyle: "default" },
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

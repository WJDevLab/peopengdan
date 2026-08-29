import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 썸네일은 next/image 로 최적화하지 않고 YouTube CDN URL을 그대로 <img> 에 넣는다.
  // next/image 를 쓰면 우리 서버가 이미지를 받아 변환·재서빙하게 되는데,
  // 그건 "썸네일 자체 서버 재호스팅 금지" 원칙에 걸린다 (ADR-002).

  // 개발 중에만 뜨는 Next.js 표시등('N' 동그라미)이 좌측 하단 사이드바
  // 안내문을 덮어서 오른쪽으로 옮긴다. 배포본에는 애초에 나오지 않는다.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;

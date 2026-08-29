/**
 * Pretendard를 node_modules 에서 public/fonts 로 복사한다.
 *
 * Pretendard는 Google Fonts에 없어서 직접 호스팅해야 한다. 동적 서브셋 방식을 쓰는데,
 * 한글 글리프를 92개 조각으로 나눠두고 브라우저가 실제로 화면에 뜬 글자에 해당하는
 * 조각만 받아간다. 전체는 3MB지만 실제 전송량은 보통 200KB 안팎이다.
 *
 * 폰트 파일을 저장소에 커밋하는 대신 predev / prebuild 에서 매번 복사한다.
 *
 *   node scripts/sync-fonts.mjs
 */

import { cp, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pretendard", "dist", "web", "variable");
const dest = join(root, "public", "fonts", "pretendard");

try {
  await access(src);
} catch {
  console.error("pretendard 패키지를 찾지 못했습니다. `npm install` 을 먼저 실행하세요.");
  process.exit(1);
}

await mkdir(dest, { recursive: true });

await cp(
  join(src, "pretendardvariable-dynamic-subset.css"),
  join(dest, "pretendard.css"),
);

// CSS 안의 url(./woff2-dynamic-subset/...) 이 그대로 맞아떨어지도록 폴더명을 유지한다.
await cp(join(src, "woff2-dynamic-subset"), join(dest, "woff2-dynamic-subset"), {
  recursive: true,
});

console.log("Pretendard → public/fonts/pretendard 복사 완료");

/**
 * 사이드바·버튼용 아이콘.
 * 이모지 대신 SVG를 쓴다 — 이모지는 OS마다 모양과 색이 달라서
 * 사이드바처럼 나란히 놓이는 자리에서 줄이 맞지 않는다.
 */

type Props = { name: IconName; size?: number };

export type IconName =
  | "video"
  | "board"
  | "calendar"
  | "report"
  | "pin"
  | "trash"
  | "notice"
  | "penguin"
  | "eye-off";

const PATHS: Record<IconName, React.ReactNode> = {
  video: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="3.5" />
      <path d="M10.5 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none" />
    </>
  ),
  board: (
    <>
      <path d="M3.5 5.5h17v11h-9l-4.5 3.5v-3.5h-3.5z" />
      <path d="M7.5 9.5h9M7.5 12.5h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <circle cx="8.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  report: (
    <>
      <path d="M3.5 6.5h17v11h-17z" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
  pin: (
    <>
      <path d="M9 3.5h6l-.8 5.2 3.3 3.1H6.5l3.3-3.1z" />
      <path d="M12 11.8V20.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13" />
    </>
  ),
  notice: (
    <>
      <path d="M4 9.5v5h3.5l6 4V5.5l-6 4z" />
      <path d="M17 9a4.5 4.5 0 0 1 0 6" />
    </>
  ),
  penguin: (
    <>
      <ellipse cx="12" cy="14" rx="5.5" ry="7" />
      <circle cx="12" cy="6.5" r="3.8" />
      <path d="M12 7.2l2.6 1.1L12 9.4z" fill="currentColor" stroke="none" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M3.5 3.5l17 17" />
      <path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c5 0 8.7 3 10.5 7-.6 1.3-1.4 2.5-2.4 3.5M6.9 6.9C4.9 8.2 3.3 10 2 12c1.8 4 5.5 7 10 7 1.4 0 2.7-.3 3.9-.8" />
      <path d="M9.9 10a3 3 0 0 0 4.2 4.2" />
    </>
  ),
};

export function Icon({ name, size = 18 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

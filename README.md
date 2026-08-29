# 퍼스트펭귄단

이용주 · 이선민 · 유영우 관련 유튜브 콘텐츠를 자동 수집해 한 곳에 모아 보는 팬 아카이브 웹앱.

> **기획 문서는 Notion "퍼스트펭귄단" 페이지에 있습니다.**
> 기능 정의 · 데이터 구조 · 수집 기준 · 로드맵 · 의사결정 기록은 전부 그쪽에 있으며,
> 이 저장소에는 중복해서 두지 않습니다. 이 README는 세팅 방법만 다룹니다.

## 기술 구성

| 영역 | 선택 |
| --- | --- |
| 프론트 | Next.js 16 (App Router) · TypeScript · Tailwind 4 |
| DB · 인증 | Supabase (Postgres + Google OAuth) |
| 수집 | YouTube Data API v3 · GitHub Actions 4시간 주기 |
| 배포 | Vercel |

전부 무료 범위에서 운영됩니다.

## 세팅

### 1. YouTube API 키 발급

1. [Google Cloud Console](https://console.cloud.google.com) → 프로젝트 만들기
2. **API 및 서비스 → 라이브러리** → `YouTube Data API v3` 검색 → **사용 설정**
3. **API 및 서비스 → 사용자 인증 정보** → **사용자 인증 정보 만들기 → API 키**
4. 키를 복사 (API 제한에서 YouTube Data API v3만 허용해두는 것을 권장)

결제 수단 등록은 필요 없습니다. 일 10,000 유닛 무료이며 초과해도 과금이 아니라 차단입니다.

### 2. Supabase 프로젝트

> ✅ **이 단계는 이미 완료되어 있습니다.** 프로젝트 `dnsgfbrshflbwwbnnoda` (ap-northeast-2)에
> 마이그레이션 3개가 적용됐고 `.env.local` 에 URL과 anon 키가 들어 있습니다.
> 아래는 처음부터 다시 세팅할 때의 절차입니다.

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. **SQL Editor** 에서 마이그레이션을 **순서대로** 실행
   - `supabase/migrations/0001_init.sql` — 영상 테이블 · 인덱스 · RLS
   - `supabase/migrations/0002_auth_and_admin.sql` — 로그인 · 권한 · 차단 트리거
   - `supabase/migrations/0003_lock_down_functions.sql` — 함수 노출 차단
   - `supabase/migrations/0004_board_schedule_reports.sql` — 게시판 · 일정 · 제보 · 고정
3. **Settings → API** 에서 Project URL · `anon` key · `service_role` key 복사

`service_role` 키는 대시보드에서 직접 복사해야 합니다. MCP 연결로는 가져올 수 없습니다
(비밀 키를 내주지 않는 것이 올바른 설계입니다).

### 3. 구글 로그인 연결

1. Google Cloud Console → **사용자 인증 정보 → OAuth 클라이언트 ID 만들기** (웹 애플리케이션)
2. **승인된 리디렉션 URI** 에 Supabase가 알려주는 콜백 주소를 넣습니다
   (`https://<프로젝트>.supabase.co/auth/v1/callback`)
3. 발급된 클라이언트 ID / 시크릿을 Supabase → **Authentication → Providers → Google** 에 입력하고 활성화
4. Supabase → **Authentication → URL Configuration** 의 Site URL에 `http://localhost:3000`
   (배포 후에는 Vercel 주소도 Redirect URLs에 추가)

### 4. 환경변수

```bash
cp .env.local.example .env.local
```

`.env.local` 에 위에서 받은 값을 채웁니다.

### 5. 채널 ID 확정

```bash
npm run resolve:channels
```

핸들(`@YonjourLeeyongju`)과 레거시 사용자명(`angaru86`)이 같은 채널인지 판별하고
실제 `channelId`(UC…)를 `channels` 테이블에 시드합니다.

### 6. 수집

```bash
npm run collect
```

할당량을 아끼려면 채널 스캔만 돌립니다.

```bash
npm run collect -- --no-search
```

### 7. 개발 서버

```bash
npm run dev
```

### 8. 어드민

`wjdevlab@gmail.com` 은 **`bootstrap_admins` 테이블에 등록되어 있어 첫 로그인 순간 자동으로
어드민이 됩니다.** 따로 SQL을 돌릴 필요가 없습니다.

어드민을 더 추가하려면 Supabase SQL Editor에서:

```sql
insert into bootstrap_admins (email) values ('someone@gmail.com');
```

이미 가입한 사람을 승격하려면:

```sql
update profiles set role = 'admin' where id = '<user uuid>';
```

## 권한 정리

| 기능 | 비로그인 | 회원 | 어드민 |
| --- | --- | --- | --- |
| 영상 · 게시판 · 일정 열람 | ✅ | ✅ | ✅ |
| 글 · 댓글 쓰기 | ❌ | ✅ | ✅ |
| 본인 글 수정 · 삭제 | ❌ | ✅ | ✅ |
| 제보 보내기 | ❌ | ✅ | — |
| 남의 글 수정 · 삭제 | ❌ | ❌ | ✅ |
| 공지 등록 · 글 고정 | ❌ | ❌ | ✅ |
| 영상 삭제 · 고정 | ❌ | ❌ | ✅ |
| 일정 등록 · 수정 · 삭제 | ❌ | ❌ | ✅ |
| 제보 확인 · 답변 | ❌ | 본인 것만 | ✅ |

권한은 앱 코드와 Postgres RLS **양쪽에서** 검사합니다. 서버 액션에 버그가 있어도 DB가 막습니다.

## 자동 수집

`.github/workflows/collect.yml` 이 4시간마다 수집을 돌립니다.
GitHub 저장소의 **Settings → Secrets and variables → Actions** 에 등록하세요.

- `YOUTUBE_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 알아둘 것

**영상 삭제는 되돌릴 수 없습니다.** 어드민이 삭제하면 DB 트리거가 `blocked_videos` 에
해당 videoId를 등록하고, 수집기가 그 목록을 영구히 건너뜁니다. 이 장치가 없으면 지운 영상이
4시간 뒤 다시 올라옵니다. 되살리려면 `blocked_videos` 에서 해당 행을 지운 뒤 재수집해야 합니다.

## 저작권 원칙

메타데이터만 수집하고 재생은 YouTube 임베드 플레이어로만 합니다.
썸네일도 저장하지 않고 YouTube CDN URL을 직접 참조합니다(그래서 `next/image` 를 쓰지 않습니다).
영상·음원 다운로드, 재호스팅, 광고 삽입은 하지 않습니다.

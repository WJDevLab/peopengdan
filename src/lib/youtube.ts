/**
 * YouTube Data API v3 얇은 래퍼.
 *
 * 할당량은 하루 10,000 유닛(무료, 초과 시 과금 없이 차단)이며
 * search.list 가 호출당 100 유닛으로 압도적으로 비싸다. 모든 호출은
 * QuotaTracker 를 거치게 해서 실제 사용량을 collection_runs 에 남긴다.
 */

const API = "https://www.googleapis.com/youtube/v3";

export const QUOTA_COST = {
  channels: 1,
  playlistItems: 1,
  videos: 1,
  search: 100,
} as const;

export class QuotaTracker {
  used = 0;
  constructor(private readonly limit = 10000) {}

  spend(cost: number) {
    if (this.used + cost > this.limit) {
      throw new Error(
        "할당량 한도 초과 방지: " +
          this.used +
          " + " +
          cost +
          " > " +
          this.limit +
          ". 이번 회차를 중단합니다.",
      );
    }
    this.used += cost;
  }
}

export type YtChannel = {
  id: string;
  title: string;
  handle?: string;
  thumbnailUrl?: string;
  uploadsPlaylistId: string;
};

export type YtVideo = {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
};

export class YouTubeClient {
  constructor(
    private readonly apiKey: string,
    public readonly quota = new QuotaTracker(),
  ) {
    if (!apiKey) {
      throw new Error("YOUTUBE_API_KEY 가 비어 있습니다. .env.local 을 확인하세요.");
    }
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
    cost: number,
  ): Promise<T> {
    this.quota.spend(cost);

    const url = new URL(API + "/" + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        "YouTube API " + path + " 실패 (" + res.status + "): " + body.slice(0, 400),
      );
    }
    return res.json() as Promise<T>;
  }

  /**
   * 핸들(@YonjourLeeyongju), 레거시 사용자명(angaru86), 채널 ID(UC...) 중
   * 무엇을 주든 채널을 찾아낸다. 최종적으로는 항상 channelId 로 환원한다 (ADR-004).
   */
  async resolveChannel(input: string): Promise<YtChannel | null> {
    const raw = input.trim();
    let key: Record<string, string>;

    if (raw.startsWith("UC")) key = { id: raw };
    else if (raw.startsWith("@")) key = { forHandle: raw };
    else key = { forUsername: raw };

    const data = await this.get<any>(
      "channels",
      { part: "snippet,contentDetails", ...key },
      QUOTA_COST.channels,
    );

    const item = data.items?.[0];
    if (!item) return null;

    return {
      id: item.id,
      title: item.snippet.title,
      handle: item.snippet.customUrl,
      thumbnailUrl: item.snippet.thumbnails?.high?.url,
      uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
    };
  }

  /** 업로드 재생목록을 통째로 순회한다. 50건당 1유닛이라 사실상 공짜. */
  async listAllUploadIds(uploadsPlaylistId: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;

    do {
      const params: Record<string, string> = {
        part: "contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: "50",
      };
      if (pageToken) params.pageToken = pageToken;

      const data = await this.get<any>("playlistItems", params, QUOTA_COST.playlistItems);
      for (const item of data.items ?? []) ids.push(item.contentDetails.videoId);
      pageToken = data.nextPageToken;
    } while (pageToken);

    return ids;
  }

  /** 영상 상세를 50건씩 묶어 조회한다. */
  async listVideos(videoIds: string[]): Promise<YtVideo[]> {
    const out: YtVideo[] = [];

    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50);
      const data = await this.get<any>(
        "videos",
        { part: "snippet,contentDetails,statistics", id: chunk.join(",") },
        QUOTA_COST.videos,
      );

      for (const item of data.items ?? []) {
        const t = item.snippet.thumbnails ?? {};
        const thumb = t.maxres ?? t.standard ?? t.high ?? t.medium ?? t.default;

        out.push({
          id: item.id,
          channelId: item.snippet.channelId,
          channelTitle: item.snippet.channelTitle,
          title: item.snippet.title,
          description: item.snippet.description ?? "",
          publishedAt: item.snippet.publishedAt,
          durationSeconds: parseIsoDuration(item.contentDetails?.duration),
          thumbnailUrl: thumb?.url ?? null,
          viewCount: toNum(item.statistics?.viewCount),
          likeCount: toNum(item.statistics?.likeCount),
          commentCount: toNum(item.statistics?.commentCount),
        });
      }
    }
    return out;
  }

  /**
   * 키워드로 유튜브 전체를 검색한다. 호출당 100유닛이므로 페이지 수를 반드시 제한할 것.
   * 반환값은 videoId 목록이며, 상세는 listVideos 로 따로 채운다(1유닛).
   *
   * publishedAfter 를 주면 그 시각 이후 게시물만 본다. 검색은 결과 개수와 무관하게
   * 호출당 100유닛이 고정 비용이라, 매 회차 이미 훑은 과거 구간을 또 검색하는 걸
   * 막아야 회차당 예산 안에서 키워드 전체를 다 돌 수 있다.
   */
  async searchVideoIds(keyword: string, maxPages = 2, publishedAfter?: string, order: "date" | "relevance" = "date"): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < maxPages; page++) {
      const params: Record<string, string> = {
        part: "id",
        q: keyword,
        type: "video",
        order,
        maxResults: "50",
      };
      if (publishedAfter) params.publishedAfter = publishedAfter;
      if (pageToken) params.pageToken = pageToken;

      const data = await this.get<any>("search", params, QUOTA_COST.search);
      for (const item of data.items ?? []) {
        if (item.id?.videoId) ids.push(item.id.videoId);
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return ids;
  }
}

/** ISO 8601 기간(PT1H2M3S)을 초로 변환한다. */
export function parseIsoDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;

  const days = Number(m[1] ?? 0);
  const hours = Number(m[2] ?? 0);
  const minutes = Number(m[3] ?? 0);
  const seconds = Number(m[4] ?? 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function toNum(v: string | undefined): number | null {
  return v === undefined ? null : Number(v);
}

/**
 * 실제 세로(쇼츠) 여부를 길이가 아닌 유튜브 CDN 응답으로 판정한다.
 *
 * `oar2.jpg` 는 유튜브가 쇼츠로 인코딩한 영상에만 존재하는 세로 썸네일이다.
 * 쇼츠는 200(실제 이미지), 일반 영상은 404를 반환한다. 이 요청은 Data API가
 * 아닌 CDN 정적 리소스라 할당량을 전혀 쓰지 않는다.
 *
 * 길이 60초 컷을 쓰지 않는 이유: 유튜브가 쇼츠 최대 길이를 60초에서 3분으로
 * 늘리면서, 60~180초짜리 실제 쇼츠가 "가로 영상"으로 잘못 분류되는 사고가 났다.
 */
export async function probeIsShort(videoId: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://i.ytimg.com/vi/${videoId}/oar2.jpg`, { method: "HEAD" });
    return res.ok;
  } catch {
    return null; // 네트워크 실패 — 판정 불가. 호출부에서 길이 기반으로 대체한다.
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getViewer } from "@/lib/supabase/server";
import { fetchHiddenVideos, fetchVideos, type VideoFilters } from "@/lib/queries";
import type { PersonSlug } from "@/lib/constants";
import type { VideoCard } from "@/types/db";

/**
 * 서버 액션 모음.
 *
 * 여기서 권한을 확인하지만, 최종 방어선은 항상 DB의 RLS다.
 * 이 파일에 버그가 있어도 Postgres가 한 번 더 막는다.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const { user } = await getViewer();
  if (!user) throw new Error("로그인이 필요합니다.");
  return user;
}

async function requireAdmin() {
  const { user, isAdmin } = await getViewer();
  if (!user) throw new Error("로그인이 필요합니다.");
  if (!isAdmin) throw new Error("어드민만 할 수 있습니다.");
  return user;
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const orNull = (v: string) => (v === "" ? null : v);

// ═══════════════════════════════════════════════════════════
// 내 정보
// ═══════════════════════════════════════════════════════════

/**
 * 닉네임 변경. 구글 이름은 애초에 저장하지 않으므로 여기가 유일한 표시 이름이다.
 * 길이 제한은 DB의 check 제약이 최종 판정한다.
 */
export async function updateNickname(formData: FormData) {
  const user = await requireUser();
  const db = await createClient();

  const nickname = text(formData.get("display_name"));
  if (nickname.length < 2 || nickname.length > 16) {
    throw new Error("닉네임은 2자 이상 16자 이하로 정해주세요.");
  }

  const { error } = await db
    .from("profiles")
    .update({ display_name: nickname })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/me");
  revalidatePath("/board");
}

// ═══════════════════════════════════════════════════════════
// 영상
// ═══════════════════════════════════════════════════════════

export async function toggleVideoPin(id: string, pinned: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await createClient();
    const { error } = await db.from("videos").update({ is_pinned: pinned }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 삭제하면 DB 트리거가 blocked_videos 에 등록해 재수집을 막는다 (ADR-012). */
export async function deleteVideo(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await createClient();
    const { data, error } = await db.from("videos").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("해당 영상을 찾지 못했습니다.");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * 숨겨진 영상을 어드민이 수동으로 공개 전환한다.
 *
 * manual_override를 같이 세워 rescore.ts가 이 행을 건드리지 않게 막는다 —
 * 안 그러면 채점 기준을 손볼 때마다 어드민의 판단이 조용히 되돌아간다.
 */
export async function publishHiddenVideo(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await createClient();
    const { error } = await db
      .from("videos")
      .update({ status: "published", manual_override: true })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/");
    revalidatePath("/admin/hidden");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 숨김 영상 목록 무한 스크롤. */
export async function loadMoreHiddenVideos(filters: VideoFilters, offset: number) {
  await requireAdmin();
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("잘못된 페이지입니다.");
  return fetchHiddenVideos(filters, offset);
}

/**
 * 무한 스크롤로 다음 묶음을 가져온다.
 *
 * 확실한 것(published)을 다 소진해야만 애매한 것(maybe)을 채우기 시작한다
 * (ADR-023 순서를 여러 페이지에 걸쳐도 유지해야 한다). 클라이언트는 이번에
 * 받은 sure/unsure 건수만큼 자기 offset을 늘리면 된다.
 */
export async function loadMoreVideos(
  filters: VideoFilters,
  sureOffset: number,
  unsureOffset: number,
): Promise<{ sure: VideoCard[]; unsure: VideoCard[] }> {
  if (![sureOffset, unsureOffset].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error("잘못된 페이지입니다.");
  const sure = await fetchVideos(filters, "published", false, sureOffset);
  let unsure: VideoCard[] = [];
  if (sure.length === 0) {
    unsure = await fetchVideos(filters, "maybe", false, unsureOffset);
  }
  return { sure, unsure };
}

// ═══════════════════════════════════════════════════════════
// 게시판
// ═══════════════════════════════════════════════════════════

export async function createPost(formData: FormData) {
  const user = await requireUser();
  const db = await createClient();

  const title = text(formData.get("title"));
  const body = text(formData.get("body"));
  const category = text(formData.get("category")) || "chat";
  if (!title || !body) throw new Error("제목과 내용을 모두 입력해 주세요.");

  // is_notice / is_pinned 는 보내더라도 DB 트리거가 비어드민 요청을 되돌린다.
  const { data, error } = await db
    .from("posts")
    .insert({
      author_id: user.id,
      title,
      body,
      category,
      is_notice: formData.get("is_notice") === "on",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/board");
  redirect(`/board/${data.id}`);
}

export async function updatePost(formData: FormData) {
  await requireUser();
  const db = await createClient();

  const id = text(formData.get("id"));
  const title = text(formData.get("title"));
  const body = text(formData.get("body"));
  const category = text(formData.get("category")) || "chat";
  if (!id || !title || !body) throw new Error("제목과 내용을 모두 입력해 주세요.");

  const { error } = await db
    .from("posts")
    .update({
      title,
      body,
      category,
      is_notice: formData.get("is_notice") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/board/${id}`);
  redirect(`/board/${id}`);
}

export async function deletePost(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    const db = await createClient();
    const { data, error } = await db.from("posts").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("삭제 권한이 없거나 이미 지워진 글입니다.");
    revalidatePath("/board");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function togglePostFlag(
  id: string,
  flag: "is_notice" | "is_pinned",
  value: boolean,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await createClient();
    const { error } = await db.from("posts").update({ [flag]: value }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/board");
    revalidatePath(`/board/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createComment(formData: FormData) {
  const user = await requireUser();
  const db = await createClient();

  const postId = text(formData.get("post_id"));
  const body = text(formData.get("body"));
  if (!postId || !body) throw new Error("댓글 내용을 입력해 주세요.");

  const { error } = await db.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    body,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/board/${postId}`);
}

export async function deleteComment(id: string, postId: string): Promise<ActionResult> {
  try {
    await requireUser();
    const db = await createClient();
    const { data, error } = await db.from("comments").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("삭제 권한이 없습니다.");
    revalidatePath(`/board/${postId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ═══════════════════════════════════════════════════════════
// 일정 (어드민 전용)
// ═══════════════════════════════════════════════════════════

function readEventForm(formData: FormData) {
  const title = text(formData.get("title"));
  const startsOn = text(formData.get("starts_on"));
  if (!title || !startsOn) throw new Error("제목과 시작 날짜는 필수입니다.");

  const endsOn = orNull(text(formData.get("ends_on")));
  if (endsOn && endsOn < startsOn) throw new Error("종료 날짜가 시작 날짜보다 빠릅니다.");

  return {
    title,
    description: orNull(text(formData.get("description"))),
    kind: text(formData.get("kind")) || "etc",
    starts_on: startsOn,
    ends_on: endsOn,
    start_time: orNull(text(formData.get("start_time"))),
    location: orNull(text(formData.get("location"))),
    link: orNull(text(formData.get("link"))),
    people: formData.getAll("people").map(String) as PersonSlug[],
  };
}

export async function createEvent(formData: FormData) {
  const user = await requireAdmin();
  const db = await createClient();
  const { people, ...fields } = readEventForm(formData);

  const { data, error } = await db
    .from("events")
    .insert({ ...fields, created_by: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (people.length) {
    const { error: peopleError } = await db
      .from("event_people")
      .insert(people.map((person) => ({ event_id: data.id, person })));
    if (peopleError) throw new Error(peopleError.message);
  }

  revalidatePath("/schedule");
  redirect(`/schedule?month=${fields.starts_on.slice(0, 7)}`);
}

export async function updateEvent(formData: FormData) {
  await requireAdmin();
  const db = await createClient();

  const id = text(formData.get("id"));
  if (!id) throw new Error("일정을 찾지 못했습니다.");
  const { people, ...fields } = readEventForm(formData);

  const { error } = await db
    .from("events")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // 인물은 통째로 갈아끼운다. 부분 비교보다 단순하고 결과가 같다.
  await db.from("event_people").delete().eq("event_id", id);
  if (people.length) {
    await db.from("event_people").insert(people.map((person) => ({ event_id: id, person })));
  }

  revalidatePath("/schedule");
  redirect(`/schedule?month=${fields.starts_on.slice(0, 7)}`);
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await createClient();
    const { error } = await db.from("events").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/schedule");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ═══════════════════════════════════════════════════════════
// 제보
// ═══════════════════════════════════════════════════════════

export async function createReport(formData: FormData) {
  const user = await requireUser();
  const db = await createClient();

  const message = text(formData.get("message"));
  if (!message) throw new Error("제보 내용을 입력해 주세요.");

  const { error } = await db.from("reports").insert({
    reporter_id: user.id,
    kind: text(formData.get("kind")) || "etc",
    target_url: orNull(text(formData.get("target_url"))),
    message,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/report");
}

export async function replyToReport(formData: FormData) {
  const user = await requireAdmin();
  const db = await createClient();

  const id = text(formData.get("id"));
  const status = text(formData.get("status")) || "reviewing";
  const reply = orNull(text(formData.get("admin_reply")));
  if (!id) throw new Error("제보를 찾지 못했습니다.");

  const { error } = await db
    .from("reports")
    .update({
      status,
      admin_reply: reply,
      replied_at: reply ? new Date().toISOString() : null,
      replied_by: reply ? user.id : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/report");
}

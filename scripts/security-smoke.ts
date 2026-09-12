/** Creates disposable accounts and rows, tests real REST/RLS, then removes fixtures. */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../src/lib/supabase/admin";
config({ path: ".env.local", quiet: true });

async function main() {
  const service = createAdminClient();
  const ids: string[] = [];
  const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const must = <T extends {error: unknown}>(result: T) => { assert.equal(result.error, null); return result; };
  try {
    const sessions = [];
    for (let i = 0; i < 2; i++) {
      const email = `audit-${randomUUID()}@peopengdan.dev`;
      const password = randomUUID() + "aA!9";
      const created = must(await service.auth.admin.createUser({ email, password, email_confirm: true }));
      const id = created.data.user!.id;
      ids.push(id);
      if (i === 1) must(await service.from("profiles").update({ role: "admin" }).eq("id", id));
      const session = client();
      must(await session.auth.signInWithPassword({ email, password }));
      sessions.push(session);
    }
    const [member, admin] = sessions;
    const anon = client();
    assert.ok((await member.from("profiles").update({ role: "admin" }).eq("id", ids[0])).error);
    must(await member.from("profiles").update({ display_name: "검증펭귄" }).eq("id", ids[0]));
    assert.ok((await anon.from("profiles").select("email").limit(1)).error);
    assert.equal(must(await anon.from("videos").select("id").eq("status", "hidden").limit(1)).data!.length, 0);
    assert.equal(must(await member.from("videos").select("id").eq("status", "hidden").limit(1)).data!.length, 0);
    assert.ok(must(await admin.from("videos").select("id").eq("status", "hidden").limit(1)).data!.length);
    const report = must(await member.from("reports").insert({reporter_id:ids[0],kind:"etc",message:"[자동 검증] 삭제 예정"}).select("id").single()).data!;
    const privateReport = await anon.from("reports").select("id").eq("id",report.id);
    assert.ok(privateReport.error || privateReport.data?.length === 0);
    assert.ok((await member.from("reports").insert({reporter_id:ids[0],kind:"etc",message:"위조",admin_reply:"위조"})).error);
    must(await admin.from("reports").update({admin_reply:"검증 답변",status:"done",replied_by:ids[1]}).eq("id",report.id));
    assert.equal(must(await member.from("reports").select("admin_reply").eq("id",report.id).single()).data!.admin_reply,"검증 답변");
    const post = must(await member.from("posts").insert({author_id:ids[0],title:"[자동 검증] 삭제 예정",body:"권한 검증",category:"chat",is_notice:true}).select("id,is_notice").single()).data!;
    assert.equal(post.is_notice,false);
    must(await member.from("comments").insert({post_id:post.id,author_id:ids[0],body:"댓글 검증"}));
    assert.equal(must(await service.from("posts").select("comment_count").eq("id",post.id).single()).data!.comment_count,1);
    must(await admin.from("posts").update({is_notice:true}).eq("id",post.id));
    assert.ok((await member.from("posts").update({author_id:ids[1]}).eq("id",post.id)).error);
    for(let i=0;i<2;i++) must(await member.from("posts").insert({author_id:ids[0],title:"[자동 검증] 삭제 예정",body:"속도 제한 검증",category:"chat"}));
    assert.ok((await member.from("posts").insert({author_id:ids[0],title:"[자동 검증] 차단 대상",body:"속도 제한 검증",category:"chat"})).error);
    console.log("PASS: role escalation, nickname, private email, hidden videos, private reports, reply forgery, admin reply, notice permission, comment count, ownership, write throttle");
  } finally {
    for (const id of ids) {
      must(await service.from("reports").delete().eq("reporter_id",id));
      must(await service.from("posts").delete().eq("author_id",id));
      must(await service.auth.admin.deleteUser(id));
    }
    console.log("Disposable accounts and content removed");
  }
}
main().catch(() => { console.error("Security smoke test failed; inspect assertions without logging credentials."); process.exitCode=1; });

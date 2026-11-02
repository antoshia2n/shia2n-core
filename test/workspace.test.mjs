import test from "node:test";
import assert from "node:assert/strict";
import { resolveWorkspaceOwner, listWorkspaces, clearWorkspaceCache, WORKSPACE_ID_RE } from "../server/workspace.js";
import { createDbGateway } from "../server/db-gateway.js";

const WS = "ws_" + "a".repeat(32);
const WS2 = "ws_" + "b".repeat(32);
const env = { SUPABASE_URL: "https://sb.example", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x", FIREBASE_PROJECT_ID: "proj" };
const req = (h = {}) => new Request("https://app.example/api/db/xa_obs", { headers: h });

// ws_members に naoki と guest が WS に入っている、という作り物の Supabase
function fakeSupabase(log = []) {
  return async (url, init = {}) => {
    const u = new URL(String(url));
    log.push({ url: u, init });
    if (u.pathname.endsWith("/ws_members")) {
      const ws = (u.searchParams.get("workspace_id") || "").replace(/^eq\./, "");
      const uid = (u.searchParams.get("firebase_uid") || "").replace(/^eq\./, "");
      const rows = [{ workspace_id: WS, firebase_uid: "naoki", role: "owner" }, { workspace_id: WS, firebase_uid: "guest", role: "editor" }];
      return Response.json(rows.filter(r => r.firebase_uid === uid && (!ws || r.workspace_id === ws)).map(r => ({ role: r.role, workspace_id: r.workspace_id })));
    }
    if (u.pathname.endsWith("/ws_workspaces")) return Response.json([{ id: WS, name: "おかぜり案件" }]);
    return Response.json([]);
  };
}

test("場所の番号の形", () => {
  assert.ok(WORKSPACE_ID_RE.test(WS));
  assert.ok(!WORKSPACE_ID_RE.test("ws_x"));
  assert.ok(!WORKSPACE_ID_RE.test("VrMwzeSceqWeXVQOrm8kpu4uVR33"));
});

test("見出しが無ければ本人の番号（今のデータはそのまま）", async () => {
  clearWorkspaceCache();
  assert.equal(await resolveWorkspaceOwner({ uid: "naoki", request: req(), env, fetchImpl: fakeSupabase() }), "naoki");
  assert.equal(await resolveWorkspaceOwner({ uid: "naoki", request: req({ "X-Workspace": "me" }), env, fetchImpl: fakeSupabase() }), "naoki");
});

test("入っている場所なら場所の番号・入っていなければ 403・形が違えば 400", async () => {
  clearWorkspaceCache();
  assert.equal(await resolveWorkspaceOwner({ uid: "guest", request: req({ "X-Workspace": WS }), env, fetchImpl: fakeSupabase() }), WS);
  await assert.rejects(resolveWorkspaceOwner({ uid: "stranger", request: req({ "X-Workspace": WS }), env, fetchImpl: fakeSupabase() }), e => e.status === 403);
  await assert.rejects(resolveWorkspaceOwner({ uid: "guest", request: req({ "X-Workspace": WS2 }), env, fetchImpl: fakeSupabase() }), e => e.status === 403);
  await assert.rejects(resolveWorkspaceOwner({ uid: "guest", request: req({ "X-Workspace": "ws_' or 1=1" }), env, fetchImpl: fakeSupabase() }), e => e.status === 400);
});

test("一覧は入っている場所だけ・名前つき", async () => {
  assert.deepEqual(await listWorkspaces({ env, uid: "guest", fetchImpl: fakeSupabase() }), [{ id: WS, name: "おかぜり案件", role: "editor" }]);
  assert.deepEqual(await listWorkspaces({ env, uid: "stranger", fetchImpl: fakeSupabase() }), []);
});

/* ── 出入り口に通したとき：本物の署名でログインの印を作って確かめる ── */
async function makeSigner() {
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const kid = "k" + Math.random().toString(36).slice(2); // 出入り口は鍵の一覧を覚えるので、試しごとに別の名前
  const jwk = { ...(await crypto.subtle.exportKey("jwk", kp.publicKey)), kid };
  const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
  const sign = async sub => {
    const now = Math.floor(Date.now() / 1000);
    const head = b64({ alg: "RS256", kid }), pay = b64({ sub, aud: "proj", iss: "https://securetoken.google.com/proj", exp: now + 600, iat: now });
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(`${head}.${pay}`));
    return `${head}.${pay}.${Buffer.from(sig).toString("base64url")}`;
  };
  return { jwk, sign };
}
// 出入り口は Google の鍵の一覧を 1 時間覚えるので、試しの鍵は 1 つを使い回す
let signer = null;
const getSigner = async () => (signer ??= await makeSigner());

test("出入り口：場所で開くと持ち主の列が場所の番号になり、入っていない人は 403", async () => {
  clearWorkspaceCache();
  const { jwk, sign } = await getSigner();
  const log = [];
  const sb = fakeSupabase(log);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url).includes("googleapis.com") ? Response.json({ keys: [jwk] }) : sb(url, init);
  try {
    const gw = createDbGateway({ tables: { xa_obs: { owner: "user_id" }, sw_swipes: { owner: "user_id", readOnly: true, personal: true } }, functions: { xa_act_add: { owner: "p_user_id" } }, resolveOwner: ({ uid, request, env }) => resolveWorkspaceOwner({ uid, request, env, fetchImpl: sb }) });
    const call = async (sub, { method = "GET", ws, body, path = "xa_obs" } = {}) => gw({ env, request: new Request(`https://app.example/api/db/${path}`, { method, body, headers: { Authorization: `Bearer ${await sign(sub)}`, ...(ws ? { "X-Workspace": ws } : {}), "content-type": "application/json" } }) });
    const lastTo = name => [...log].reverse().find(l => l.url.pathname.endsWith(`/${name}`));

    // 1. 見出しなし：本人の番号で絞る（今の動きと同じ）
    await call("naoki");
    assert.equal(lastTo("xa_obs").url.searchParams.get("user_id"), "eq.naoki");
    // 2. 場所で読む：場所の番号で絞る
    await call("guest", { ws: WS });
    assert.equal(lastTo("xa_obs").url.searchParams.get("user_id"), `eq.${WS}`);
    // 3. 場所で書く：画面が別の持ち主を送っても場所の番号で押す
    await call("guest", { ws: WS, method: "POST", body: JSON.stringify({ user_id: "naoki", note: "x" }) });
    assert.equal(JSON.parse(lastTo("xa_obs").init.body).user_id, WS);
    // 4. 関数の持ち主の引数も場所の番号
    await call("guest", { ws: WS, method: "POST", path: "rpc/xa_act_add", body: JSON.stringify({ p_user_id: "naoki" }) });
    assert.equal(JSON.parse(lastTo("rpc/xa_act_add").init.body).p_user_id, WS);
    // 4b. 人に付ける表（スワイプくんの正本）は場所で開いていても本人の番号
    await call("guest", { ws: WS, path: "sw_swipes" });
    assert.equal(lastTo("sw_swipes").url.searchParams.get("user_id"), "eq.guest");
    // 5. 入っていない人：403・Supabase の表へは届かない
    const before = log.filter(l => l.url.pathname.endsWith("/xa_obs")).length;
    const res = await call("stranger", { ws: WS });
    assert.equal(res.status, 403);
    assert.equal(log.filter(l => l.url.pathname.endsWith("/xa_obs")).length, before);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("出入り口：resolveOwner を渡さないアプリは今までどおり本人の番号（見出しを送られても効かない）", async () => {
  const { jwk, sign } = await getSigner();
  const log = [];
  const sb = fakeSupabase(log);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url).includes("googleapis.com") ? Response.json({ keys: [jwk] }) : sb(url, init);
  try {
    const gw = createDbGateway({ tables: { xa_obs: { owner: "user_id" } } });
    await gw({ env, request: new Request("https://app.example/api/db/xa_obs", { headers: { Authorization: `Bearer ${await sign("guest")}`, "X-Workspace": WS } }) });
    assert.equal([...log].reverse().find(l => l.url.pathname.endsWith("/xa_obs")).url.searchParams.get("user_id"), "eq.guest");
  } finally {
    globalThis.fetch = realFetch;
  }
});

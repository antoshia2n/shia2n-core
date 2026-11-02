/**
 * 場所（ワークスペース）— データを「人」ではなく「場所」に付ける（2026-11-02・Naoki「OK」13:32）
 *
 * 考え方：
 *   - 1 人 1 アカウントのまま、人は複数の場所に入れる（外部の型：Slack・Notion・Clerk の組織）
 *   - 自分の場所 … これまでどおり、表の持ち主の列（user_id）に本人の番号（uid）が入る。今あるデータは何も動かさない
 *   - みんなの場所 … 持ち主の列に場所の番号（ws_ で始まる 35 字）が入る。場所に入っている人だけが読み書きできる
 *   - どの場所で開いているかは、画面が見出し X-Workspace で送る。空なら自分の場所
 *   - 入っているかの判断は、この 1 ファイルだけに置く（表 ws_members を管理者の鍵で読む）
 *
 * 表（supabase：ws_workspaces・ws_members。RLS は有効で、決まりを置かない＝管理者の鍵でしか読めない）
 *   ws_workspaces … id（ws_＋32 字）・name・created_at
 *   ws_members    … workspace_id・firebase_uid・role（owner / editor）・member_id・created_at
 *
 * 気をつけること（2026-11-02 確認役のレビュー）
 *   - 入っているかの答えは 30 秒覚える。抜けた人も最長 30 秒は開ける
 *   - 関数（rpc）の持ち主の引数は場所の番号になる。人に付ける表（personal）を触る関数には使わない
 *   - 場所に入っていても、アプリの入場（門番の権利）は別。場所を使うアプリは、今までどおり自分の門番を置く
 *
 * 動作環境：Cloudflare Pages Functions / Workers
 */

export const WORKSPACE_HEADER = "x-workspace";
export const WORKSPACE_ID_RE = /^ws_[0-9a-f]{32}$/;

const CACHE_MS = 30_000;
const cache = new Map(); // `${ws}|${uid}` → { role, expiresAt }

export class WorkspaceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function serviceHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const h = { apikey: key };
  if (/^eyJ/.test(String(key))) h.Authorization = `Bearer ${key}`;
  return h;
}
const baseUrl = env => (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");

/** 画面が送ってきた場所の番号。空なら null（自分の場所） */
export function requestedWorkspace(request) {
  const raw = (request.headers.get(WORKSPACE_HEADER) ?? "").trim();
  if (!raw || raw === "me") return null;
  if (!WORKSPACE_ID_RE.test(raw)) throw new WorkspaceError(400, "場所の指定の形が正しくありません。");
  return raw;
}

/** その人がその場所に入っているか。入っていれば役割（owner / editor）、いなければ null */
export async function memberRole({ env, workspaceId, uid, fetchImpl = fetch, now = Date.now() }) {
  const key = `${workspaceId}|${uid}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.role;
  const url = `${baseUrl(env)}/rest/v1/ws_members?select=role&workspace_id=eq.${encodeURIComponent(workspaceId)}&firebase_uid=eq.${encodeURIComponent(uid)}&limit=1`;
  const res = await fetchImpl(url, { headers: serviceHeaders(env) });
  if (!res.ok) throw new WorkspaceError(502, "場所に入っているかを確かめられませんでした。");
  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows)) throw new WorkspaceError(502, "場所に入っているかを確かめられませんでした。");
  const role = rows[0]?.role ?? null;
  for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
  cache.set(key, { role, expiresAt: now + CACHE_MS });
  return role;
}

/**
 * データの出入り口（db-gateway）の resolveOwner に渡す関数。
 * 見出しが無ければ本人の番号、あれば「入っている場所」の番号を返す。入っていなければ 403。
 */
export async function resolveWorkspaceOwner({ uid, request, env, fetchImpl = fetch }) {
  const ws = requestedWorkspace(request);
  if (!ws) return uid;
  const role = await memberRole({ env, workspaceId: ws, uid, fetchImpl });
  if (!role) throw new WorkspaceError(403, "この場所に入っていないため、開けません。");
  return ws;
}

/** その人が入っている場所の一覧（切り替えのメニュー用）。自分の場所は含めない */
export async function listWorkspaces({ env, uid, fetchImpl = fetch }) {
  const h = serviceHeaders(env);
  const res = await fetchImpl(`${baseUrl(env)}/rest/v1/ws_members?select=workspace_id,role&firebase_uid=eq.${encodeURIComponent(uid)}&limit=100`, { headers: h });
  if (!res.ok) throw new WorkspaceError(502, "場所の一覧を読めませんでした。");
  const mem = await res.json().catch(() => null);
  if (!Array.isArray(mem)) throw new WorkspaceError(502, "場所の一覧を読めませんでした。");
  if (!mem.length) return [];
  const ids = mem.map(m => m.workspace_id).filter(id => WORKSPACE_ID_RE.test(id));
  if (!ids.length) return [];
  const r2 = await fetchImpl(`${baseUrl(env)}/rest/v1/ws_workspaces?select=id,name&id=in.(${ids.join(",")})&order=name.asc`, { headers: h });
  if (!r2.ok) throw new WorkspaceError(502, "場所の一覧を読めませんでした。");
  const ws = await r2.json().catch(() => null);
  if (!Array.isArray(ws)) throw new WorkspaceError(502, "場所の一覧を読めませんでした。");
  const role = new Map(mem.map(m => [m.workspace_id, m.role]));
  return ws.map(w => ({ id: w.id, name: w.name, role: role.get(w.id) ?? "editor" }));
}

/** テスト用：覚えた答えを消す */
export function clearWorkspaceCache() { cache.clear(); }

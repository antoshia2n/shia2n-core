/**
 * 表の読み書きの出入り口へ回す fetch と、今開いている場所（ワークスペース）。
 * 2026-11-03 1.13.0：lib/supabase.js から切り出した（中身は同じ）。lib/supabase.js と lib/supabase-lite.js が同じものを使う。
 * 場所の覚えはこの 1 か所なので、どちらの入口から変えても同じ値になる。
 */
export const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 例: "/api/db"。未設定なら直結のまま。
const GATEWAY_PATH = (import.meta.env.VITE_DB_GATEWAY ?? "").replace(/\/+$/, "");

const REST_PREFIX = `${(SUPABASE_URL ?? "").replace(/\/+$/, "")}/rest/v1/`;

/** 出入り口を経由する設定になっているか（診断・計測画面から参照する） */
export const dbGatewayEnabled = GATEWAY_PATH.length > 0;
export const dbGatewayPath    = GATEWAY_PATH;

/**
 * 今開いている場所（2026-11-02）。空なら自分の場所。
 * 選んだ場所はこのアプリの住所のブラウザに覚え、表の読み書きの見出し X-Workspace で送る。
 * 入っているかの判断はサーバー（server/workspace.js）だけがする。ここは送るだけ。
 */
const WS_KEY = "shia2n.workspace";
const WS_RE  = /^ws_[0-9a-f]{32}$/;
let currentWs = null;
try { const v = localStorage.getItem(WS_KEY); currentWs = WS_RE.test(v ?? "") ? v : null; } catch { /* 覚えられない画面では自分の場所 */ }
export const getWorkspace = () => currentWs;
export function setWorkspace(id) {
  currentWs = WS_RE.test(id ?? "") ? id : null;
  try { if (currentWs) localStorage.setItem(WS_KEY, currentWs); else localStorage.removeItem(WS_KEY); } catch { /* 覚えられなくても今の画面では効く */ }
  return currentWs;
}

/** ログイン済みの証明（ID トークン）を取り出す。画面から user_id を送る運用はしない。 */
async function currentIdToken(auth) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("ログイン状態を確認できませんでした。ページを再読み込みしてください。");
  }
  return user.getIdToken();
}

/**
 * 表の読み書きだけを自分のアプリのサーバーへ回す fetch。
 * それ以外（添付ファイルなど）は素通しする。auth は Firebase のログイン（full でも lite でも同じ形）。
 */
export const makeGatewayFetch = (auth) => async function gatewayFetch(input, init = {}) {
  const isRequest = typeof input !== "string" && typeof input?.url === "string";
  const url       = isRequest ? input.url : String(input);

  if (!dbGatewayEnabled || !REST_PREFIX || !url.startsWith(REST_PREFIX)) {
    return fetch(input, init);
  }

  const rest   = url.slice(REST_PREFIX.length); // 例: "sw_swipes?select=*&..."
  const target = `${window.location.origin}${GATEWAY_PATH}/${rest}`;

  const headers = new Headers(init?.headers ?? (isRequest ? input.headers : undefined));
  headers.delete("apikey");
  headers.set("Authorization", `Bearer ${await currentIdToken(auth)}`);
  if (currentWs) headers.set("X-Workspace", currentWs); else headers.delete("X-Workspace");

  const body   = init?.body ?? (isRequest ? await input.clone().arrayBuffer() : undefined);
  const method = init?.method ?? (isRequest ? input.method : "GET");

  return fetch(target, {
    ...init,
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
};

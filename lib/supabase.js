import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebase.js";

/**
 * データの出入り口（2026-07-30 決定「画面は公開キーでデータベースに直接触らない」）
 *
 * VITE_DB_GATEWAY を設定したアプリだけ、表の読み書きが自分のアプリのサーバー経由になる。
 * 設定していないアプリはこれまで通り直結で動く（切り替えはアプリ単位）。
 *
 * 経由するもの   ： /rest/v1/*（表の読み書き・データベース関数の呼び出し）
 * 経由しないもの ： /storage/v1/*（添付ファイルの置き場。別途対応）
 *
 * 呼び出し側のコードは一切変わらない。ここで通信先だけを差し替えている。
 */

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 例: "/api/db"。未設定なら直結のまま。
const GATEWAY_PATH = (import.meta.env.VITE_DB_GATEWAY ?? "").replace(/\/+$/, "");

const REST_PREFIX = `${(SUPABASE_URL ?? "").replace(/\/+$/, "")}/rest/v1/`;

/** 出入り口を経由する設定になっているか（診断・計測画面から参照する） */
export const dbGatewayEnabled = GATEWAY_PATH.length > 0;
export const dbGatewayPath    = GATEWAY_PATH;

/** ログイン済みの証明（ID トークン）を取り出す。画面から user_id を送る運用はしない。 */
async function currentIdToken() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("ログイン状態を確認できませんでした。ページを再読み込みしてください。");
  }
  return user.getIdToken();
}

/**
 * 表の読み書きだけを自分のアプリのサーバーへ回す fetch。
 * それ以外（添付ファイルなど）は素通しする。
 */
async function gatewayFetch(input, init = {}) {
  const isRequest = typeof input !== "string" && typeof input?.url === "string";
  const url       = isRequest ? input.url : String(input);

  if (!dbGatewayEnabled || !REST_PREFIX || !url.startsWith(REST_PREFIX)) {
    return fetch(input, init);
  }

  const rest   = url.slice(REST_PREFIX.length); // 例: "sw_swipes?select=*&..."
  const target = `${window.location.origin}${GATEWAY_PATH}/${rest}`;

  const headers = new Headers(init?.headers ?? (isRequest ? input.headers : undefined));
  headers.delete("apikey");
  headers.set("Authorization", `Bearer ${await currentIdToken()}`);

  const body   = init?.body ?? (isRequest ? await input.clone().arrayBuffer() : undefined);
  const method = init?.method ?? (isRequest ? input.method : "GET");

  return fetch(target, {
    ...init,
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: gatewayFetch },
});

// ── 汎用 CRUD ─────────────────────────────────────────────
// 一覧取得（user_id でフィルタ）
export const fetchAll = (table, uid, orderBy = "created_at", ascending = true) =>
  supabase.from(table).select("*").eq("user_id", uid).order(orderBy, { ascending });

// 1件取得
export const fetchOne = (table, id) =>
  supabase.from(table).select("*").eq("id", id).single();

// 1件追加（user_id を自動付与）
export const insertOne = (table, uid, data) =>
  supabase.from(table).insert({ user_id: uid, ...data }).select().single();

// 1件更新
export const updateOne = (table, id, changes) =>
  supabase.from(table).update(changes).eq("id", id);

// 1件削除
export const deleteOne = (table, id) =>
  supabase.from(table).delete().eq("id", id);

// Upsert（設定系で使う。key列でユニーク判定）
export const upsertOne = (table, uid, keyColumn, data) =>
  supabase.from(table).upsert({ user_id: uid, ...data }, { onConflict: `user_id,${keyColumn}` });

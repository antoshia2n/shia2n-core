/**
 * 表の読み書きの軽い入口（2026-11-03 1.13.0）。@supabase/supabase-js の全部（ログイン・置き場・リアルタイム）ではなく、
 * 表の読み書き（@supabase/postgrest-js）だけを持つ。supabase.from(...) の書き方は今までと同じ。
 * 出入り口（VITE_DB_GATEWAY）の扱いは lib/gateway-fetch.js で、今までの入口と同じもの。
 */
import { PostgrestClient } from "@supabase/postgrest-js";
import { auth } from "./firebase-lite.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, makeGatewayFetch } from "./gateway-fetch.js";
import { makeCrud } from "./crud.js";
export { dbGatewayEnabled, dbGatewayPath, getWorkspace, setWorkspace } from "./gateway-fetch.js";

const rest = `${(SUPABASE_URL ?? "").replace(/\/+$/, "")}/rest/v1`;
export const supabase = new PostgrestClient(rest, {
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  schema: "public", // 今までの入口と同じ見出し（Accept-Profile / Content-Profile）を送る
  fetch: makeGatewayFetch(auth),
});

export const { fetchAll, fetchOne, insertOne, updateOne, deleteOne, upsertOne } = makeCrud(supabase);

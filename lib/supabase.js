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

import { SUPABASE_URL, SUPABASE_ANON_KEY, makeGatewayFetch } from "./gateway-fetch.js";
export { dbGatewayEnabled, dbGatewayPath, getWorkspace, setWorkspace } from "./gateway-fetch.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: makeGatewayFetch(auth) },
});

// ── 汎用 CRUD（中身は lib/crud.js。lite と同じものを使う）──────────────
import { makeCrud } from "./crud.js";
export const { fetchAll, fetchOne, insertOne, updateOne, deleteOne, upsertOne } = makeCrud(supabase);

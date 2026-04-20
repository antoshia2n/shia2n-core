import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

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

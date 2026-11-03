/** 汎用 CRUD（2026-11-03 1.13.0：lib/supabase.js から切り出した・中身は同じ）。supabase は .from() を持つものなら何でもよい */
export function makeCrud(supabase) {
  // ── 汎用 CRUD ─────────────────────────────────────────────
  // 一覧取得（user_id でフィルタ）
  const fetchAll = (table, uid, orderBy = "created_at", ascending = true) =>
    supabase.from(table).select("*").eq("user_id", uid).order(orderBy, { ascending });

  // 1件取得
  const fetchOne = (table, id) =>
    supabase.from(table).select("*").eq("id", id).single();

  // 1件追加（user_id を自動付与）
  const insertOne = (table, uid, data) =>
    supabase.from(table).insert({ user_id: uid, ...data }).select().single();

  // 1件更新
  const updateOne = (table, id, changes) =>
    supabase.from(table).update(changes).eq("id", id);

  // 1件削除
  const deleteOne = (table, id) =>
    supabase.from(table).delete().eq("id", id);

  // Upsert（設定系で使う。key列でユニーク判定）
  const upsertOne = (table, uid, keyColumn, data) =>
    supabase.from(table).upsert({ user_id: uid, ...data }, { onConflict: `user_id,${keyColumn}` });
  return { fetchAll, fetchOne, insertOne, updateOne, deleteOne, upsertOne };
}

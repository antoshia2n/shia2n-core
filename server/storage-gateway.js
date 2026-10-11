/**
 * 添付ファイルの置き場の出入り口（サーバー側）
 * 正本：2026-07-30 決定「画面は公開キーでデータベースに直接触らない」
 *       2026-08-09 見直し「置き場は、公開キーでは書けない・消せない。読み取りは公開のまま」
 *
 * 役割はこの5つだけ。判断はすべてこの1ファイルに集約する。
 *   1. ログイン済みの証明を毎回照合し、本人（uid）を確定する
 *   2. 置いてよい入れ物（バケット）だけを通す
 *   3. 置いてよい種類・大きさだけを通す
 *   4. 保存先の名前をサーバー側で決める（画面が決めた名前は使わない＝既存ファイルを上書きさせない）
 *   5. 管理者キーを付けて置き場へ転送する
 *
 * 各アプリ側は、この関数を呼ぶだけの受け皿を1ファイル置く（入れ物の一覧を渡すだけ）。
 *
 * 取り出し（表示）はこの口を通らない。置き場を公開のままにしてあるため、
 * 画面はこれまで通り公開の住所で画像を表示する。
 *
 * 動作環境：Cloudflare Pages Functions / Workers（ブラウザ用の記述は入れないこと）
 */

import { verifyIdToken } from "./db-gateway.js";

/** 既定で置いてよい拡張子。画面の中で開かれるため、絵として安全なものだけにする。 */
const DEFAULT_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif"];

/** 既定の大きさの上限（50MB） */
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

/** 既定で置いてよい種類 */
const DEFAULT_CONTENT_TYPE_PREFIX = "image/";

class StorageGatewayError extends Error {
  constructor(status, message, hint = "") {
    super(message);
    this.status = status;
    this.hint = hint;
  }
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function errorResponse(err) {
  const status = typeof err?.status === "number" ? err.status : 500;
  return jsonResponse(status, {
    message: err?.message || "保存できませんでした",
    hint: err?.hint || "",
    code: `STORAGE_${status}`,
  });
}

/** 元のファイル名から拡張子だけを取り出す。決められないときは断る。 */
function extensionOf(name, allowed) {
  const raw = String(name ?? "");
  const dot = raw.lastIndexOf(".");
  const ext = dot >= 0 ? raw.slice(dot + 1).toLowerCase() : "";
  if (!ext || !/^[a-z0-9]{1,10}$/.test(ext) || !allowed.includes(ext)) {
    throw new StorageGatewayError(
      415,
      "この種類のファイルは置けません。",
      `置けるのは ${allowed.join(" / ")} です。`,
    );
  }
  return ext;
}

/**
 * @param {object} options
 * @param {object} options.buckets  置いてよい入れ物
 *   { contentos: { prefix: "images/", maxBytes: 52428800, extensions: ["jpg","png"], contentTypePrefix: "image/" } }
 *   prefix / maxBytes / extensions / contentTypePrefix はすべて任意。書かなければ既定値になる。
 * @param {string[]} options.allowUids  ここに挙げた利用者だけ通す。空なら全員通す。
 */
export function createStorageGateway({ buckets = {}, allowUids = [] } = {}) {
  const allowList = Array.isArray(allowUids) ? allowUids.filter(Boolean) : [];

  return async function onRequest(context) {
    const { request, env } = context;

    try {
      const supabaseUrl = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
      const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
      const projectId = env.FIREBASE_PROJECT_ID ?? env.VITE_FIREBASE_PROJECT_ID ?? "";

      if (!supabaseUrl || !serviceKey || !projectId) {
        throw new StorageGatewayError(
          500,
          "置き場の出入り口の設定が足りません。",
          "Cloudflare の設定に SUPABASE_SERVICE_ROLE_KEY があるか確認してください。",
        );
      }

      if (request.method.toUpperCase() !== "POST") {
        throw new StorageGatewayError(405, "この操作は許可されていません。");
      }

      // ── 1. 本人を確定する ──────────────────────────────────────────────
      const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
      if (!token) throw new StorageGatewayError(401, "ログインが必要です。");
      const uid = await verifyIdToken(token, projectId);

      if (allowList.length && !allowList.includes(uid)) {
        throw new StorageGatewayError(403, "この利用者にはファイルを置く許可がありません。");
      }

      // ── 2. 置いてよい入れ物かを確かめる ────────────────────────────────
      const url = new URL(request.url);
      const bucket = url.searchParams.get("bucket") ?? "";
      if (!bucket || !Object.prototype.hasOwnProperty.call(buckets, bucket)) {
        throw new StorageGatewayError(403, "この置き場には入れられません。");
      }
      const conf = buckets[bucket] ?? {};
      const prefix = typeof conf.prefix === "string" ? conf.prefix : "";
      const maxBytes = Number.isFinite(conf.maxBytes) ? conf.maxBytes : DEFAULT_MAX_BYTES;
      const allowedExt = Array.isArray(conf.extensions) && conf.extensions.length
        ? conf.extensions.map(e => String(e).toLowerCase())
        : DEFAULT_EXTENSIONS;
      const typePrefix = typeof conf.contentTypePrefix === "string"
        ? conf.contentTypePrefix
        : DEFAULT_CONTENT_TYPE_PREFIX;

      // ── 3. 置いてよい種類・大きさかを確かめる ──────────────────────────
      const ext = extensionOf(url.searchParams.get("name"), allowedExt);

      const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (typePrefix && !contentType.startsWith(typePrefix)) {
        throw new StorageGatewayError(
          415,
          "この種類のファイルは置けません。",
          `受け付けるのは ${typePrefix}* です。`,
        );
      }

      const bytes = await request.arrayBuffer();
      if (bytes.byteLength === 0) {
        throw new StorageGatewayError(400, "中身が空のファイルは置けません。");
      }
      if (bytes.byteLength > maxBytes) {
        throw new StorageGatewayError(
          413,
          "ファイルが大きすぎます。",
          `上限は ${Math.floor(maxBytes / (1024 * 1024))}MB です。`,
        );
      }

      // ── 4. 保存先の名前をこちらで決める ────────────────────────────────
      // 画面が決めた名前は使わない。既に置いてあるファイルを上書きさせないため。
      const safeName = `${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}.${ext}`;
      const path = `${prefix}${safeName}`;

      // ── 5. 管理者キーを付けて置き場へ転送する ──────────────────────────
      const upstream = await fetch(
        `${supabaseUrl}/storage/v1/object/${bucket}/${path}`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            ...(/^eyJ/.test(String(serviceKey || "")) ? { Authorization: `Bearer ${serviceKey}` } : {}),
            "Content-Type": contentType || "application/octet-stream",
            "Cache-Control": "max-age=3600",
            "x-upsert": "false",
          },
          body: bytes,
        },
      );

      if (!upstream.ok) {
        // 置き場からの返答をそのまま添えて返す。原因を画面の1行で分かるようにするため。
        const detail = (await upstream.text().catch(() => "")).slice(0, 300);
        throw new StorageGatewayError(
          502,
          "置き場が保存を受け付けませんでした。",
          `置き場からの返答（${upstream.status}）：${detail || "本文なし"}`,
        );
      }

      return jsonResponse(200, { ok: true, bucket, path });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/**
 * 診断用。設定が揃っているかだけを返す。値そのものは返さない
 * （認証の外側に置く画面に値を出さないため）。
 */
export function checkStorageGateway(env) {
  const missing = [];
  if (!(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!(env.FIREBASE_PROJECT_ID ?? env.VITE_FIREBASE_PROJECT_ID)) missing.push("FIREBASE_PROJECT_ID");

  if (missing.length) {
    return { ok: false, detail: `設定が足りません：${missing.join(" / ")}` };
  }
  return { ok: true, detail: "設定あり" };
}

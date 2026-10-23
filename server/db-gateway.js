/**
 * データの出入り口（サーバー側）
 * 正本：2026-07-30 決定「画面は公開キーでデータベースに直接触らない」
 *
 * 役割はこの4つだけ。判断はすべてこの1ファイルに集約する。
 *   1. ログイン済みの証明を毎回照合し、本人（uid）を確定する
 *   2. 触ってよい表・呼んでよい関数だけを通す
 *   3. 読み書きの条件に本人の印を強制で足す（画面からの自己申告は使わない）
 *   4. 管理者キーを付けて Supabase へ転送する
 *
 * 各アプリ側は、この関数を呼ぶだけの受け皿を1ファイル置く（表の一覧を渡すだけ）。
 *
 * 動作環境：Cloudflare Pages Functions / Workers（ブラウザ用の記述は入れないこと）
 */

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const ALLOWED_METHODS = ["GET", "HEAD", "POST", "PATCH", "DELETE"];

// 画面から転送してよい見出し（Supabase が解釈するもののみ）
const FORWARD_REQUEST_HEADERS = [
  "accept",
  "content-type",
  "prefer",
  "range",
  "range-unit",
  "accept-profile",
  "content-profile",
];

let jwksCache = { keys: null, expiresAt: 0 };

/* ── 小物 ────────────────────────────────────────────────────────────────── */

class GatewayError extends Error {
  constructor(status, message, hint = "") {
    super(message);
    this.status = status;
    this.hint   = hint;
  }
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function errorResponse(err) {
  const status = err instanceof GatewayError ? err.status : 500;
  return jsonResponse(status, {
    message: err.message || "処理できませんでした",
    hint:    err.hint || "",
    code:    `GATEWAY_${status}`,
  });
}

function base64UrlToBytes(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    input.length + ((4 - (input.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToJson(input) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(input)));
}

/* ── ログイン済みの証明の照合 ────────────────────────────────────────────── */

async function loadJwks() {
  const now = Date.now();
  if (jwksCache.keys && now < jwksCache.expiresAt) return jwksCache.keys;

  const res = await fetch(JWKS_URL);
  if (!res.ok) {
    throw new GatewayError(503, "ログインの確認に必要な情報を取得できませんでした。時間をおいて再度お試しください。");
  }
  const data    = await res.json();
  const control = res.headers.get("cache-control") ?? "";
  const matched = control.match(/max-age=(\d+)/);
  const maxAge  = matched ? Number(matched[1]) : 3600;

  jwksCache = { keys: data.keys ?? [], expiresAt: now + maxAge * 1000 };
  return jwksCache.keys;
}

/**
 * Firebase のログイン証明を検証して uid を返す。
 * 署名・発行元・宛先・有効期限をすべて確認する。1つでも合わなければ通さない。
 */
export async function verifyIdToken(token, projectId) {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3) throw new GatewayError(401, "ログイン情報の形式が正しくありません。");

  const [rawHeader, rawPayload, rawSignature] = parts;

  let header;
  let payload;
  try {
    header  = base64UrlToJson(rawHeader);
    payload = base64UrlToJson(rawPayload);
  } catch {
    throw new GatewayError(401, "ログイン情報を読み取れませんでした。");
  }

  if (header.alg !== "RS256") throw new GatewayError(401, "ログイン情報の署名方式が想定と異なります。");

  const keys = await loadJwks();
  const jwk  = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new GatewayError(401, "ログイン情報が古い可能性があります。ページを再読み込みしてください。");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(rawSignature),
    new TextEncoder().encode(`${rawHeader}.${rawPayload}`),
  );
  if (!valid) throw new GatewayError(401, "ログイン情報の署名が一致しません。");

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new GatewayError(401, "ログインの有効期限が切れています。ページを再読み込みしてください。");
  }
  if (payload.aud !== projectId) throw new GatewayError(401, "ログイン情報の宛先が一致しません。");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new GatewayError(401, "ログイン情報の発行元が一致しません。");
  }
  if (!payload.sub) throw new GatewayError(401, "ログイン情報に利用者が入っていません。");

  return payload.sub;
}

/**
 * 「決まった絞り込み」を、新しい行に入れる値へ読み替える。
 * eq.〜 の形だけを扱う。それ以外は入れるべき値が1つに決まらないため作成を断る。
 */
function forcedInsertValue(column, condition) {
  const raw = String(condition ?? "");
  if (!raw.startsWith("eq.")) {
    throw new GatewayError(
      403,
      "この表には新しい行を作れません。",
      `${column} の条件が eq. 以外のため、作成時に入れる値を決められません。`,
    );
  }
  const value = raw.slice(3);
  if (value === "true")  return true;
  if (value === "false") return false;
  if (value === "null")  return null;
  return value;
}

/* ── 本体 ────────────────────────────────────────────────────────────────── */

/**
 * @param {object}   options
 * @param {string}   options.basePath   受け口のパス（例 "/api/db"）
 * @param {object}   options.tables     触ってよい表
 *   - 利用者ごとに分ける表： { 表名: { owner: "user_id" } }（既定）
 *   - 分けない表（管理者だけが使うもの）： { 表名: { owner: null } }
 *     owner を null にした表では、本人の印での絞り込みも押印も行わない。
 *     必ず allowUids か、下の readOnly / force と併用すること。
 *   - 読み取り専用： { 表名: { readOnly: true } }
 *     取り出す以外の操作をこの時点で断る。
 *   - 決まった絞り込み： { 表名: { force: { is_active: "eq.true" } } }
 *     取り出し・書き換え・削除に必ずこの条件を足す。画面が外しても効く。
 *     新しい行を作るときは、同じ値を強制的に入れて絞り込みの内側に置く。
 *     eq. 以外の条件を書いた表では、入れる値が決まらないため作成を断る。
 *   readOnly / force はどちらも任意。書かなければ従来どおりの動きになる。
 * @param {string[]|object} options.functions  呼んでよいデータベース関数
 *   - 従来どおりの書き方（名前だけ）： ["sw_increment_ref"]
 *     名前が一覧にあるかどうかだけを見て、送られてきた中身をそのまま渡す。
 *   - 本人の印を強制する書き方： { sw_increment_ref: { owner: "p_user_id" } }
 *     呼び出しの中身にある owner の引数を、こちらで確定した本人の印で必ず上書きする。
 *     画面が別の値を入れて送ってきても捨てる。関数の側は、その引数と一致する行だけを
 *     対象にすること（関数を直さないと、引数が増えるだけで絞り込みは効かない）。
 *     この書き方をした関数は、中身を差し替える必要があるため POST だけを通す。
 * @param {string[]} options.allowUids  ここに挙げた利用者だけ通す。空なら全員通す。
 */
export function createDbGateway({
  basePath = "/api/db",
  tables = {},
  functions = [],
  allowUids = [],
} = {}) {
  const base       = basePath.replace(/\/+$/, "");
  const allowList  = Array.isArray(allowUids) ? allowUids.filter(Boolean) : [];

  // 関数の設定は2つの書き方を受け付ける。どちらも同じ形（名前 → 設定）に揃えてから使う。
  //   ["sw_increment_ref"]                        → { sw_increment_ref: {} }
  //   { sw_increment_ref: { owner: "p_user_id" } } → そのまま
  const functionConf = Array.isArray(functions)
    ? Object.fromEntries(functions.filter(Boolean).map(name => [name, {}]))
    : (functions && typeof functions === "object" ? functions : {});

  return async function onRequest(context) {
    const { request, env } = context;


    try {
      const supabaseUrl = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
      const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
      const projectId   = env.FIREBASE_PROJECT_ID ?? env.VITE_FIREBASE_PROJECT_ID ?? "";

      if (!supabaseUrl || !serviceKey || !projectId) {
        throw new GatewayError(
          500,
          "データの出入り口の設定が足りません。",
          "Cloudflare の設定に SUPABASE_SERVICE_ROLE_KEY があるか確認してください。",
        );
      }

      const method = request.method.toUpperCase();
      if (!ALLOWED_METHODS.includes(method)) {
        throw new GatewayError(405, "この操作は許可されていません。");
      }

      const url  = new URL(request.url);
      const rest = url.pathname.startsWith(base)
        ? url.pathname.slice(base.length).replace(/^\/+/, "")
        : "";
      if (!rest) throw new GatewayError(404, "宛先が指定されていません。");

      const segments = rest.split("/").filter(Boolean);
      const isRpc    = segments[0] === "rpc";

      // ── 1. 本人を確定する ──────────────────────────────────────────────
      const authHeader = request.headers.get("authorization") ?? "";
      const token      = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) throw new GatewayError(401, "ログインが必要です。");
      const uid = await verifyIdToken(token, projectId);

      if (allowList.length && !allowList.includes(uid)) {
        throw new GatewayError(403, "この利用者にはこの画面のデータを扱う許可がありません。");
      }

      // ── 2. 触ってよいものかを確かめる ──────────────────────────────────
      let targetPath;
      let ownerColumn = null;
      let forceFilter = null;
      let rpcOwnerArg = null;

      if (isRpc) {
        const fn = segments[1] ?? "";
        if (
          segments.length !== 2 ||
          !Object.prototype.hasOwnProperty.call(functionConf, fn)
        ) {
          throw new GatewayError(403, "この処理は許可されていません。");
        }
        const conf  = functionConf[fn] ?? {};
        rpcOwnerArg = typeof conf.owner === "string" && conf.owner ? conf.owner : null;

        // 本人の印を入れる関数は、中身を差し替える必要があるため POST だけを通す
        if (rpcOwnerArg && method !== "POST") {
          throw new GatewayError(
            403,
            "この処理はこの呼び出し方では通せません。",
            `${fn} は本人の確認が要るため POST で呼んでください。`,
          );
        }
        targetPath = `rpc/${fn}`;
      } else {
        const table = segments[0];
        if (segments.length !== 1 || !Object.prototype.hasOwnProperty.call(tables, table)) {
          throw new GatewayError(403, "この表には触れません。");
        }
        const conf  = tables[table] ?? {};
        ownerColumn = Object.prototype.hasOwnProperty.call(conf, "owner")
          ? conf.owner            // null を指定したら絞り込みも押印もしない
          : "user_id";
        targetPath  = table;

        // 読み取り専用の表は、取り出す以外の操作をここで断る
        if (conf.readOnly === true && method !== "GET" && method !== "HEAD") {
          throw new GatewayError(403, "この表は読み取り専用です。");
        }

        // 決まった絞り込み（例：使用中の行だけ）
        forceFilter =
          conf.force && typeof conf.force === "object" ? conf.force : null;
      }

      // ── 3. 本人の分だけに絞る ──────────────────────────────────────────
      const params = new URLSearchParams(url.search);

      // 別の表を巻き込んで取り出す書き方は通さない
      for (const value of params.getAll("select")) {
        if (value.includes("(")) {
          throw new GatewayError(403, "この取り出し方は許可されていません。");
        }
      }

      if (ownerColumn && method !== "POST") {
        params.append(ownerColumn, `eq.${uid}`);
      }

      // 決まった絞り込みを足す。画面が同じ列を送ってきても、条件が並ぶと
      // 「両方を満たすもの」になるため、緩められることはない。
      // 新しい行を作るときは絞り込みが効かないので、下で値を押印する。
      if (forceFilter && method !== "POST") {
        for (const [column, condition] of Object.entries(forceFilter)) {
          params.append(column, condition);
        }
      }

      let body;
      if (method === "POST" || method === "PATCH") {
        const raw = await request.text();
        if (isRpc) {
          if (!rpcOwnerArg) {
            body = raw;
          } else {
            // 本人の印を押す。画面が同じ引数を送ってきても、こちらの値で必ず上書きする。
            let parsed;
            try {
              parsed = raw ? JSON.parse(raw) : {};
            } catch {
              throw new GatewayError(400, "送信内容を読み取れませんでした。");
            }
            if (Array.isArray(parsed) || parsed === null || typeof parsed !== "object") {
              throw new GatewayError(400, "この処理の送信内容の形が想定と異なります。");
            }
            body = JSON.stringify({ ...parsed, [rpcOwnerArg]: uid });
          }
        } else {
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            throw new GatewayError(400, "送信内容を読み取れませんでした。");
          }
          const stamp = row => {
            const next = { ...row };
            if (ownerColumn) {
              if (method === "POST") next[ownerColumn] = uid;
              else delete next[ownerColumn];
            }
            if (forceFilter && method === "POST") {
              for (const [column, condition] of Object.entries(forceFilter)) {
                next[column] = forcedInsertValue(column, condition);
              }
            }
            return next;
          };
          body = JSON.stringify(Array.isArray(parsed) ? parsed.map(stamp) : stamp(parsed));

          // 何行もまとめて入れるとき、supabase は「入れる列の一覧」（columns）を行の中身から作って送る。
          // 一覧に無い列は Supabase 側で捨てられて空になるため、押印した列を一覧に足す
          // （2026-10-23 開発部：X分析くんの取り込みで user_id が空になり止まった件）
          if (method === "POST" && params.has("columns")) {
            const listed = params.get("columns").split(",").map(c => c.replace(/"/g, "").trim()).filter(Boolean);
            const stamped = [ownerColumn, ...(forceFilter ? Object.keys(forceFilter) : [])].filter(Boolean);
            const add = stamped.filter(c => !listed.includes(c));
            if (add.length) params.set("columns", [...listed, ...add].map(c => `"${c}"`).join(","));
          }
        }
      }

      // ── 4. 管理者キーを付けて転送する ──────────────────────────────────
      const headers = new Headers();
      for (const key of FORWARD_REQUEST_HEADERS) {
        const value = request.headers.get(key);
        if (value) headers.set(key, value);
      }
      headers.set("apikey", serviceKey);
      if (/^eyJ/.test(String(serviceKey || ""))) headers.set("Authorization", `Bearer ${serviceKey}`); // 新しい鍵（sb_）は apikey だけで送る
      if (body !== undefined && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }

      const query    = params.toString();
      const upstream = await fetch(
        `${supabaseUrl}/rest/v1/${targetPath}${query ? `?${query}` : ""}`,
        { method, headers, body },
      );

      const responseHeaders = new Headers({ "Cache-Control": "no-store" });
      for (const key of ["content-type", "content-range", "content-location"]) {
        const value = upstream.headers.get(key);
        if (value) responseHeaders.set(key, value);
      }

      return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/**
 * 診断用。設定が揃っているか・ログイン確認の材料を取得できるかだけを返す。
 * 値そのものは返さない（認証の外側に置く画面に値を出さないため）。
 */
export async function checkDbGateway(env) {
  const missing = [];
  if (!(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!(env.FIREBASE_PROJECT_ID ?? env.VITE_FIREBASE_PROJECT_ID)) missing.push("FIREBASE_PROJECT_ID");

  if (missing.length) {
    return { ok: false, detail: `設定が足りません：${missing.join(" / ")}` };
  }
  try {
    const keys = await loadJwks();
    if (!keys.length) return { ok: false, detail: "ログイン確認用の情報が空でした" };
    return { ok: true, detail: "設定あり・ログイン確認の準備も可能" };
  } catch (err) {
    return { ok: false, detail: `ログイン確認の準備ができません：${err.message}` };
  }
}

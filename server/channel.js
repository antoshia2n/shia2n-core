/**
 * 版の出し分け（2026-11-04 開発部・Naoki 承認）
 *
 *   シアニン用：いちばん新しい版。結合したらすぐ変わる。印（クッキー lab_ch=next）がある人だけ
 *   生徒用　　：public/stable/ に取っておいた写し。tools/release-stable.mjs で写して結合したときだけ変わる
 *
 * 印は shia2n.jp の下の全部の住所で共通（Domain=shia2n.jp）。どのアプリでも ?ch=next を 1 回開けば、
 * 全部のアプリがシアニン用になる（端末ごと）。?ch=stable で外れる。
 * 印は「画面の版」を選ぶだけで、見られる中身（権限）は変えない。表と API は両方の版で共通なので、
 * 表と API は「足すだけ」にする（消す・名前を変えると生徒用の画面が壊れる）。
 */
export const CH_COOKIE = "lab_ch";
export const STABLE_PATH = "/stable/";

export function isNext(cookie) {
  return new RegExp(`(?:^|;\\s*)${CH_COOKIE}=next(?:;|$)`).test(String(cookie || ""));
}

/** 画面そのもの（HTML）を取りに来た要求か。部品・API・写しの中身は対象にしない */
export function isPageRequest(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const p = url.pathname;
  if (p.startsWith("/api/") || p === "/api" || p.startsWith(STABLE_PATH)) return false;
  const last = p.split("/").pop() || "";
  if (/\.[a-z0-9]+$/i.test(last) && !/\.html?$/i.test(last)) return false;
  const dest = request.headers.get("sec-fetch-dest");
  if (dest) return dest === "document";
  return (request.headers.get("accept") || "").includes("text/html");
}

/** 印のクッキー。shia2n.jp の下なら全部の住所で共通にする */
export function channelCookie(host, value) {
  const h = String(host || "").toLowerCase().replace(/:\d+$/, "");
  const dom = h === "shia2n.jp" || h.endsWith(".shia2n.jp") ? "; Domain=shia2n.jp" : "";
  return value === "next"
    ? `${CH_COOKIE}=next; Path=/; Max-Age=31536000; Secure; SameSite=Lax${dom}`
    : `${CH_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax${dom}`;
}

/**
 * 画面の要求なら版を選んで返す。対象外・シアニン用のときは null（いつもどおり進める）。
 * fetchAsset は Request を受けて静的ファイルを返す関数（env.ASSETS.fetch を渡す）
 */
export async function serveChannel(request, fetchAsset) {
  const url = new URL(request.url);
  const q = url.searchParams.get("ch");
  if (q === "next" || q === "stable") {
    url.searchParams.delete("ch");
    return new Response(null, {
      status: 302,
      headers: { location: url.pathname + url.search + url.hash, "set-cookie": channelCookie(url.host, q), "cache-control": "no-store" },
    });
  }
  if (!isPageRequest(request, url)) return null;
  if (isNext(request.headers.get("cookie"))) return null;
  const r = await fetchAsset(new Request(new URL(STABLE_PATH, url), request));
  if (!r.ok) return null; // 写しがまだ無いときは最新を出す（止めない）
  const out = new Response(r.body, r);
  out.headers.set("cache-control", "no-cache");
  out.headers.set("x-lab-channel", "stable");
  return out;
}

/** Cloudflare Pages の functions/_middleware.js にそのまま渡す形 */
export async function onRequestChannel(context) {
  const r = await serveChannel(context.request, (req) => context.env.ASSETS.fetch(req));
  return r || context.next();
}

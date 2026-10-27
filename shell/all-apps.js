/**
 * 管理者の「アプリ一覧」に出す全アプリの名簿と、最近開いた順の記録（2026-10-27 開発部・Naoki 16:42「右上から全アプリを開けるようにしたい。順番は使用履歴順で」）。
 *
 * 名簿は管理者だけに効く。会員の一覧は今までどおりポータルの設定（Firestore の apps）と appListedFor だけで決める。
 * 出どころ：Systems DB の稼働中・開発中（2026-10-27 統括が引いた表を設計図の表 C に写したもの）。マーケくんの旧の行（marke.shia2n.jp）と、
 * 画面の無い裏方・LP は入れない。アプリを足したら、ここに 1 行足す。
 *
 * 最近開いた順は、shia2n.jp の全アプリで共通に読めるクッキー（s2recent）に「住所:開いた時刻」で残す。データベースには書かない。
 * 端末ごと（ブラウザごと）の記録になる。Firebase も画面も読み込まない（この 1 枚だけで試せる）。
 */

export const ALL_APPS = Object.freeze([
  { host: "portal.shia2n.jp",          name: "ポータル" },
  { host: "manabu.shia2n.jp",          name: "学ぶくん" },
  { host: "evolab.shia2n.jp",          name: "公式サイト（進化ラボ）" },
  { host: "lab.shia2n.jp",             name: "マーケくん" },
  { host: "swipe.shia2n.jp",           name: "スワイプくん" },
  { host: "mindmap.shia2n.jp",         name: "思考整理くん" },
  { host: "content-os.shia2n.jp",      name: "コンテンツくん" },
  { host: "haaku.shia2n.jp",           name: "haAku" },
  { host: "taskmaster.shia2n.jp",      name: "TaskMaster" },
  { host: "anken.shia2n.jp",           name: "案件くん" },
  { host: "note-koryaku.shia2n.jp",    name: "note攻略くん" },
  { host: "x-koryaku.shia2n.jp",       name: "X攻略くん" },
  { host: "members.shia2n.jp",         name: "会員管理くん" },
  { host: "shiarabo-admin.shia2n.jp",  name: "しあらぼ管理" },
  { host: "sales-manager.shia2n.jp",   name: "売上管理" },
  { host: "okane.shia2n.jp",           name: "お金を守るくん" },
  { host: "pay-kun.shia2n.jp",         name: "Pay-kun" },
  { host: "consult-manager.shia2n.jp", name: "個別相談管理" },
  { host: "kiroku.shia2n.jp",          name: "記録くん" },
  { host: "zeus.shia2n.jp",            name: "Zeus" },
  { host: "asset-os.shia2n.jp",        name: "AssetOS" },
  { host: "appdev-kun.pages.dev",      name: "appdev-kun" },
  { host: "fm-ore.pages.dev",          name: "FMオレ" },
]);

export const RECENT_COOKIE = "s2recent";
const MAX_RECENT = 40;
const HOST_RE = /^[a-z0-9.-]{1,80}$/;

/** クッキーの値 "host:秒(36進),host:秒" → { host: ミリ秒 }。壊れた欄は飛ばす */
export function parseRecent(raw) {
  const out = {};
  String(raw ?? "").split(",").forEach((part) => {
    const i = part.lastIndexOf(":");
    if (i <= 0) return;
    const host = part.slice(0, i).trim().toLowerCase();
    const sec = parseInt(part.slice(i + 1), 36);
    if (HOST_RE.test(host) && Number.isFinite(sec) && sec > 0) out[host] = Math.max(out[host] || 0, sec * 1000);
  });
  return out;
}

/** { host: ミリ秒 } → クッキーの値。新しい順に MAX_RECENT 件まで */
export function formatRecent(map) {
  return Object.entries(map || {})
    .filter(([host, ms]) => HOST_RE.test(host) && ms > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_RECENT)
    .map(([host, ms]) => host + ":" + Math.floor(ms / 1000).toString(36))
    .join(",");
}

/** 新しく開いた順。開いたことが無いものは後ろに名前順。items は { host, name } を持つ */
export function sortByRecent(items, recent) {
  const r = recent || {};
  return items.slice().sort((x, y) => {
    const a = r[x.host] || 0, b = r[y.host] || 0;
    if (a !== b) return b - a;
    return String(x.name).localeCompare(String(y.name), "ja");
  });
}

/* ---- ブラウザのクッキー（試験では doc を差し替える） ---- */
const domainFor = (hostname) => (/(^|\.)shia2n\.jp$/i.test(hostname || "") ? "; domain=.shia2n.jp" : "");

export function readRecent(doc = globalThis.document) {
  try {
    const m = String(doc?.cookie || "").match(new RegExp("(?:^|;\\s*)" + RECENT_COOKIE + "=([^;]*)"));
    return parseRecent(m ? decodeURIComponent(m[1]) : "");
  } catch { return {}; }
}

/** その住所を「いま開いた」として残す。保存できない環境でも画面は止めない */
export function touchRecent(host, { doc = globalThis.document, now = Date.now(), hostname = globalThis.location?.hostname } = {}) {
  const h = String(host || "").toLowerCase();
  if (!HOST_RE.test(h)) return;
  try {
    const map = readRecent(doc);
    map[h] = now;
    doc.cookie = RECENT_COOKIE + "=" + encodeURIComponent(formatRecent(map)) + "; path=/; max-age=31536000; SameSite=Lax; Secure" + domainFor(hostname);
  } catch { /* クッキーを止めたブラウザでも動かす */ }
}

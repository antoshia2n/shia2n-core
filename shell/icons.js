/**
 * シアニンのアプリのアイコン（形の正本：開発部のプロジェクト資料 claude/icon-rules.md と make_icons.py）。
 * ここは「アプリ一覧」でほかのアプリを見分けるための写し。地の色と絵は icon-rules.md の表と同じ値にする。
 * 住所（ホスト名）で引く。表に無いアプリは灰色の地だけ（文字は載せない決まり）。
 */
export const APP_ICONS = {
  "swipe.shia2n.jp":         { name: "スワイプくん",   color: "#2563eb", g: '<path d="M6 3.5h12v17l-6-4.2-6 4.2z"/><path d="M9.5 8.5h5M9.5 12h5"/>' },
  "mindmap.shia2n.jp":       { name: "思考整理くん",   color: "#7c3aed", g: '<circle cx="12" cy="12" r="2.6"/><circle cx="4.8" cy="5.5" r="1.9"/><circle cx="19.2" cy="5.5" r="1.9"/><circle cx="19.2" cy="18.5" r="1.9"/><path d="M10.1 10.3 6.2 6.9M13.9 10.3l3.9-3.4M13.9 13.7l3.9 3.4"/>' },
  "content-os.shia2n.jp":    { name: "コンテンツくん", color: "#ea580c", g: '<path d="M4.5 19.5h4l10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16.5z"/><path d="M14 7.5l3 3"/>' },
  "taskmaster.shia2n.jp":    { name: "TaskMaster",     color: "#334155", g: '<path d="M4 6.5l2 2 3.5-3.5M4 14.5l2 2 3.5-3.5"/><path d="M13 7.5h7M13 15.5h7"/>' },
  "shiarabo-admin.shia2n.jp":{ name: "しあらぼ管理",   color: "#0d9488", g: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"/><circle cx="17" cy="9.5" r="2.3"/><path d="M16.5 14.2c2.5.2 4.2 2.4 4.2 5"/>' },
  "asset-os.shia2n.jp":      { name: "AssetOS",        color: "#b45309", g: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.5l2 2h7.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>' },
  "x-koryaku.shia2n.jp":     { name: "X攻略くん",      color: "#4d7c0f", g: '<path d="M4 19.5h16"/><path d="M5 15.5l4.5-5 3.5 3 6-7"/><circle cx="19" cy="6.5" r="1.4"/>' },
  "lab.shia2n.jp":           { name: "マーケくん",     color: "#c026d3", g: '<path d="M3.5 10v4a1 1 0 0 0 1 1H7l10 4.5v-15L7 9H4.5a1 1 0 0 0-1 1z"/><path d="M7.5 15l1.3 4.5h2.4l-1-3.6"/><path d="M20.5 10.2v3.6"/>' },
  "haaku.shia2n.jp":         { name: "haAku",          color: "#0284c7", g: '<path d="M3.8 16.5a8.2 8.2 0 0 1 16.4 0"/><path d="M12 16.5l4-5"/><circle cx="12" cy="16.5" r="1.4"/><path d="M3.5 20h17"/>' },
  "kiroku.shia2n.jp":        { name: "記録くん",       color: "#4338ca", g: '<rect x="5" y="4" width="14" height="16.5" rx="2"/><path d="M8.5 2.8v3M15.5 2.8v3M8.5 10.5h7M8.5 14h7M8.5 17.5h4"/>' },
  "sales-manager.shia2n.jp": { name: "売上管理",       color: "#ca8a04", g: '<circle cx="12" cy="12" r="8.5"/><path d="M8.8 7.2 12 11.5l3.2-4.3M12 11.5v6M9.2 12.8h5.6M9.2 15.5h5.6"/>' },
  "note-koryaku.shia2n.jp":  { name: "note攻略くん",   color: "#9f1239", g: '<path d="M6 3.5h8.5L18 7v13.5H6z"/><path d="M14.5 3.5V7H18"/><path d="M12 18c-2.6-1.7-4.2-3.2-4.2-4.9a2.1 2.1 0 0 1 4.2-.5 2.1 2.1 0 0 1 4.2.5c0 1.7-1.6 3.2-4.2 4.9z"/>' },
};

const LEAF = "M44 0H114A14 14 0 0 1 128 14V84A44 44 0 0 1 84 128H14A14 14 0 0 1 0 114V44A44 44 0 0 1 44 0Z";
const WAVE = "M0 128V58C34 58 40 82 64 82S94 104 128 104V128Z";
let seq = 0;

/** 住所（https:// が無くてもよい）からホスト名だけを取る */
export function hostOf(url) {
  let u = String(url ?? "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { return new URL(u).hostname.toLowerCase(); } catch { return ""; }
}

/** 小さい版（24px 以下）のアイコンの SVG。make_icons.py の icon(small=True) と同じ形 */
export function iconSvg(host, px = 24) {
  const a = APP_ICONS[host];
  const col = a ? a.color : "#a8a09a";
  const id = "s2i" + (++seq);
  const op = col === "#334155" ? 0.30 : 0.22;
  const bite = '<circle cx="132" cy="40" r="19"/><circle cx="-4" cy="90" r="19"/>';
  const glyph = a ? `<g transform="translate(14 14) scale(4.17)" fill="none" stroke="#fff" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round">${a.g}</g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 128 128" aria-hidden="true">`
    + `<defs><clipPath id="${id}c"><path d="${LEAF}"/></clipPath><mask id="${id}m"><rect width="128" height="128" fill="#fff"/><g fill="#000">${bite}</g></mask></defs>`
    + `<g mask="url(#${id}m)"><g clip-path="url(#${id}c)"><rect width="128" height="128" fill="${col}"/><path d="${WAVE}" fill="#000" fill-opacity="${op}"/></g>${glyph}</g></svg>`;
}

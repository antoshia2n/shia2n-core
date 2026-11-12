/**
 * 攻略の段（2026-11-12 開発部・1 本目は note攻略くん）
 * X攻略くんで Naoki が OK した形（x-koryaku #37〜#46・app-design-rules 4b）を、ほかのアプリでも同じ部品で出すためのもの。
 *   上の帯の段の番号（決めることが全部済んだ段は ✓）・段の頭（この段で何をするか・受け取る／渡す・決めること）・
 *   「シンプル｜全機能」の切り替えと「ほかのカード（n）を見る ▼」のたたみ。
 * ここが持つのは見た目と HTML の形だけ。何を決めるか・決めたかどうか・押したらどこへ行くかは各アプリが持つ。
 * 押したときは data-act の名前でアプリへ戻す（アプリのクリックの受け口で拾う）：
 *   s2step（data-id＝段のキー）・s2dec（data-id＝決めることのキー）・s2mode（data-id＝simple｜all）・s2more（data-id＝たたみのキー、data-v＝1 開く｜0 たたむ）
 * 「？」はアプリの qh を渡す（文の正本はアプリの guide.js）。
 */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NUM = "①②③④⑤⑥⑦⑧⑨⑩";

/* ── シンプル｜全機能（選んだほうはアプリごとにブラウザへ覚える。はじめての人はシンプル） ── */
export function isSimple(app) {
  try { return (localStorage.getItem(`s2view:${app}`) || "simple") === "simple"; } catch { return true; }
}
export function setViewMode(app, mode) {
  try { localStorage.setItem(`s2view:${app}`, mode === "all" ? "all" : "simple"); } catch { /* 覚えられなくても、この画面の中では切り替わる */ }
}
export function modeToggle(app) {
  const s = isSimple(app);
  return `<div class="s2-vm" role="group" aria-label="表示の量"><button type="button" data-act="s2mode" data-id="simple" class="${s ? "on" : ""}" aria-pressed="${s}">シンプル</button><button type="button" data-act="s2mode" data-id="all" class="${s ? "" : "on"}" aria-pressed="${!s}">全機能</button></div>`;
}
/**
 * シンプルのとき、いま使うカード（main）だけを出し、ほか（rest）はたたむ。全機能では全部。
 * open はそのたたみを開いているか（アプリが持つ）
 */
export function folded(app, key, main, rest, open) {
  const R = (rest || []).filter(Boolean), M = (main || []).filter(Boolean).join("");
  if (!R.length || !isSimple(app)) return M + R.join("");
  return open
    ? M + R.join("") + `<button type="button" class="s2-more" data-act="s2more" data-id="${esc(key)}" data-v="0">たたむ ▲</button>`
    : M + `<button type="button" class="s2-more" data-act="s2more" data-id="${esc(key)}" data-v="1" aria-expanded="false">ほかのカード（${R.length}）を見る ▼</button>`;
}

/* ── 上の帯：ホーム＋段の番号 ── */
/**
 * steps: [[key, 名前]]、cur: 今いる段のキー（"home" でホーム）、done(key): 決めることが全部済んだか、home: ホームの名前（省くとホームを出さない）
 * badge: { [key]: 数 } 段の横の赤い数（漏れだけ）
 */
export function stepTabs({ steps, cur, done = () => false, home = "ホーム", badge = {} }) {
  const b = (k) => (badge[k] ? `<span class="s2-badge" aria-hidden="true">${badge[k]}</span>` : "");
  const lab = (k, l) => (badge[k] ? ` aria-label="${esc(l)}（残り ${badge[k]}）"` : "");
  return (home ? `<button type="button" class="${cur === "home" ? "on" : ""}" data-act="s2step" data-id="home"${lab("home", home)}>${esc(home)}${b("home")}</button><span class="s2-sep" aria-hidden="true"></span>` : "")
    + steps.map(([k, l], i) => { const ok = done(k); return `<button type="button" class="s2-stp ${cur === k ? "on" : ""}" data-act="s2step" data-id="${esc(k)}"${ok ? ` aria-label="${i + 1}. ${esc(l)}（決めることは全部済み）"` : lab(k, `${i + 1}. ${l}`)}><span class="s2-n ${ok ? "ok" : ""}" aria-hidden="true">${ok ? "✓" : i + 1}</span>${esc(l)}${b(k)}</button>`; }).join("");
}

/* ── 段の頭：1 枚（題・この段で何をするか・← 受け取る｜渡す → ・決めること） ── */
/**
 * steps: [[key, 名前]]、key: この段、io: [受け取る, この段で何をするか, 渡す]
 * decides: [[名前, 済んだか, 移るキー]]（空なら決めることの行を出さない）、qh(key): 「？」の HTML を返す関数
 * next: 渡す先の段のキー（省くと次の段）
 */
export function stepHead({ steps, key, io, decides = [], qh = () => "", next }) {
  const i = steps.findIndex((s) => s[0] === key); if (i < 0) return "";
  const [a, m, b] = io, pv = steps[i - 1], nx = next || (steps[i + 1] || steps[0])[0];
  const d = decides.filter((x) => x[1]).length, n = decides.length;
  const dec = n ? `<div class="s2-dcd" aria-label="この段で決めること"><div class="s2-dcd-r">${ring(d, n)}<div><b>決めること ${d}/${n}</b>${qh("decide")}<div class="s2-sub">${d === n ? "全部決まった。次の段へ" : "○ を押すと、その場所へ移動"}</div></div></div>`
    + `<div class="s2-dcd-l">${decides.map(([l, ok, k]) => ok ? `<span class="s2-dc ok">✓ ${esc(l)}</span>` : `<button type="button" class="s2-dc" data-act="s2dec" data-id="${esc(k)}">○ ${esc(l)}</button>`).join("")}</div></div>` : "";
  return `<section class="s2-sh"><div class="s2-sh-t"><div class="s2-sh-m"><b>${NUM[i] || i + 1}${esc(steps[i][1])}${qh("s_" + key)}</b><span>${esc(m)}</span></div>`
    + `<div class="s2-sh-io">${pv ? `<button type="button" class="s2-sio" data-act="s2step" data-id="${esc(pv[0])}" title="前の段へ移動">← ${esc(a)}</button>` : `<span class="s2-sio off">${esc(a)}</span>`}`
    + `<button type="button" class="s2-sio nx" data-act="s2step" data-id="${esc(nx)}" title="次の段へ移動">${esc(b)} →</button>${qh("io")}</div></div>${dec}</section>`;
}
function ring(d, t, sz = 34) {
  const r = sz / 2 - 5, c = 2 * Math.PI * r, f = t ? d / t : 0;
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" aria-hidden="true"><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="var(--line,#e6dfd6)" stroke-width="5"/><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="${t && d === t ? "var(--ok,#047857)" : "var(--accent-ink,#b45309)"}" stroke-width="5" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${sz / 2} ${sz / 2})" stroke-linecap="round"/></svg>`;
}

/* ── ホームの一番上：攻略の流れ（押すとその段へ。閉じたら次から出さない） ── */
export function introShown(app) { try { return localStorage.getItem(`s2intro:${app}`) !== "0"; } catch { return true; } }
export function hideIntro(app) { try { localStorage.setItem(`s2intro:${app}`, "0"); } catch { /* この画面の中では閉じる */ } }
export function flowCard({ steps, io, done = () => false, title = "攻略の流れ", sub = "", qh = () => "" }) {
  return `<section class="s2-flowc"><div class="s2-flow-h"><b>${esc(title)}</b>${qh("intro")}<span class="s2-sub">${esc(sub)}</span><span class="s2-grow"></span><button type="button" class="s2-lnk" data-act="s2intro" data-id="off">閉じる</button></div>`
    + `<ol class="s2-flow">${steps.map(([k, l], i) => { const ok = done(k); return `<li><button type="button" data-act="s2step" data-id="${esc(k)}"><span class="s2-n ${ok ? "ok" : ""}" aria-hidden="true">${ok ? "✓" : i + 1}</span><b>${esc(l)}</b><small>${esc((io[k] || [])[1] || "")}</small></button></li>`; }).join("")}</ol></section>`;
}

export const STAGES_CSS = `
.s2-sep{width:1px;background:var(--line,#e6dfd6);margin:12px 4px;flex:none;align-self:stretch}
.s2-stp{display:inline-flex;align-items:center;gap:5px}
.s2-n{font-size:12px;font-weight:800;width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;background:var(--soft,#f7f3ee);color:var(--muted,#6b6259);flex:none;line-height:1}
.on>.s2-n{background:#b45309;color:#fff}
.s2-n.ok{background:var(--ok-bg,rgba(4,120,87,.12));color:var(--ok,#047857)}
.s2-badge{margin-left:4px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#b91c1c;color:#fff;font-size:12px;font-weight:800;display:inline-grid;place-items:center;line-height:1}
.s2-vm{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--line,#e6dfd6);border-radius:9px;background:var(--soft,#f7f3ee);flex:none}
.s2-vm button{font:700 12.5px/1.4 "Geist","Noto Sans JP",system-ui,sans-serif;padding:4px 10px;border-radius:7px;color:var(--muted,#6b6259);border:0;background:transparent;cursor:pointer}
.s2-vm button.on{background:var(--panel,#fff);color:var(--fg,#1a1a1a);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.s2-more{display:block;width:100%;padding:10px;border:1px dashed var(--field,#a39a90);border-radius:10px;background:transparent;color:var(--muted,#6b6259);font:700 13px/1.5 "Geist","Noto Sans JP",system-ui,sans-serif;text-align:center;cursor:pointer}
.s2-more:hover{border-color:var(--accent-ink,#b45309);color:var(--accent-ink,#b45309);background:var(--accent-bg,#fef3c7)}
.s2-sh{background:var(--panel,#fff);border:1px solid var(--line,#e6dfd6);border-radius:12px;display:flex;flex-direction:column}
.s2-sh-t{display:flex;align-items:center;gap:12px;padding:10px 14px;flex-wrap:wrap}
.s2-sh-m{flex:1;min-width:220px;display:flex;flex-direction:column;gap:1px}
.s2-sh-m b{font-size:15px;font-weight:800;display:flex;align-items:center}
.s2-sh-m span{font-size:13px;color:var(--muted,#6b6259);line-height:1.55}
.s2-sh-io{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.s2-sio{font:600 12.5px/1.5 "Geist","Noto Sans JP",system-ui,sans-serif;color:var(--muted,#6b6259);border:1px solid var(--line,#e6dfd6);border-radius:8px;padding:5px 10px;background:var(--panel,#fff);text-align:left;cursor:pointer}
button.s2-sio:hover{border-color:var(--accent-ink,#b45309);color:var(--fg,#1a1a1a)}
.s2-sio.nx{color:var(--accent-ink,#b45309);border-color:var(--accent-ink,#b45309)}
.s2-sio.off{opacity:.75;cursor:default}
.s2-dcd{display:flex;gap:14px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line,#e6dfd6);padding:8px 14px}
.s2-dcd-r{display:flex;gap:10px;align-items:center;min-width:200px}
.s2-dcd-r b{font-size:13.5px;display:inline-flex;align-items:center}
.s2-sub{font-size:12px;color:var(--faint,#736a62)}
.s2-dcd-l{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.s2-dc{font:700 12.5px/1.5 "Geist","Noto Sans JP",system-ui,sans-serif;padding:5px 10px;border-radius:99px;border:1px dashed var(--accent-ink,#b45309);color:var(--accent-ink,#b45309);background:var(--panel,#fff);cursor:pointer}
button.s2-dc:hover{background:var(--accent-bg,#fef3c7)}
.s2-dc.ok{border:1px solid transparent;background:var(--ok-bg,rgba(4,120,87,.12));color:var(--ok,#047857);cursor:default}
.s2-flowc{background:var(--panel,#fff);border:1px solid var(--line,#e6dfd6);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.s2-flow-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.s2-flow-h b{font-size:14px;font-weight:800}
.s2-grow{flex:1}
.s2-lnk{border:0;background:none;color:var(--accent-ink,#b45309);font:700 12.5px/1.5 "Geist","Noto Sans JP",system-ui,sans-serif;cursor:pointer;padding:6px 2px}
.s2-flow{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.s2-flow button{width:100%;height:100%;display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:2px;align-items:center;text-align:left;padding:10px;border:1px solid var(--line,#e6dfd6);border-radius:10px;background:var(--panel,#fff);cursor:pointer;color:var(--fg,#1a1a1a);font:400 13px/1.5 "Geist","Noto Sans JP",system-ui,sans-serif}
.s2-flow button:hover{border-color:var(--accent-ink,#b45309);background:var(--accent-bg,#fef3c7)}
.s2-flow .s2-n{width:24px;height:24px}
.s2-flow b{font-size:13.5px}
.s2-flow small{grid-column:1/-1;font-size:12px;color:var(--muted,#6b6259);line-height:1.5}
@media (max-width:900px){.s2-flow{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.s2-vm button{padding:4px 7px;font-size:12px}.s2-dcd-r{min-width:0}}
@media (pointer:coarse){.s2-dc,.s2-sio,.s2-vm button{min-height:44px}.s2-lnk{min-height:44px}}
`;
let cssDone = false;
export function ensureStagesCss() {
  if (cssDone || typeof document === "undefined") return;
  cssDone = true;
  const s = document.createElement("style"); s.dataset.s2 = "stages"; s.textContent = STAGES_CSS; document.head.append(s);
}

/**
 * ガイドあり・なし（2026-11-08 開発部・1 本目はコンテンツくん。Naoki がデモに OK）
 * デモ：https://claude.ai/artifact/F1NaUJHRL66FfdHyaiuj3s
 *
 * 目的の状態：どのアプリでも、開いた画面で「ここで何ができるか」が説明を読まずに分かる。
 *   右上の「ガイド」（外枠の mountAppShell に cfg.guide: true を渡すと出る）を「あり」にすると、
 *   各アプリが画面の上に「この画面でできること」の帯と、帯と同じ番号の丸（押す場所）を出す。
 *   はじめて開いた人は「あり」。選んだ形はアプリの住所ごとにブラウザへ覚える。
 *
 * ここが持つのは「あり・なし」の状態と、帯・丸の見た目だけ。帯の文と丸を置く場所は各アプリが持つ
 * （画面ごとの文の正本はアプリのマニュアルの 1 か所）。
 *
 * 使い方
 *   素の JS：guideBand([[題, 説明], …]) で帯の要素、guidePin(n) で丸の要素を作り、onGuide(fn) で描き直す
 *   React：const on = useSyncExternalStore(onGuide, guideOn); で読み、className は下の GUIDE_CSS と同じ名前を使う
 */
const KEY = "s2shell:guide";
const EVT = "s2:guide";

export function guideOn() {
  try { const v = localStorage.getItem(KEY); return v == null ? true : v === "1"; } catch { return true; }
}
export function setGuide(on) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* 覚えられなくても、この画面の中では切り替わる */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: !!on }));
}
/** 切り替わったら fn を呼ぶ。戻り値は外す関数（React の useSyncExternalStore にそのまま渡せる） */
export function onGuide(fn) {
  const a = () => fn(guideOn());
  const b = (e) => { if (e.key === KEY) fn(guideOn()); }; // ほかのタブで切り替えたとき
  window.addEventListener(EVT, a); window.addEventListener("storage", b);
  return () => { window.removeEventListener(EVT, a); window.removeEventListener("storage", b); };
}

export const GUIDE_CSS = `
.s2-gband{background:var(--panel,#fff);border:1px solid var(--line,#e6dfd6);border-left:4px solid #b45309;border-radius:12px;padding:10px 14px 12px 12px;margin:0 0 14px;color:var(--fg,#1a1a1a);font-size:13px}
.s2-gbh{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.s2-gtag{font-size:12px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:6px;padding:0 6px}
.s2-goff{margin-left:auto;font:inherit;font-size:12px;font-weight:600;color:var(--muted,#6b6259);text-decoration:underline;background:none;border:0;cursor:pointer;min-height:28px}
.s2-gband ol{list-style:none;margin:0;padding:0;display:grid;gap:3px}
.s2-gband li button{display:flex;gap:10px;align-items:baseline;text-align:left;background:none;border:0;cursor:pointer;font:inherit;font-size:13px;color:inherit;padding:2px 4px;margin:0 -4px;border-radius:6px;line-height:1.55}
.s2-gband li button:hover{background:var(--soft,#f7f3ee)}
.s2-gd{font-size:12px;color:var(--muted,#6b6259);margin-left:10px}
.s2-gpin{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#b45309;color:#fff;font-size:12px;font-weight:800;line-height:1;flex:none;vertical-align:middle;font-style:normal}
.s2-gpin[data-gpin]{margin-right:6px}
.s2-gpulse{animation:s2gp 1.1s ease-out 2}
@keyframes s2gp{0%{box-shadow:0 0 0 0 rgba(180,83,9,.55)}100%{box-shadow:0 0 0 12px rgba(180,83,9,0)}}
@media (prefers-reduced-motion:reduce){.s2-gpulse{animation:none;outline:3px solid #b45309;outline-offset:2px}}
.s2-gcap{font-size:12px;color:var(--faint,#736a62);padding:0 10px 6px;line-height:1.5}
@media (max-width:860px){.s2-gd{display:block;margin-left:0}}
`;
let cssDone = false;
/** 帯と丸の見た目をページに 1 回だけ入れる（guideBand・guidePin は自分で呼ぶ。React のアプリは最初に 1 回呼ぶ） */
export function ensureGuideCss() {
  if (cssDone || typeof document === "undefined") return;
  cssDone = true;
  const s = document.createElement("style"); s.dataset.s2 = "guide"; s.textContent = GUIDE_CSS; document.head.appendChild(s);
}

/** 画面の中の同じ番号の丸へ動いて光らせる（帯の行を押したとき） */
export function showPin(n, root = document) {
  const el = root.querySelector(`[data-gpin="${n}"]`);
  if (!el) return;
  let still = false; try { still = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* 既定は動かす */ }
  el.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  el.classList.remove("s2-gpulse"); void el.offsetWidth; el.classList.add("s2-gpulse");
}

const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** 番号の丸。読み上げは帯の文で足りるので、丸は読ませない */
export function guidePin(n) {
  ensureGuideCss();
  const s = mk("span", "s2-gpin", String(n)); s.dataset.gpin = String(n); s.setAttribute("aria-hidden", "true"); return s;
}

/** 「この画面でできること」の帯。items は [[題, 説明], …]（3 つまで） */
export function guideBand(items) {
  ensureGuideCss();
  const sec = mk("section", "s2-gband"); sec.setAttribute("aria-label", "この画面でできること");
  const hd = mk("div", "s2-gbh"); const b = mk("b", null, "この画面でできること"); const tag = mk("span", "s2-gtag", "ガイド");
  const off = mk("button", "s2-goff", "ガイドをなしにする"); off.type = "button";
  off.addEventListener("click", () => { setGuide(false); document.querySelector(".s2-shell")?.shadowRoot?.querySelector(".gsw")?.focus(); });
  hd.append(b, tag, off);
  const ol = mk("ol");
  (items || []).slice(0, 3).forEach(([t, d], i) => {
    const li = mk("li"); const bt = mk("button"); bt.type = "button"; bt.title = "画面の中の同じ番号を光らせる";
    const pin = mk("span", "s2-gpin", String(i + 1)); const tx = mk("span"); tx.append(mk("b", null, t), mk("span", "s2-gd", d));
    bt.append(pin, tx); bt.addEventListener("click", () => showPin(i + 1)); li.append(bt); ol.append(li);
  });
  sec.append(hd, ol);
  return sec;
}

/**
 * ガイドあり・なし（2026-11-08 開発部・1 本目はコンテンツくん）
 * デモ：https://claude.ai/artifact/F1NaUJHRL66FfdHyaiuj3s
 *   v1（画面の上の帯と番号の丸）に OK 14:15 → Naoki「ガイドの主張が強い。各アイテムに『？』やポップアップで」→ v2 に OK 15:00
 *
 * 目的の状態：どのアプリでも、開いた画面で「ここで何ができるか」が説明を読まずに分かる。ただし書く画面の邪魔をしない。
 *   右上の「ガイド」（外枠の mountAppShell に cfg.guide: true を渡すと出る）を「あり」にすると、
 *   押す場所の横に小さな「？」が出る。押すと（マウスなら乗せると）題と 1 行の説明の小窓が出る。
 *   はじめて開いた人は「あり」。選んだ形はアプリの住所ごとにブラウザへ覚える。
 *
 * ここが持つのは「あり・なし」の状態と、「？」と小窓の見た目・動きだけ。どこに「？」を置き、何を書くかは各アプリが持つ
 * （文の正本はアプリのマニュアルの 1 か所）。
 *
 * 使い方
 *   素の JS：guideHelp(題, 説明) で「？」の要素を作り、guideOn() が true のときだけ置く。onGuide(fn) で描き直す
 *   React：const on = useSyncExternalStore(onGuide, guideOn);
 *          on && <button className="s2-qh" data-t={題} data-d={説明} aria-label={`${題}とは`}>?</button>
 *          （ensureGuideCss() を 1 回呼ぶと、className が s2-qh のボタンはどこに置いても小窓が出る）
 * 小窓は外を押す・Esc・別の「？」を開く、のどれでも閉じ、Esc で閉じたら押した「？」へ戻る。
 */
const KEY = "s2shell:guide";
const EVT = "s2:guide";

export function guideOn() {
  try { const v = localStorage.getItem(KEY); return v == null ? true : v === "1"; } catch { return true; }
}
export function setGuide(on) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* 覚えられなくても、この画面の中では切り替わる */ }
  closeHelp(false);
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
.s2-qh{display:inline-grid;place-items:center;width:18px;height:18px;padding:0;border-radius:50%;border:1px solid var(--field,#a39a90);background:var(--panel,#fff);color:var(--muted,#6b6259);font:700 12px/1 "Geist","Noto Sans JP",system-ui,sans-serif;cursor:help;flex:none;vertical-align:middle;margin:0 6px;position:relative}
.s2-qh::before{content:"";position:absolute;inset:-8px}
.s2-qh:hover,.s2-qh[aria-expanded="true"]{border-color:#b45309;color:#b45309;background:#fef3c7}
.s2-qh:focus-visible{outline:2px solid #b45309;outline-offset:2px}
@media (pointer:coarse){.s2-qh::before{inset:-13px}}
.s2-qpop{position:fixed;z-index:2147483001;max-width:280px;background:#1f1b17;color:#e6ddd2;border-radius:10px;padding:10px 12px;font:400 13px/1.55 "Geist","Noto Sans JP",system-ui,sans-serif;box-shadow:0 8px 28px rgba(40,28,14,.22);text-align:left}
.s2-qpop b{display:block;font-weight:700;color:#fff;margin-bottom:2px}
.s2-qpop::after{content:"";position:absolute;top:-6px;left:var(--ax,16px);border:6px solid transparent;border-top:0;border-bottom-color:#1f1b17}
.s2-qpop.up::after{top:auto;bottom:-6px;border-bottom:0;border-top:6px solid #1f1b17}
`;

let pop = null, popBtn = null, hoverT = 0, wired = false;
function closeHelp(back) {
  if (!pop) return;
  pop.remove(); pop = null;
  if (popBtn) { popBtn.setAttribute("aria-expanded", "false"); popBtn.removeAttribute("aria-describedby"); delete popBtn.dataset.pinned; if (back) popBtn.focus(); }
  popBtn = null;
}
function openHelp(b) {
  closeHelp(false);
  popBtn = b; b.setAttribute("aria-expanded", "true");
  pop = document.createElement("div"); pop.className = "s2-qpop"; pop.setAttribute("role", "tooltip");
  pop.id = "s2-qpop"; b.setAttribute("aria-describedby", "s2-qpop");
  const t = document.createElement("b"); t.textContent = b.dataset.t || "";
  pop.append(t, document.createTextNode(b.dataset.d || ""));
  document.body.append(pop);
  const r = b.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - 20), innerWidth - w - 8);
  let top = r.bottom + 8;
  if (top + h > innerHeight - 8) { top = Math.max(8, r.top - h - 8); pop.classList.add("up"); }
  pop.style.left = left + "px"; pop.style.top = top + "px";
  pop.style.setProperty("--ax", Math.max(8, r.left + r.width / 2 - left - 6) + "px");
}
const hoverable = () => { try { return matchMedia("(hover:hover)").matches; } catch { return false; } };
function wire() {
  if (wired || typeof document === "undefined") return;
  wired = true;
  document.addEventListener("click", (e) => {
    const q = e.target.closest?.(".s2-qh");
    if (q) {
      e.preventDefault(); e.stopPropagation();
      if (popBtn === q && q.dataset.pinned) { closeHelp(true); return; }
      openHelp(q); q.dataset.pinned = "1"; return;
    }
    if (pop && !e.target.closest?.(".s2-qpop")) closeHelp(false);
  }, true);
  document.addEventListener("mouseover", (e) => {
    const q = e.target.closest?.(".s2-qh"); if (!q || !hoverable()) return;
    clearTimeout(hoverT); hoverT = setTimeout(() => { if (popBtn !== q) openHelp(q); }, 150);
  });
  document.addEventListener("mouseout", (e) => {
    const q = e.target.closest?.(".s2-qh"); if (!q || !hoverable()) return;
    clearTimeout(hoverT); hoverT = setTimeout(() => { if (popBtn === q && !q.dataset.pinned) closeHelp(false); }, 120);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) { e.stopPropagation(); closeHelp(true); } }, true);
  window.addEventListener("scroll", () => closeHelp(false), true);
  window.addEventListener("resize", () => closeHelp(false));
}

let cssDone = false;
/** 「？」と小窓の見た目と動きをページに 1 回だけ入れる（guideHelp は自分で呼ぶ。React のアプリは最初に 1 回呼ぶ） */
export function ensureGuideCss() {
  if (typeof document === "undefined") return;
  wire();
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement("style"); s.dataset.s2 = "guide"; s.textContent = GUIDE_CSS; document.head.appendChild(s);
}

/** 「？」のボタン。押すと（マウスなら乗せると）題と説明の小窓が出る */
export function guideHelp(title, desc) {
  ensureGuideCss();
  const b = document.createElement("button");
  b.type = "button"; b.className = "s2-qh"; b.textContent = "?";
  b.dataset.t = title || ""; b.dataset.d = desc || "";
  b.setAttribute("aria-label", `${title}とは`); b.setAttribute("aria-expanded", "false");
  return b;
}

/**
 * X攻略くんとのやりとり（x-koryaku/x-bunseki-panel/panel.js を写したもの・2026-10-31 統合パネル）。
 * 見ているタブの住所と題名だけを渡す。ページの中身は読まない。
 * やりとりの名前（src: "x-bunseki" ⇄ "x-bunseki-ext"）は元のパネルと同じなので、X攻略くん側は直さない。
 */
(() => {
  const X_ORIGIN = "https://x-koryaku.shia2n.jp";
  const xFrame = () => window.S2P && window.S2P.frameOf("xkoryaku");
  const postX = msg => { const f = xFrame(); if (f && f.contentWindow) f.contentWindow.postMessage({ src: "x-bunseki-ext", ...msg }, X_ORIGIN); };

  // このパネルが付いている窓（窓を 2 つ開いていても、自分の窓のタブだけを見る）
  let myWin = null;
  try { chrome.windows.getCurrent((w) => { myWin = w ? w.id : null; }); } catch { /* 取れなければ前に触った窓を見る */ }

  async function tabInfo() {
    const q = myWin != null ? { active: true, windowId: myWin } : { active: true, lastFocusedWindow: true };
    const [tab] = await chrome.tabs.query(q);
    return tab ? { url: tab.url || "", title: tab.title || "" } : { url: "", title: "" };
  }

  addEventListener("message", async e => {
    const f = xFrame();
    if (e.origin !== X_ORIGIN || !f || e.source !== f.contentWindow) return;
    const m = e.data || {};
    if (m.src !== "x-bunseki" || m.type !== "peek") return;
    try { postX({ type: "reply", id: m.id, ok: true, data: await tabInfo() }); }
    catch (err) { postX({ type: "reply", id: m.id, ok: false, error: String(err?.message || err) }); }
  });

  // 見ているタブや住所が変わったら知らせる（X は画面を切り替えても読み込み直さないので、住所の変化も見る）
  // 知らせるのは X攻略くんを出しているときだけ・自分の窓の見ているタブのときだけ。隠れていた間の分は、出したときに 1 回知らせる
  const mine = (winId) => myWin == null || winId === myWin;
  const notify = () => { if (window.S2P && window.S2P.isShown("xkoryaku")) postX({ type: "tab" }); };
  chrome.tabs.onActivated.addListener((info) => { if (mine(info.windowId)) notify(); });
  chrome.tabs.onUpdated.addListener((_, info, tab) => { if ((info.url || info.status === "complete") && tab && tab.active && mine(tab.windowId)) notify(); });
  chrome.windows.onFocusChanged.addListener((winId) => { if (winId !== chrome.windows.WINDOW_ID_NONE && mine(winId)) notify(); });
  addEventListener("s2p:show", (e) => { if (e.detail === "xkoryaku") notify(); });
})();

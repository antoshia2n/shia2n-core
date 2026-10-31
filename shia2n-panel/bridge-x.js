/**
 * X攻略くんとのやりとり（x-koryaku/x-bunseki-panel/panel.js を写したもの・2026-10-31 統合パネル）。
 * 見ているタブの住所と題名だけを渡す。ページの中身は読まない。
 * やりとりの名前（src: "x-bunseki" ⇄ "x-bunseki-ext"）は元のパネルと同じなので、X攻略くん側は直さない。
 */
(() => {
  const X_ORIGIN = "https://x-koryaku.shia2n.jp";
  const xFrame = () => window.S2P && window.S2P.frameOf("xkoryaku");
  const postX = msg => { const f = xFrame(); if (f && f.contentWindow) f.contentWindow.postMessage({ src: "x-bunseki-ext", ...msg }, X_ORIGIN); };

  async function tabInfo() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
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
  const notify = () => postX({ type: "tab" });
  chrome.tabs.onActivated.addListener(notify);
  chrome.tabs.onUpdated.addListener((_, info) => { if (info.url || info.status === "complete") notify(); });
  chrome.windows.onFocusChanged.addListener(notify);
})();

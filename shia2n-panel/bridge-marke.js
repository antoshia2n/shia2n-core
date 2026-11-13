/**
 * マーケくんとのやりとり（2026-11-13・実績の便 3）。bridge-dokusho.js と同じ形。
 * マーケくんの細い画面（lab.shia2n.jp/panel）に、見ているタブの住所と題名だけを渡す。ページの中身は読まない。
 * マーケくんはそれで X のポストかを見分け、「実績を入れる」の 1 押しで実績の棚へ入れる。
 *   マーケくん → ここ：{ src: "marke", type: "peek", id }
 *   ここ → マーケくん：{ src: "marke-ext", type: "reply", id, ok, data: { url, title } } ・ タブが変わったら { src: "marke-ext", type: "tab" }
 */
(() => {
  const ORIGIN = "https://lab.shia2n.jp";
  const frame = () => window.S2P && window.S2P.frameOf("marke");
  const post = msg => { const f = frame(); if (f && f.contentWindow) f.contentWindow.postMessage({ src: "marke-ext", ...msg }, ORIGIN); };

  // このパネルが付いている窓（窓を 2 つ開いていても、自分の窓のタブだけを見る）
  let myWin = null;
  try { chrome.windows.getCurrent((w) => { myWin = w ? w.id : null; }); } catch { /* 取れなければ前に触った窓を見る */ }

  async function tabInfo() {
    const q = myWin != null ? { active: true, windowId: myWin } : { active: true, lastFocusedWindow: true };
    const [tab] = await chrome.tabs.query(q);
    return tab ? { url: tab.url || "", title: tab.title || "" } : { url: "", title: "" };
  }

  addEventListener("message", async e => {
    const f = frame();
    if (e.origin !== ORIGIN || !f || e.source !== f.contentWindow) return;
    const m = e.data || {};
    if (m.src !== "marke" || m.type !== "peek") return;
    try { post({ type: "reply", id: m.id, ok: true, data: await tabInfo() }); }
    catch (err) { post({ type: "reply", id: m.id, ok: false, error: String(err?.message || err) }); }
  });

  // 見ているタブや住所が変わったら知らせる（マーケくんを出しているときだけ・自分の窓のときだけ。隠れていた間の分は出したときに 1 回）
  const mine = (winId) => myWin == null || winId === myWin;
  const notify = () => { if (window.S2P && window.S2P.isShown("marke")) post({ type: "tab" }); };
  chrome.tabs.onActivated.addListener((info) => { if (mine(info.windowId)) notify(); });
  chrome.tabs.onUpdated.addListener((_, info, tab) => { if ((info.url || info.title || info.status === "complete") && tab && tab.active && mine(tab.windowId)) notify(); });
  chrome.windows.onFocusChanged.addListener((winId) => { if (winId !== chrome.windows.WINDOW_ID_NONE && mine(winId)) notify(); });
  addEventListener("s2p:show", (e) => { if (e.detail === "marke") notify(); });
})();

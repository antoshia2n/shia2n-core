/**
 * 読書くんとのやりとり（2026-11-11）。bridge-x.js と同じ形。
 * 読書くんの細い画面（dokusho.shia2n.jp/panel）に、見ているタブの住所と題名だけを渡す。ページの中身は読まない。
 * 読書くんはそれで Amazon の本のページかを見分け、本を 1 冊に決める（Amazon なら「読みたいに入れる」・それ以外は本棚を探す）。
 *   読書くん → ここ：{ src: "dokusho", type: "peek", id }
 *   ここ → 読書くん：{ src: "dokusho-ext", type: "reply", id, ok, data: { url, title } } ・ タブが変わったら { src: "dokusho-ext", type: "tab" }
 */
(() => {
  const ORIGIN = "https://dokusho.shia2n.jp";
  const frame = () => window.S2P && window.S2P.frameOf("dokusho");
  const post = msg => { const f = frame(); if (f && f.contentWindow) f.contentWindow.postMessage({ src: "dokusho-ext", ...msg }, ORIGIN); };

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
    if (m.src !== "dokusho" || m.type !== "peek") return;
    try { post({ type: "reply", id: m.id, ok: true, data: await tabInfo() }); }
    catch (err) { post({ type: "reply", id: m.id, ok: false, error: String(err?.message || err) }); }
  });

  // 見ているタブや住所が変わったら知らせる（読書くんを出しているときだけ・自分の窓のときだけ。隠れていた間の分は出したときに 1 回）
  const mine = (winId) => myWin == null || winId === myWin;
  const notify = () => { if (window.S2P && window.S2P.isShown("dokusho")) post({ type: "tab" }); };
  chrome.tabs.onActivated.addListener((info) => { if (mine(info.windowId)) notify(); });
  chrome.tabs.onUpdated.addListener((_, info, tab) => { if ((info.url || info.title || info.status === "complete") && tab && tab.active && mine(tab.windowId)) notify(); });
  chrome.windows.onFocusChanged.addListener((winId) => { if (winId !== chrome.windows.WINDOW_ID_NONE && mine(winId)) notify(); });
  addEventListener("s2p:show", (e) => { if (e.detail === "dokusho") notify(); });
})();

// ツールバーのボタンでサイドパネルを開く設定だけ。画面は panel.html、各アプリの中身は各アプリの細い画面
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// 2026-11-21 1.10.0：マネージャーくんへ自動で残す（capture.js が読んだ往復を受けて送る）。
// 鍵と送り先はマネージャーくんの細い画面で「この拡張をつなぐ」を押したときに入る（bridge-manager.js）。鍵が無ければ何も送らない
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "mk-capture") return;
  (async () => {
    const { mk_key, mk_base } = await chrome.storage.local.get(["mk_key", "mk_base"]);
    if (!mk_key || !mk_base) return sendResponse({ ok: false, skip: true });
    const at = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    try {
      const r = await fetch(mk_base + "/manager/ext/capture", {
        method: "POST",
        headers: { Authorization: "Bearer " + mk_key, "Content-Type": "application/json" },
        body: JSON.stringify(msg.payload),
      });
      const b = await r.json().catch(() => null);
      const last = b && b.ok ? { at, no: b["番号"], name: b["名前"], how: b["結び方"] } : { at, error: (b && b.message) || "送れませんでした（" + r.status + "）" };
      await chrome.storage.local.set({ mk_last: last });
      sendResponse(b || { ok: false });
    } catch (e) {
      await chrome.storage.local.set({ mk_last: { at, error: "送れませんでした（" + String(e && e.message || e) + "）" } });
      sendResponse({ ok: false });
    }
  })();
  return true;
});

// ツールバーのボタンでサイドパネルを開く設定だけ。画面は panel.html、各アプリの中身は各アプリの細い画面
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// 2026-11-21 1.10.0：マネージャーくんへ自動で残す（capture.js が読んだ往復を受けて送る）。
// 鍵と送り先はマネージャーくんの細い画面で「この拡張をつなぐ」を押したときに入る（bridge-manager.js）。鍵が無ければ何も送らない
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "mk-capture") return;
  (async () => {
    const { mk_key, mk_base } = await chrome.storage.local.get(["mk_key", "mk_base"]);
    if (!mk_key || !mk_base) return sendResponse({ ok: false, skip: true });
    const at = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    try {
      const r = await fetch(mk_base + "/manager/ext/capture", {
        method: "POST",
        headers: { Authorization: "Bearer " + mk_key, "Content-Type": "application/json" },
        body: JSON.stringify({ ...msg.payload, ...(await groupOf(sender && sender.tab)) }),
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

/* 1.13.0（2026-11-22 マネージャーくん）：Chrome のタブのまとまりの名前を、そのチャットの作業としてマネージャーくんへ送る。
 *   ・チャットを読んで送るときに、まとまりの名前を一緒に送る（groupOf）
 *   ・あとからまとまりに入れた・名前を付けた・名前を変えたときも、そのまとまりのチャットのタブを送り直す（住所と名前だけ）
 *   名前の無いまとまりと、まとまりから外したときは送らない（作業から外すのはマネージャーくんの画面で） */
const MK_CHAT = /^https:\/\/(claude\.ai\/chat\/|(chatgpt\.com|chat\.openai\.com)\/(g\/[A-Za-z0-9_-]+\/)?c\/)/;
async function groupOf(tab) {
  try {
    if (!tab || tab.groupId === undefined || tab.groupId === -1) return {};
    const g = await chrome.tabGroups.get(tab.groupId);
    const t = String((g && g.title) || "").trim();
    return t ? { group: t.slice(0, 80) } : {};
  } catch { return {}; }
}
const mkGroupTimers = new Map();
function sendGroupSoon(tabId) {
  clearTimeout(mkGroupTimers.get(tabId));
  mkGroupTimers.set(tabId, setTimeout(async () => {
    mkGroupTimers.delete(tabId);
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab || !MK_CHAT.test(tab.url || "")) return;
      const g = await groupOf(tab);
      if (!g.group) return;
      const { mk_key, mk_base } = await chrome.storage.local.get(["mk_key", "mk_base"]);
      if (!mk_key || !mk_base) return;
      const r = await fetch(mk_base + "/manager/ext/group", { method: "POST", headers: { Authorization: "Bearer " + mk_key, "Content-Type": "application/json" }, body: JSON.stringify({ url: tab.url, group: g.group }) });
      const b = await r.json().catch(() => null);
      if (b && b.ok && b["作業"]) await chrome.storage.local.set({ mk_last: { at: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }), no: b["番号"], name: "作業「" + b["作業"] + "」へ入れた", how: "group" } });
    } catch { /* タブが閉じた・拡張を入れ替えた直後など */ }
  }, 1500));
}
chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.groupId !== undefined && info.groupId !== -1) sendGroupSoon(tabId); });
chrome.tabGroups.onUpdated.addListener(async (g) => {
  try { for (const t of await chrome.tabs.query({ groupId: g.id })) if (MK_CHAT.test(t.url || "")) sendGroupSoon(t.id); } catch {}
});

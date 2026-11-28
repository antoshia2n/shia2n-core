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
      if (b && b.ok) paintTab(sender && sender.tab, b["まとまり"]);
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
    const t = mkBare(String((g && g.title) || "").trim());
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
      if (b && b.ok) paintGroup(tab.groupId, b["まとまり"]);
      if (b && b.ok && b["作業"]) await chrome.storage.local.set({ mk_last: { at: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }), no: b["番号"], name: "作業「" + b["作業"] + "」へ入れた", how: "group" } });
    } catch { /* タブが閉じた・拡張を入れ替えた直後など */ }
  }, 1500));
}
chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.groupId !== undefined && info.groupId !== -1) sendGroupSoon(tabId); });
const mkGroupTitles = new Map(); // 1.14.0：名前が変わったときだけ送り直す（色やたたみでは送らない）
chrome.tabGroups.onUpdated.addListener(async (g) => {
  if (mkGroupTitles.get(g.id) === g.title) return;
  mkGroupTitles.set(g.id, g.title);
  try { for (const t of await chrome.tabs.query({ groupId: g.id })) if (MK_CHAT.test(t.url || "")) sendGroupSoon(t.id); } catch {}
});

/* 1.14.0（2026-11-22 マネージャーくん 7便目）：誰の番・まとまりの色・タブの保存
 *   ・mk-turn：capture.js からの合図（AI が書き始めた・見た）をマネージャーくんへ送る
 *   ・返ってきた作業の色で、そのタブのまとまりを塗る（赤＝Naoki の番・青＝AI が作業中・灰＝済み・緑＝待ちなし）。名前が作業と同じまとまりだけ
 *   ・名前のあるまとまりの中身（チャット以外も・http(s) だけ・40 本まで）を、変わったら 3 秒おいて作業へ写す
 *     まとまりが無くなった（閉じた・消した）ときは写さない（保存したタブを消さないため）
 *   ・mk-save-group：パネルの「閉じて保存」から、閉じる前にすぐ写す */
const MK_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
const mkBare = (s) => String(s || "").replace(/^\s*◆\s*/, ""); // 1.22.0：保存済みの印は名前に入れない
const mkKey = (s) => mkBare(s).replace(/\s+/g, "").toLowerCase();
async function mkPost(path, body) {
  const { mk_key, mk_base } = await chrome.storage.local.get(["mk_key", "mk_base"]);
  if (!mk_key || !mk_base) return null;
  const r = await fetch(mk_base + path, { method: "POST", headers: { Authorization: "Bearer " + mk_key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => null);
}
async function paintGroup(groupId, info) {
  try {
    if (!info || !MK_COLORS.includes(info["色"]) || groupId === undefined || groupId === -1) return;
    const g = await chrome.tabGroups.get(groupId);
    if (g && mkKey(g.title) === mkKey(info["名前"]) && g.color !== info["色"]) await chrome.tabGroups.update(groupId, { color: info["色"] });
  } catch {}
}
function paintTab(tab, info) { if (tab) paintGroup(tab.groupId, info); }
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "mk-turn") return;
  (async () => {
    try { const b = await mkPost("/manager/ext/turn", msg.payload); if (b && b.ok) paintTab(sender && sender.tab, b["まとまり"]); sendResponse(b || { ok: false }); }
    catch { sendResponse({ ok: false }); }
  })();
  return true;
});

const mkSent = new Map(); // まとまりの番号 → 最後に送った中身
async function groupTabs(groupId) {
  const g = await chrome.tabGroups.get(groupId);
  const title = mkBare(String((g && g.title) || "").trim());
  if (!title) return null;
  const tabs = (await chrome.tabs.query({ groupId })).sort((a, b) => a.index - b.index)
    .filter((t) => /^https?:\/\//.test(t.url || t.pendingUrl || "")).slice(0, 40)
    .map((t) => ({ url: t.url || t.pendingUrl, title: (t.title || "").slice(0, 200) }));
  return tabs.length ? { g, title, tabs } : null;
}
async function saveGroup(groupId, force) {
  try {
    const x = await groupTabs(groupId);
    if (!x) return { ok: false, skip: true };
    const sig = x.title + "\n" + x.tabs.map((t) => t.url).join("\n");
    if (!force && mkSent.get(groupId) === sig) return { ok: true, same: true };
    const b = await mkPost("/manager/ext/tabs", { group: x.title, tabs: x.tabs });
    if (b && b.ok && !b["外した"]) setTimeout(() => refreshYours(), 800);
    if (b && b.ok) { mkSent.set(groupId, sig); paintGroup(groupId, b["まとまり"]); }
    return b || { ok: false };
  } catch (e) { return { ok: false, message: String(e && e.message || e) }; }
}
const mkWinTimers = new Map();
function syncWindowSoon(windowId) {
  if (windowId === undefined || windowId < 0) return;
  clearTimeout(mkWinTimers.get(windowId));
  mkWinTimers.set(windowId, setTimeout(async () => {
    mkWinTimers.delete(windowId);
    try {
      if (!(await chrome.storage.local.get("mk_key")).mk_key) return;
      for (const g of await chrome.tabGroups.query({ windowId })) if (g.title) await saveGroup(g.id, false);
    } catch {}
  }, 3000));
}
chrome.tabs.onUpdated.addListener((tabId, info, tab) => { if (info.url || info.title || info.groupId !== undefined) syncWindowSoon(tab && tab.windowId); });
chrome.tabs.onRemoved.addListener((tabId, info) => { if (!info.isWindowClosing) syncWindowSoon(info.windowId); });
chrome.tabs.onMoved.addListener((tabId, info) => syncWindowSoon(info.windowId));
chrome.tabs.onAttached.addListener((tabId, info) => syncWindowSoon(info.newWindowId));
chrome.tabGroups.onUpdated.addListener((g) => syncWindowSoon(g.windowId));
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "mk-save-group") { saveGroup(Number(msg.groupId), true).then(sendResponse); return true; }
  // 1.18.0：「全部しまう」の受け箱（まとまりに入っていないタブ）を、前の分に足して写す
  // 1.19.0：ピンのリンクで開いたタブ（住所の #mkpin- を覚えておき、チャットの画面が聞きに来たら渡す）
  if (msg.type === "mk-pin-take") { const id = sender && sender.tab && sender.tab.id; const p = pinPend.get(id); pinPend.delete(id); sendResponse(p && Date.now() - p.at < 90000 ? p : null); return; }
  if (msg.type === "mk-pin") { mkPost("/manager/ext/pin", { chat: msg.chat, n: msg.n }).then((b) => sendResponse(b || { ok: false })).catch(() => sendResponse({ ok: false })); return true; }
  if (msg.type === "mk-save-tabs") { mkPost("/manager/ext/tabs", { group: String(msg.group || ""), tabs: msg.tabs || [], add: true }).then((b) => sendResponse(b || { ok: false })).catch((e) => sendResponse({ ok: false, message: String(e && e.message || e) })); return true; }
});

/* 1.15.0（2026-11-22 マネージャーくん 8便目）：通知・アイコンの数・読み取りの入れ直し
 *   ・mk-done-unseen：見ていない間に AI が書き終わった → Chrome の通知（押すとそのタブ）とアイコンの数
 *   ・mk-seen-local：そのタブを見た → 数から外す・通知を消す
 *   ・拡張を入れ替えた・入れたとき、開いている Claude と ChatGPT のタブへ読み取り（capture.js）を入れ直す
 *   ・台帳が変わりそうなとき（全文・合図・まとまりを送った）、パネルへ「読み直して」を送る */
const MK_UNSEEN = "mk_unseen";
async function unseen() { try { return (await chrome.storage.session.get(MK_UNSEEN))[MK_UNSEEN] || []; } catch { return []; } }
async function setUnseen(list) {
  try { await chrome.storage.session.set({ [MK_UNSEEN]: list }); } catch {}
  // 1.21.0：アイコンの数は「Naoki の番」の数にした（refreshYours）。見ていない数は通知だけに使う
}
function mkChanged() { chrome.runtime.sendMessage({ type: "mk-changed" }).catch(() => {}); }
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !sender || !sender.tab) return;
  const tabId = sender.tab.id;
  if (msg.type === "mk-done-unseen") {
    (async () => {
      const list = await unseen();
      if (!list.includes(tabId)) await setUnseen([...list, tabId]);
      chrome.notifications.create("mk-tab-" + tabId, { type: "basic", iconUrl: "icons/128.png", title: "返事が来ました", message: String(msg.title || "チャット").slice(0, 120), priority: 1 });
      mkChanged();
    })();
  } else if (msg.type === "mk-seen-local") {
    (async () => { const list = await unseen(); if (list.includes(tabId)) await setUnseen(list.filter((x) => x !== tabId)); chrome.notifications.clear("mk-tab-" + tabId); })();
  } else if (msg.type === "mk-capture" || msg.type === "mk-turn") {
    setTimeout(mkChanged, 1500);
    setTimeout(refreshYours, 2500);
  }
});
chrome.notifications.onClicked.addListener(async (id) => {
  const m = /^mk-tab-(\d+)$/.exec(id); if (!m) return;
  try { const t = await chrome.tabs.update(Number(m[1]), { active: true }); await chrome.windows.update(t.windowId, { focused: true }); } catch {}
  chrome.notifications.clear(id);
});
chrome.tabs.onRemoved.addListener(async (tabId) => { const list = await unseen(); if (list.includes(tabId)) await setUnseen(list.filter((x) => x !== tabId)); });
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ url: ["https://claude.ai/*", "https://chatgpt.com/*", "https://chat.openai.com/*"] });
    for (const t of tabs) chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["capture.js"] }).catch(() => {});
  } catch {}
});

/* 1.19.0：ピンのリンク（#mkpin-チャット-ピン）で開いたタブを覚える。Claude や ChatGPT が住所から消しても位置へ動かせるように */
const pinPend = new Map();
chrome.tabs.onUpdated.addListener((tabId, info) => { const m = info.url && info.url.match(/#mkpin-(\d+)-(\d+)$/); if (m) pinPend.set(tabId, { chat: Number(m[1]), n: Number(m[2]), at: Date.now() }); });
chrome.tabs.onRemoved.addListener((tabId) => pinPend.delete(tabId));

/* 1.21.0（2026-11-26 マネージャーくん v1.150.6・Naoki「Naoki の番が目立たない・見逃す」）
 *   ・アイコンの数＝Naoki の番のチャットの数（返事をするまで消えない）
 *   ・Naoki の番のチャットのタブ名の頭に「● 」（capture.js が付け外しする）
 *   ・1 分ごとと、チャットを読んだ・合図を送ったあとに、マネージャーくんへ聞き直す */
function chatKey(u) {
  try {
    const x = new URL(u); const p = x.pathname.replace(/\/+$/, "");
    if (x.hostname === "claude.ai") { const m = p.match(/^\/chat\/([0-9a-f-]{8,})$/i); return m ? "claude:" + m[1] : null; }
    if (/chatgpt\.com$|chat\.openai\.com$/.test(x.hostname)) { const m = p.match(/\/c\/([A-Za-z0-9-]{8,})$/); return m ? "gpt:" + m[1] : null; }
  } catch {}
  return null;
}
let yoursBusy = false;
async function refreshYours() {
  if (yoursBusy) return; yoursBusy = true;
  try {
    const b = await mkPost("/manager/ext/yours", {});
    if (!b || !b.ok) return;
    const keys = new Set((b["住所"] || []).map(chatKey).filter(Boolean));
    await chrome.action.setBadgeBackgroundColor({ color: "#b42318" }).catch(() => {});
    await chrome.action.setBadgeText({ text: b["件数"] ? String(b["件数"]) : "" }).catch(() => {});
    const tabs = await chrome.tabs.query({ url: ["https://claude.ai/*", "https://chatgpt.com/*", "https://chat.openai.com/*"] });
    for (const t of tabs) { const k = chatKey(t.url || ""); chrome.tabs.sendMessage(t.id, { type: "mk-yours", on: !!(k && keys.has(k)) }).catch(() => {}); }
    // 1.22.0：保存済みのまとまりの名前の頭に「◆ 」。保存していないまとまりからは外す
    if (Array.isArray(b["保存済み"])) {
      const saved = new Set(b["保存済み"].map(mkKey));
      for (const g of await chrome.tabGroups.query({})) {
        if (!g.title) continue;
        const base = mkBare(g.title).trim();
        const want = saved.has(mkKey(base)) ? "◆ " + base : base;
        if (want !== g.title) { mkGroupTitles.set(g.id, want); await chrome.tabGroups.update(g.id, { title: want }).catch(() => {}); }
      }
    }
  } catch {} finally { yoursBusy = false; }
}
chrome.alarms.create("mk-yours", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "mk-yours") refreshYours(); });
chrome.runtime.onStartup.addListener(refreshYours);
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (info.status === "complete" && /^https:\/\/(claude\.ai|chatgpt\.com|chat\.openai\.com)\//.test((tab && tab.url) || "")) refreshYours(); });

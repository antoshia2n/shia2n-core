/**
 * マネージャーくんとのやりとり（2026-11-21 開発部・マネージャーくん 2便目・Naoki「OK」22:36）。
 * マネージャーくんの細い画面（https://manager.shia2n.jp/?view=panel）で「この拡張をつなぐ」を押すと、書くだけの鍵がここへ渡る。
 *   ext-key：鍵と送り先を chrome.storage.local に持つ（capture.js と background.js が使う）
 *   ext-forget：鍵を消す（画面の「止める」）
 *   ext-hello：つないでいるか・最後に残したものを画面へ返す
 * 鍵は書くことしかできない（マネージャーくんの台帳を読む力は無い）。止めるとサーバー側でも使えなくなる。
 * 1.12.0（2026-11-22 5便目）：作業のチャットを、作業の名前のタブのまとまりで開く・たたむ・閉じる。
 *   tabs-open：今のウィンドウで、もう開いているチャットはそのタブを、無ければ新しいタブを開き、1 つのまとまりにする
 *   tabs-collapse：その名前のまとまりを折りたたむ ／ tabs-close：その名前のまとまりのタブを閉じる
 *   開くのは Claude と ChatGPT のチャットの住所だけ（ほかの住所は受けない）
 */
(() => {
  const ORIGINS = ["https://manager.shia2n.jp", "https://shia2n-mcp.gameister1.workers.dev"];
  const frame = () => window.S2P && window.S2P.frameOf("manager");
  const originOf = (f) => { try { return new URL(f.src).origin; } catch { return null; } };
  const post = (msg) => {
    const f = frame(); const o = f && originOf(f);
    if (f && f.contentWindow && ORIGINS.includes(o)) f.contentWindow.postMessage({ src: "manager-ext", ...msg }, o);
  };
  async function state() {
    const { mk_key, mk_last } = await chrome.storage.local.get(["mk_key", "mk_last"]);
    post({ type: "ext-state", has_key: !!mk_key, last: mk_last || null });
  }
  const CHAT_URL = /^https:\/\/(claude\.ai\/chat\/|(chatgpt\.com|chat\.openai\.com)\/(g\/[A-Za-z0-9_-]+\/)?c\/)/;
  // 同じチャットかは会話の番号で比べる（ChatGPT はプロジェクトの住所の形が変わるため）
  const chatId = (u) => { const m = String(u || "").match(/\/(?:chat|c)\/([A-Za-z0-9-]{8,})/); return m ? m[1] : String(u || "").split("#")[0]; };
  const done = (ok, message) => post({ type: "tabs-done", ok, message });
  async function win() { return chrome.windows.getLastFocused({ windowTypes: ["normal"] }); }
  async function groupsNamed(title, windowId) { return (await chrome.tabGroups.query({ windowId })).filter((g) => g.title === title); }
  async function tabsOpen(name, urls) {
    const title = String(name || "").slice(0, 40);
    const list = [...new Set((Array.isArray(urls) ? urls : []).map(String).filter((u) => CHAT_URL.test(u)))].slice(0, 20);
    if (!title || !list.length) return done(false, "開けるチャットの住所がありません");
    const w = await win();
    const have = await chrome.tabs.query({ windowId: w.id });
    const ids = [];
    for (const u of list) {
      const hit = have.find((t) => t.url && chatId(t.url) === chatId(u));
      if (hit) ids.push(hit.id);
      else ids.push((await chrome.tabs.create({ url: u, active: false, windowId: w.id })).id);
    }
    const g = (await groupsNamed(title, w.id))[0];
    const gid = await chrome.tabs.group(g ? { tabIds: ids, groupId: g.id } : { tabIds: ids, createProperties: { windowId: w.id } });
    await chrome.tabGroups.update(gid, { title, collapsed: false, color: "red" });
    await chrome.tabs.update(ids[0], { active: true });
    done(true, `「${title}」のチャット ${ids.length} 本をタブで開きました`);
  }
  async function tabsCollapse(name) {
    const w = await win(); const gs = await groupsNamed(String(name || "").slice(0, 40), w.id);
    if (!gs.length) return done(false, "この作業のタブのまとまりは開いていません");
    for (const g of gs) await chrome.tabGroups.update(g.id, { collapsed: true });
    done(true, "たたみました");
  }
  async function tabsClose(name) {
    const w = await win(); const gs = await groupsNamed(String(name || "").slice(0, 40), w.id);
    if (!gs.length) return done(false, "この作業のタブのまとまりは開いていません");
    let n = 0;
    for (const g of gs) { const ts = await chrome.tabs.query({ groupId: g.id }); n += ts.length; if (ts.length) await chrome.tabs.remove(ts.map((t) => t.id)); }
    done(true, `タブを ${n} 本閉じました`);
  }

  addEventListener("message", async (e) => {
    const f = frame();
    if (!f || e.source !== f.contentWindow || !ORIGINS.includes(e.origin)) return;
    const m = e.data || {};
    if (m.src !== "manager") return;
    if (m.type === "ext-key" && /^mk_[A-Za-z0-9_-]{30,}$/.test(String(m.key || "")) && ORIGINS.includes(m.base)) {
      await chrome.storage.local.set({ mk_key: m.key, mk_base: m.base, mk_last: null });
    } else if (m.type === "ext-forget") {
      await chrome.storage.local.remove(["mk_key", "mk_base", "mk_last"]);
    } else if (m.type === "tabs-open" || m.type === "tabs-collapse" || m.type === "tabs-close") {
      try {
        if (m.type === "tabs-open") await tabsOpen(m.name, m.urls);
        else if (m.type === "tabs-collapse") await tabsCollapse(m.name);
        else await tabsClose(m.name);
      } catch (err) { done(false, "タブを動かせませんでした：" + String(err && err.message || err).slice(0, 120)); }
      return;
    } else if (m.type !== "ext-hello") return;
    state();
  });
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && (ch.mk_last || ch.mk_key)) state(); });
})();

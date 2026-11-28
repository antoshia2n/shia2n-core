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
 * 1.14.0（2026-11-22 7便目）：タブ管理
 *   tabs-open：保存したタブ（チャット以外も・http(s) だけ・40 本まで）も開く。まとまりの色は作業の状態の色
 *   tabs-close・group-close：閉じる前に、まとまりの中身を作業へ写す（background.js の mk-save-group）
 *   tabs-shimau（1.18.0）：全部しまう。名前のあるまとまりは作業へ、ほかは「受け箱」へ写してから閉じる。どのウィンドウにも空のタブを 1 つ残す
 *   tabs-list：このウィンドウのまとまりと、どこにも入っていないタブを画面へ返す（変わるたびに送り直す）
 *   group-expand・group-collapse・tab-focus・tab-close・tab-move（作業の名前のまとまりへ入れる）・tabs-paint（作業の色で塗る）
 * 1.15.0（2026-11-22 8便目）：「今」の画面から
 *   do-work：その作業のまとまりを開いて前に出し（無ければ保存したタブとチャットで開く）、focus のチャットのタブを選ぶ。ほかのまとまりはたたむ
 *   tab-go：そのチャットのタブへ飛ぶ（どのウィンドウでも。無ければ新しいタブで開く）
 *   背景から「台帳が変わった」（mk-changed）が来たら、画面へ refresh を送る
 * 1.15.1（2026-11-22）：ウィンドウを何枚も開いているとき
 *   作業のまとまりがほかのウィンドウで開いていれば、そのウィンドウを前に出してそこで動かす（同じタブを二重に開かない）
 *   チャットのタブがほかのウィンドウにあれば、新しく開かずにそのタブをまとまりへ移す
 * 1.16.0（2026-11-22）：1 つのパネルで全部のウィンドウを扱う
 *   tabs-list はウィンドウごとに返す（画面の左からの位置で 左・真ん中・右。このパネルのウィンドウに印）
 *   group-here：そのまとまりを、このパネルのウィンドウへまとめて移す
 * 1.17.0（2026-11-22 12便目）：タブの画面をフォルダの木に
 *   tabs-list のまとまりに中のタブ（id・題・住所）も添える
 *   group-new：新しいタブ 1 本でまとまりを作る（作業を先に作って、あとからページを足す）
 *   tab-move-active：このパネルのウィンドウで今見ているタブを、その名前のまとまりへ入れる
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
  // このパネルがついているウィンドウ（取れなければ最後に使ったウィンドウ）
  async function win() { try { const w = await chrome.windows.getCurrent(); if (w && w.type === "normal") return w; } catch {} return chrome.windows.getLastFocused({ windowTypes: ["normal"] }); }
  const COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
  // 1.22.0：保存済みのまとまりは名前の頭に「◆ 」が付く。比べるときは外す
  const bare = (s) => String(s || "").replace(/^\s*◆\s*/, "");
  const key = (s) => bare(s).replace(/\s+/g, "").toLowerCase();
  const saveGroup = (groupId) => chrome.runtime.sendMessage({ type: "mk-save-group", groupId }).catch(() => null);
  async function groupsNamed(title, windowId) { return (await chrome.tabGroups.query({ windowId })).filter((g) => bare(g.title) === bare(title)); }
  // 1.15.1：その名前のまとまりがどこかのウィンドウで開いていれば、そのウィンドウ。無ければこのパネルのウィンドウ
  async function winFor(title) {
    const any = (await chrome.tabGroups.query({})).find((g) => bare(g.title) === bare(title));
    const w = any ? await chrome.windows.get(any.windowId) : await win();
    if (any) await chrome.windows.update(w.id, { focused: true }).catch(() => {});
    return w;
  }
  async function tabsOpen(name, urls, color) {
    const title = String(name || "").slice(0, 40);
    const list = [...new Set((Array.isArray(urls) ? urls : []).map(String).filter((u) => /^https?:\/\/[^\s]+$/.test(u)))].slice(0, 40);
    if (!title || !list.length) return done(false, "開ける住所がありません");
    const w = await winFor(title);
    const have = await chrome.tabs.query({});
    const ids = [];
    for (const u of list) {
      const hit = have.find((t) => t.url && (t.windowId === w.id || t.groupId === -1) && (CHAT_URL.test(u) ? chatId(t.url) === chatId(u) : t.url === u));
      if (hit) ids.push(hit.id);
      else ids.push((await chrome.tabs.create({ url: u, active: false, windowId: w.id })).id);
    }
    const g = (await groupsNamed(title, w.id))[0];
    const gid = await chrome.tabs.group(g ? { tabIds: ids, groupId: g.id } : { tabIds: ids, createProperties: { windowId: w.id } });
    const cur = await chrome.tabGroups.get(gid).catch(() => null);
    await chrome.tabGroups.update(gid, { title: cur && bare(cur.title) === bare(title) && cur.title ? cur.title : title, collapsed: false, color: COLORS.includes(color) ? color : "red" });
    await chrome.tabs.update(ids[0], { active: true });
    done(true, `「${title}」のタブを ${ids.length} 本開きました`);
  }
  // 1.16.1：たたむ・閉じるは、どのウィンドウにあるまとまりでも
  const groupsAny = async (name) => { const t = String(name || "").slice(0, 40); return (await chrome.tabGroups.query({})).filter((g) => bare(g.title) === bare(t)); };
  async function tabsCollapse(name) {
    const gs = await groupsAny(name);
    if (!gs.length) return done(false, "この作業のタブのまとまりは開いていません");
    for (const g of gs) await chrome.tabGroups.update(g.id, { collapsed: true });
    done(true, "たたみました");
  }
  async function tabsClose(name) {
    const gs = await groupsAny(name);
    if (!gs.length) return done(false, "この作業のタブのまとまりは開いていません");
    let n = 0;
    for (const g of gs) { await saveGroup(g.id); const ts = await chrome.tabs.query({ groupId: g.id }); n += ts.length; if (ts.length) await chrome.tabs.remove(ts.map((t) => t.id)); }
    done(true, `タブを ${n} 本保存して閉じました。作業の「タブで開く」で戻せます`);
  }

  // 1.15.0：作業をやる・チャットのタブへ飛ぶ
  const same = (a, b) => CHAT_URL.test(a || "") && CHAT_URL.test(b || "") ? chatId(a) === chatId(b) : String(a || "").split("#")[0] === String(b || "").split("#")[0];
  async function doWork(name, urls, color, focus) {
    const title = String(name || "").slice(0, 40);
    const w = await winFor(title);
    let g = (await groupsNamed(title, w.id))[0];
    if (!g) {
      await tabsOpen(title, urls, color);
      g = (await groupsNamed(title, w.id))[0];
      if (!g) return;
    } else {
      // 開いているまとまりに、まだ無いチャットだけ足す
      const have = await chrome.tabs.query({ groupId: g.id });
      const all = await chrome.tabs.query({});
      const add = [];
      for (const u of (Array.isArray(urls) ? urls : []).map(String).filter((u) => CHAT_URL.test(u)).slice(0, 20)) {
        if (have.some((t) => same(t.url, u))) continue;
        const elsewhere = all.find((t) => same(t.url, u) && t.groupId === -1); // まとまりに入っていないタブだけ移す（ほかの作業のタブは取らない）
        add.push(elsewhere ? elsewhere.id : (await chrome.tabs.create({ url: u, active: false, windowId: w.id })).id);
      }
      if (add.length) await chrome.tabs.group({ tabIds: add, groupId: g.id });
      await chrome.tabGroups.update(g.id, { collapsed: false });
    }
    for (const o of await chrome.tabGroups.query({ windowId: w.id })) if (o.id !== g.id && !o.collapsed) await chrome.tabGroups.update(o.id, { collapsed: true }).catch(() => {});
    const inG = (await chrome.tabs.query({ groupId: g.id })).sort((a, b) => a.index - b.index);
    const pick = (focus && inG.find((t) => same(t.url, focus))) || inG[0];
    if (pick) await chrome.tabs.update(pick.id, { active: true });
    done(true, `「${title}」を前に出しました`);
  }
  async function tabGo(url) {
    const u = String(url || "");
    if (!/^https?:\/\//.test(u)) return done(false, "住所がありません");
    const hit = (await chrome.tabs.query({})).find((t) => same(t.url, u));
    if (hit) {
      if (hit.groupId !== -1) await chrome.tabGroups.update(hit.groupId, { collapsed: false }).catch(() => {});
      await chrome.tabs.update(hit.id, { active: true }); await chrome.windows.update(hit.windowId, { focused: true });
    } else { const w = await win(); await chrome.tabs.create({ url: u, active: true, windowId: w.id }); }
  }
  chrome.runtime.onMessage.addListener((msg) => { if (msg && msg.type === "mk-changed") post({ type: "refresh" }); });

  // 1.16.0：全部のウィンドウのまとまりと、どこにも入っていないタブ（ウィンドウごと・左から順）
  async function tabsList() {
    const me = await win();
    const wins = (await chrome.windows.getAll({ windowTypes: ["normal"] })).sort((a, b) => (a.left ?? 0) - (b.left ?? 0) || a.id - b.id);
    const names = wins.length === 3 ? ["左の画面", "真ん中の画面", "右の画面"] : wins.length === 2 ? ["左の画面", "右の画面"] : wins.map((_, i) => wins.length === 1 ? "" : `ウィンドウ ${i + 1}`);
    const out = [];
    for (const [i, w] of wins.entries()) {
      const [gs, ts] = await Promise.all([chrome.tabGroups.query({ windowId: w.id }), chrome.tabs.query({ windowId: w.id })]);
      const first = new Map();
      for (const t of ts) if (t.groupId !== -1 && !first.has(t.groupId)) first.set(t.groupId, t.index);
      const groups = gs.map((g) => { const in_ = ts.filter((t) => t.groupId === g.id).sort((a, b) => a.index - b.index); return { id: g.id, title: g.title || "", color: g.color, collapsed: g.collapsed, count: in_.length, tabs: in_.slice(0, 40).map((t) => ({ id: t.id, title: (t.title || "").slice(0, 120), url: t.url || t.pendingUrl || "" })) }; })
        .sort((a, b) => (first.get(a.id) ?? 0) - (first.get(b.id) ?? 0));
      const loose = ts.filter((t) => t.groupId === -1 && !t.pinned && /^https?:\/\//.test(t.url || "")).slice(0, 40).map((t) => ({ id: t.id, title: (t.title || "").slice(0, 120), url: t.url }));
      out.push({ id: w.id, name: names[i], here: w.id === me.id, groups, loose });
    }
    // 前の形（1 つのウィンドウ）も添える：このパネルのウィンドウ
    const mine = out.find((x) => x.here) || out[0] || { groups: [], loose: [] };
    post({ type: "tabs-list", windows: out, groups: mine.groups, loose: mine.loose });
  }
  let listT = null;
  const listSoon = () => { clearTimeout(listT); listT = setTimeout(() => tabsList().catch(() => {}), 400); };
  async function groupAct(type, id) {
    const g = await chrome.tabGroups.get(id);
    if (type === "group-expand") { await chrome.tabGroups.update(id, { collapsed: false }); const [t] = await chrome.tabs.query({ groupId: id }); if (t) await chrome.tabs.update(t.id, { active: true }); return; }
    if (type === "group-collapse") return void await chrome.tabGroups.update(id, { collapsed: true });
    if (type === "group-here") { const w = await win(); await chrome.tabGroups.move(id, { windowId: w.id, index: -1 }); await chrome.tabGroups.update(id, { collapsed: false }).catch(() => {}); return done(true, `「${g.title || "まとまり"}」をこの画面へ移しました`); }
    if (g.title) await saveGroup(id);
    const ts = await chrome.tabs.query({ groupId: id });
    if (ts.length) await chrome.tabs.remove(ts.map((t) => t.id));
    done(true, g.title ? `「${g.title}」を保存して閉じました` : "閉じました");
  }
  async function groupNew(name, color) {
    const title = String(name || "").slice(0, 40);
    if (!title) return done(false, "作業の名前がありません");
    const w = await win();
    const t = await chrome.tabs.create({ windowId: w.id, active: true });
    const gid = await chrome.tabs.group({ tabIds: [t.id], createProperties: { windowId: w.id } });
    await chrome.tabGroups.update(gid, { title, color: COLORS.includes(color) ? color : "green", collapsed: false });
    done(true, `「${title}」のまとまりを作りました。ページを開いて足していけます`);
  }
  async function tabMoveActive(name) {
    const w = await win();
    const [t] = await chrome.tabs.query({ active: true, windowId: w.id });
    if (!t || !/^https?:\/\//.test(t.url || "")) return done(false, "今見ているタブはページではありません");
    await tabMove(t.id, name);
  }
  async function tabMove(id, name) {
    const title = String(name || "").slice(0, 80);
    const tab = await chrome.tabs.get(id);
    const g = (await chrome.tabGroups.query({ windowId: tab.windowId })).find((x) => key(x.title) === key(title)) || (await chrome.tabGroups.query({})).find((x) => key(x.title) === key(title));
    if (g) await chrome.tabs.group({ tabIds: [id], groupId: g.id });
    else { const gid = await chrome.tabs.group({ tabIds: [id], createProperties: { windowId: tab.windowId } }); await chrome.tabGroups.update(gid, { title, color: "green" }); }
    done(true, `「${title}」に入れました`);
  }
  /* 1.18.0（マネージャーくん v1.146.0）：全部しまう
   *   ・名前のあるまとまり → 作業へ写してから閉じる（写せなかったら閉じずに止まる）
   *   ・名前のないまとまりと、まとまりに入っていないページ → 「受け箱」へ足してから閉じる
   *   ・ピン留め・マネージャーのページ・ページでないタブ（新しいタブなど）は残す。どのウィンドウにも空のタブを 1 つ残す（ウィンドウを消さない） */
  async function shimau() {
    const SKIP = (t) => t.pinned || !/^https?:\/\//.test(t.url || t.pendingUrl || "") || /^https:\/\/manager\.shia2n\.jp(\/|$)/.test(t.url || "");
    let groups = 0, inbox = 0, closed = 0;
    const wins = await chrome.windows.getAll({ windowTypes: ["normal"] });
    const loose = [], close = [];
    for (const w of wins) {
      const ts = await chrome.tabs.query({ windowId: w.id });
      for (const g of await chrome.tabGroups.query({ windowId: w.id })) {
        const in_ = ts.filter((t) => t.groupId === g.id && !SKIP(t));
        if (!in_.length) continue;
        if (g.title) {
          const r = await saveGroup(g.id);
          if (!r || !r.ok) return done(false, `「${g.title}」を保存できなかったので、そこで止めました（閉じたのは ${closed} 本）`);
          groups++;
          close.push(...in_.map((t) => t.id));
        } else in_.forEach((t) => loose.push(t));
      }
      ts.filter((t) => t.groupId === -1 && !SKIP(t)).forEach((t) => loose.push(t));
    }
    if (loose.length) {
      const r = await chrome.runtime.sendMessage({ type: "mk-save-tabs", group: "受け箱", tabs: loose.map((t) => ({ url: t.url || t.pendingUrl, title: (t.title || "").slice(0, 200) })) }).catch(() => null);
      if (!r || !r.ok) return done(false, `受け箱へ保存できなかったので、まとまりに入っていない ${loose.length} 本は閉じずに残しました`);
      inbox = loose.length; close.push(...loose.map((t) => t.id));
    }
    // 空のタブを 1 つ残す（閉じたあとに残るタブが無いウィンドウだけ）
    for (const w of wins) {
      const left = (await chrome.tabs.query({ windowId: w.id })).filter((t) => !close.includes(t.id));
      if (!left.length) await chrome.tabs.create({ windowId: w.id, active: true });
    }
    if (close.length) await chrome.tabs.remove(close);
    closed = close.length;
    done(true, `しまいました：作業 ${groups} つ・受け箱 ${inbox} 本・閉じたタブ ${closed} 本`);
  }
  async function paint(items) {
    const want = new Map((Array.isArray(items) ? items : []).filter((x) => x && COLORS.includes(x.color)).map((x) => [key(x.name), x.color]));
    for (const g of await chrome.tabGroups.query({})) { const c = want.get(key(g.title)); if (c && g.color !== c) await chrome.tabGroups.update(g.id, { color: c }); }
  }
  for (const ev of [chrome.windows.onCreated, chrome.windows.onRemoved, chrome.windows.onBoundsChanged, chrome.tabs.onCreated, chrome.tabs.onRemoved, chrome.tabs.onUpdated, chrome.tabs.onMoved, chrome.tabs.onAttached, chrome.tabs.onDetached, chrome.tabGroups.onCreated, chrome.tabGroups.onUpdated, chrome.tabGroups.onRemoved]) ev.addListener(listSoon);

  addEventListener("message", async (e) => {
    const f = frame();
    if (!f || e.source !== f.contentWindow || !ORIGINS.includes(e.origin)) return;
    const m = e.data || {};
    if (m.src !== "manager") return;
    if (m.type === "ext-key" && /^mk_[A-Za-z0-9_-]{30,}$/.test(String(m.key || "")) && ORIGINS.includes(m.base)) {
      await chrome.storage.local.set({ mk_key: m.key, mk_base: m.base, mk_last: null });
    } else if (m.type === "ext-forget") {
      await chrome.storage.local.remove(["mk_key", "mk_base", "mk_last"]);
    } else if (m.type === "tab-current") {
      // 1.13.0：今のタブ（いちばん前のウィンドウの、選んでいるタブ）の住所と題を返す。チャットの住所のときだけ
      try {
        const w = await win();
        const [t] = await chrome.tabs.query({ active: true, windowId: w.id });
        if (t && CHAT_URL.test(t.url || "")) post({ type: "tab-current", ok: true, url: t.url, title: t.title || "" });
        else post({ type: "tab-current", ok: false, message: "今のタブは Claude か ChatGPT のチャットではありません" });
      } catch (err) { post({ type: "tab-current", ok: false, message: "今のタブを読めませんでした" }); }
      return;
    } else if (m.type === "do-work" || m.type === "tab-go") {
      try { if (m.type === "do-work") await doWork(m.name, m.urls, m.color, m.focus); else await tabGo(m.url); }
      catch (err) { done(false, "タブを動かせませんでした：" + String(err && err.message || err).slice(0, 120)); }
      return;
    } else if (["tabs-list", "group-new", "tab-move-active", "group-expand", "group-collapse", "group-close", "group-here", "tab-focus", "tab-close", "tab-move", "tabs-paint", "tabs-shimau"].includes(m.type)) {
      try {
        if (m.type === "tabs-list") await tabsList();
        else if (m.type === "group-new") await groupNew(m.name, m.color);
        else if (m.type === "tab-move-active") await tabMoveActive(m.name);
        else if (m.type === "tabs-paint") await paint(m.items);
        else if (m.type === "tab-focus") { const t = await chrome.tabs.update(Number(m.id), { active: true }); await chrome.windows.update(t.windowId, { focused: true }); }
        else if (m.type === "tab-close") await chrome.tabs.remove(Number(m.id));
        else if (m.type === "tab-move") await tabMove(Number(m.id), m.name);
        else if (m.type === "tabs-shimau") await shimau();
        else await groupAct(m.type, Number(m.id));
      } catch (err) { done(false, "タブを動かせませんでした：" + String(err && err.message || err).slice(0, 120)); }
      return;
    } else if (m.type === "tabs-open" || m.type === "tabs-collapse" || m.type === "tabs-close") {
      try {
        if (m.type === "tabs-open") await tabsOpen(m.name, m.urls, m.color);
        else if (m.type === "tabs-collapse") await tabsCollapse(m.name);
        else await tabsClose(m.name);
      } catch (err) { done(false, "タブを動かせませんでした：" + String(err && err.message || err).slice(0, 120)); }
      return;
    } else if (m.type !== "ext-hello") return;
    state();
  });
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && (ch.mk_last || ch.mk_key)) state(); });
})();

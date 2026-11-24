/**
 * マネージャーくんへ自動で残す（2026-11-21 開発部・マネージャーくん 2便目・Naoki「OK」22:36）。
 * claude.ai と chatgpt.com のチャットのページの中で動く。マネージャーくんの細い画面で「この拡張をつなぐ」を押したあとだけ働く。
 *   ・会話が 5 秒止まったら、画面に出ている往復を全部読む（スクロールはしない・書いている途中は読まない）
 *   ・前に送った中身と同じなら送らない。違えば背景（background.js）に渡し、背景がマネージャーくんへ送る
 *   ・ChatGPT のキャンバスと Claude のアーティファクトの中身は読まない（別の画面で開くもの）
 * 読み方は bridge-anken.js の readChat と同じ印を使う（ページの形が変わったら両方を直す）。
 * 1.10.1（2026-11-21）：ChatGPT の画面の作りが変わった（往復ごとの箱 data-turn-key・発言 data-user-message-bubble・返事 data-response-body）。
 *   箱の番号（data-turn-key）を一緒に送り、マネージャーくんが前に受けた分と足し合わせる（ChatGPT は画面に出ている往復しか描かないため）。
 * 1.11.0（2026-11-22 4便目）：チャットが入っているプロジェクトの名前も送る（マネージャーくんの分野の棚になる）。
 *   Claude は上部のプロジェクトへのリンク（/project/…）、ChatGPT は上部の「プロジェクト: ○○」の印。プロジェクトの外なら送らない。
 * 1.14.0（2026-11-22 7便目）：誰の番。
 *   ・AI が書き始めたら（止めるボタンが出たら）「AI が作業中」の合図を 1 回送る
 *   ・読んだ全文を送るとき、そのタブを見ているか（seen）を添える。見ていないうちに返事が来たら「返事が来た」になる
 *   ・あとでそのタブを見たら「見た」の合図を送る（返事が来た → Naoki の番）
 * 1.15.0（2026-11-22 8便目）：見ていない間に AI が書き終わったら、背景へ知らせる（Chrome の通知とアイコンの数）
 */
(() => {
  const QUIET_MS = 5000;
  const CHAT = /^https:\/\/(claude\.ai\/chat\/|(chatgpt\.com|chat\.openai\.com)\/(g\/[A-Za-z0-9_-]+\/)?c\/)/;
  const tidy = (s) => String(s || "").replace(/\n(もっと表示|Show more)\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const service = /claude\.ai$/.test(location.hostname) ? "claude" : "chatgpt";
  let timer = null;
  let lastUrl = "";
  let lastSig = "";

  function busy() {
    // 書いている途中（止めるボタンが出ている間）は読まない
    if (document.querySelector('[data-testid="stop-button"], button[aria-label="Stop response"], button[aria-label="応答を停止"], button[aria-label="Stop generating"]')) return true;
    return [...document.querySelectorAll("[data-talvt-turn-state]")].some((el) => /stream|generat|pending|progress|running/i.test(el.getAttribute("data-talvt-turn-state") || ""));
  }

  function read() {
    const turns = [];
    const boxes = service === "chatgpt" ? [...document.querySelectorAll("main [data-turn-key]")] : [];
    if (boxes.length) {
      // 2026-11 からの ChatGPT：1 つの箱に発言と返事（返事は道具を使うと複数の塊になる）
      for (const b of boxes) {
        const u = b.querySelector("[data-user-message-bubble]");
        const rs = [...b.querySelectorAll("[data-response-body]")].filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)));
        turns.push({ k: b.getAttribute("data-turn-key") || undefined, user: tidy(u && u.innerText), reply: tidy(rs.map((r) => r.innerText).join("\n\n")) });
      }
    } else if (service === "chatgpt") {
      for (const el of document.querySelectorAll("[data-message-author-role]")) {
        const role = el.getAttribute("data-message-author-role");
        const text = tidy(el.innerText);
        if (role === "user") turns.push({ user: text, reply: "" });
        else if (role === "assistant" && turns.length) { const t = turns[turns.length - 1]; t.reply = tidy([t.reply, text].filter(Boolean).join("\n\n")); }
      }
    } else {
      const us = [...document.querySelectorAll('[data-testid="user-message"]')];
      const as = [...document.querySelectorAll('.font-claude-response, .font-claude-message, [data-testid="assistant-message"]')].filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)));
      const all = [...us.map((el) => ({ el, u: true })), ...as.map((el) => ({ el, u: false }))]
        .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      for (const x of all) {
        const text = tidy(x.el.innerText);
        if (x.u) turns.push({ user: text, reply: "" });
        else if (turns.length) { const t = turns[turns.length - 1]; t.reply = tidy([t.reply, text].filter(Boolean).join("\n\n")); }
      }
    }
    return turns.filter((t) => t.user || t.reply);
  }

  function project() {
    if (service === "claude") {
      // 左の一覧（最近のチャット・プロジェクトへのリンクが並ぶ枠）にあるものは除く。上部のパンくずの枠は除かない
      const inSide = (el) => { const n = el.closest("nav, aside"); return !!(n && n.querySelector('a[href^="/chat/"], a[href="/projects"]')); };
      const a = [...document.querySelectorAll('a[href^="/project/"]')].find((el) => !inSide(el));
      return a ? tidy(a.textContent).slice(0, 60) : "";
    }
    if (!/\/g\/g-p-/.test(location.pathname)) return "";
    for (const el of document.querySelectorAll("header [aria-label], header [title]")) {
      const m = String(el.getAttribute("aria-label") || el.getAttribute("title") || "").match(/^(?:プロジェクト|Project)\s*[:：]\s*(.+)$/);
      if (m) return m[1].trim().slice(0, 60);
    }
    return "";
  }

  function sig(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return s.length + ":" + (h >>> 0); }

  async function tick() {
    timer = null;
    const url = location.href;
    if (!CHAT.test(url)) return;
    if (busy()) { arm(); return; }
    let has = false;
    try { has = !!(await chrome.storage.local.get("mk_key")).mk_key; } catch { return; } // 拡張を入れ替えた直後は止まる
    if (!has) return;
    const turns = read();
    if (!turns.length || !turns.some((t) => t.reply)) return;
    const proj = project();
    const s = sig(url + "\n" + proj + "\n" + JSON.stringify(turns));
    if (url === lastUrl && s === lastSig) return;
    const title = document.title.replace(/\s*[-|]\s*(ChatGPT|Claude)\s*$/, "").trim();
    try {
      const r = await chrome.runtime.sendMessage({ type: "mk-capture", payload: { url, title, turns, seen: seen(), ...(proj ? { project: proj } : {}) } });
      if (r && r.ok) { lastUrl = url; lastSig = s; }
    } catch { /* 背景が眠っていれば次の変化でまた送る */ }
  }

  function arm() { clearTimeout(timer); timer = setTimeout(tick, QUIET_MS); checkBusySoon(); }

  // 1.14.0：誰の番の合図（台帳に無いチャットはマネージャーくんの側で何もしない）
  const seen = () => document.visibilityState === "visible";
  let aiUrl = "", busyT = null, seenAt = 0;
  async function ping(kind) {
    try {
      if (!(await chrome.storage.local.get("mk_key")).mk_key) return;
      await chrome.runtime.sendMessage({ type: "mk-turn", payload: { url: location.href, kind } });
    } catch { /* 拡張を入れ替えた直後など */ }
  }
  function checkBusySoon() {
    if (busyT) return;
    busyT = setTimeout(() => {
      busyT = null;
      if (!CHAT.test(location.href)) return;
      if (busy()) { if (aiUrl !== location.href) { aiUrl = location.href; ping("AI"); } }
      else if (aiUrl === location.href) { aiUrl = ""; if (!seen()) notifyDone(); }
    }, 2000);
  }
  async function notifyDone() {
    try {
      if (!(await chrome.storage.local.get("mk_key")).mk_key) return;
      const title = document.title.replace(/\s*[-|]\s*(ChatGPT|Claude)\s*$/, "").trim();
      await chrome.runtime.sendMessage({ type: "mk-done-unseen", title, service });
    } catch {}
  }
  function onSeen() {
    if (!seen() || !CHAT.test(location.href) || Date.now() - seenAt < 20000) return;
    seenAt = Date.now(); ping("seen");
  }
  document.addEventListener("visibilitychange", () => { if (seen()) chrome.runtime.sendMessage({ type: "mk-seen-local" }).catch(() => {}); onSeen(); });
  addEventListener("focus", onSeen);
  new MutationObserver(arm).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  arm();
})();

/* 1.19.0（マネージャーくん v1.150.2）：ピンのリンクで開いたら、そのピンの出力まで動かして数秒光らせる
 *   住所の #mkpin-チャット-ピン（Claude や ChatGPT が住所から消しても、background が開いたときに覚えている） */
(function () {
  const norm = (t) => String(t || "").replace(/[#*`>|_~\-]+/g, " ").replace(/\s+/g, "").toLowerCase();
  function keys(body) {
    const lines = String(body || "").split(/\n+/).map((l) => norm(l)).filter((l) => l.length >= 8);
    const out = [];
    if (lines[0]) out.push(lines[0].slice(0, 40));
    if (lines.length > 2) out.push(lines[Math.floor(lines.length / 2)].slice(0, 40));
    if (lines.length > 1) out.push(lines[lines.length - 1].slice(0, 40));
    return out;
  }
  const SEL = '.font-claude-response, .font-claude-message, [data-testid="assistant-message"], [data-testid="user-message"], [data-message-author-role]';
  function find(ks) {
    const els = [...document.querySelectorAll(SEL)].filter((el, _, all) => !all.some((o) => o !== el && el.contains(o) && o.matches(SEL)));
    for (const el of els) { const t = norm(el.innerText); if (ks.length && ks.filter((k) => t.includes(k)).length >= Math.min(2, ks.length)) return el; }
    for (const el of els) { const t = norm(el.innerText); if (ks[0] && t.includes(ks[0])) return el; }
    return null;
  }
  function scroller(el) { let p = el && el.parentElement; while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight) return p; p = p.parentElement; } return document.scrollingElement; }
  function note(msg) {
    const d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#2b2823;color:#f1ece6;font:13px/1.5 system-ui,sans-serif;padding:8px 14px;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.25)";
    document.body.appendChild(d); setTimeout(() => d.remove(), 3500);
  }
  async function run() {
    let m = location.hash.match(/^#mkpin-(\d+)-(\d+)$/);
    if (!m) { const r = await chrome.runtime.sendMessage({ type: "mk-pin-take" }).catch(() => null); if (r && r.chat) m = [null, r.chat, r.n]; }
    if (!m) return;
    const b = await chrome.runtime.sendMessage({ type: "mk-pin", chat: Number(m[1]), n: Number(m[2]) }).catch(() => null);
    if (!b || !b.ok) { note("ピンを読めませんでした（拡張機能をつないでください）"); return; }
    try { if (/^#mkpin-/.test(location.hash)) history.replaceState(history.state, "", location.pathname + location.search); } catch {}
    const ks = keys(b["中身"]);
    const t0 = Date.now(); let ups = 0;
    while (Date.now() - t0 < 30000) {
      const el = find(ks);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const prev = el.style.outline; el.style.outline = "3px solid #f59e0b"; el.style.outlineOffset = "4px"; el.style.borderRadius = el.style.borderRadius || "8px";
        setTimeout(() => { el.style.outline = prev; }, 3500);
        note(`ピン「${b["題"]}」`);
        return;
      }
      // 古い出力がまだ読み込まれていなければ、上へ動かして読み込ませる（6 秒たってから・10 回まで）
      if (Date.now() - t0 > 6000 && ups < 10) { const any = document.querySelector(SEL); const sc = scroller(any); if (sc) { sc.scrollTop = 0; ups++; } }
      await new Promise((r) => setTimeout(r, 800));
    }
    note("ピンの位置が見つかりませんでした");
  }
  run();
})();

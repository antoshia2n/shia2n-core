/**
 * マネージャーくんへ自動で残す（2026-11-21 開発部・マネージャーくん 2便目・Naoki「OK」22:36）。
 * claude.ai と chatgpt.com のチャットのページの中で動く。マネージャーくんの細い画面で「この拡張をつなぐ」を押したあとだけ働く。
 *   ・会話が 5 秒止まったら、画面に出ている往復を全部読む（スクロールはしない・書いている途中は読まない）
 *   ・前に送った中身と同じなら送らない。違えば背景（background.js）に渡し、背景がマネージャーくんへ送る
 *   ・ChatGPT のキャンバスと Claude のアーティファクトの中身は読まない（別の画面で開くもの）
 * 読み方は bridge-anken.js の readChat と同じ印を使う（ページの形が変わったら両方を直す）。
 * 1.10.1（2026-11-21）：ChatGPT の画面の作りが変わった（往復ごとの箱 data-turn-key・発言 data-user-message-bubble・返事 data-response-body）。
 *   箱の番号（data-turn-key）を一緒に送り、マネージャーくんが前に受けた分と足し合わせる（ChatGPT は画面に出ている往復しか描かないため）。
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
    const s = sig(url + "\n" + JSON.stringify(turns));
    if (url === lastUrl && s === lastSig) return;
    const title = document.title.replace(/\s*[-|]\s*(ChatGPT|Claude)\s*$/, "").trim();
    try {
      const r = await chrome.runtime.sendMessage({ type: "mk-capture", payload: { url, title, turns } });
      if (r && r.ok) { lastUrl = url; lastSig = s; }
    } catch { /* 背景が眠っていれば次の変化でまた送る */ }
  }

  function arm() { clearTimeout(timer); timer = setTimeout(tick, QUIET_MS); }
  new MutationObserver(arm).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  arm();
})();

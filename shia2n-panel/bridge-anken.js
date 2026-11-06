/**
 * 案件くんとのやりとり（2026-11-06 AI チャットの目次・Naoki「OK」22:13）。
 * 案件くんの細い画面（https://anken.shia2n.jp/panel）から頼まれたときだけ、いま見ているタブを読む。
 *   peek：見ているタブの住所と題名、AI チャットのページかどうか（ページの中身は読まない）
 *   grab：見ているタブが ChatGPT か Claude のチャットのときだけ、往復ごとの全文を読んで返す
 * ChatGPT のページの中からは外へ送れない（ページの決まりで止まる）ので、拡張機能が読んで案件くんの画面へ渡す。
 * 送るのは案件くんの画面（Naoki のログイン）で、ここは渡すだけ。
 */
(() => {
  const ANKEN_ORIGIN = "https://anken.shia2n.jp";
  const frame = () => window.S2P && window.S2P.frameOf("anken");
  const postA = (msg) => { const f = frame(); if (f && f.contentWindow) f.contentWindow.postMessage({ src: "anken-ext", ...msg }, ANKEN_ORIGIN); };
  const CHAT_URL = /^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai)\/(?:g\/[A-Za-z0-9_-]+\/)?(share|c|chat)\//;

  let myWin = null;
  try { chrome.windows.getCurrent((w) => { myWin = w ? w.id : null; }); } catch { /* 取れなければ前に触った窓を見る */ }
  async function activeTab() {
    const [tab] = await chrome.tabs.query(myWin != null ? { active: true, windowId: myWin } : { active: true, lastFocusedWindow: true });
    return tab || null;
  }

  /* ── ページの中で動く関数（そのままページへ差し込むので、外の変数は使えない） ── */
  async function readChat() {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const tidy = (s) => String(s || "").replace(/\n…\n展開\n?/g, "\n").replace(/\n(もっと表示|Show more)\n?/g, "\n").replace(/\n{2,}/g, "\n").trim();
    const host = location.hostname;
    const service = /claude\.ai$/.test(host) ? "claude" : "chatgpt";
    const titleNow = () => document.title.replace(/\s*[-|]\s*(ChatGPT|Claude)\s*$/, "").trim();
    /** 下書き（キャンバス）は画面に入るまで描かれないので、上から下まで 1 回送ってから読む（元の位置へ戻す） */
    let walked = false;
    async function walk() {
      walked = true;
      let el = document.querySelector("main");
      while (el && el !== document.body) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 10) break; el = el.parentElement; }
      const sc = el && el !== document.body ? el : document.scrollingElement;
      const back = sc.scrollTop;
      const until = Date.now() + 25000; // 長いチャットでも 25 秒で打ち切る（パネルは 75 秒待つ）
      for (let top = 0; top < sc.scrollHeight && Date.now() < until; top += Math.max(200, sc.clientHeight * 0.8)) { sc.scrollTop = top; await sleep(120); }
      sc.scrollTop = sc.scrollHeight; await sleep(300);
      sc.scrollTop = back;
    }
    /** ChatGPT の下書き（キャンバスのメールなど）を返事から分ける */
    const splitDraft = (r) => {
      const m = r.match(/\n(?:メール|Email)\n(?:宛先|To|送信\n受信者)\n([\s\S]*?)(?:\n(?:もっと表示|Show more)\n|$|\n(?=今回は|これなら|このくらい))/);
      return m ? { reply: tidy(r.replace(m[0], "\n（下書き）\n")), draft: tidy(m[1]) } : { reply: tidy(r), draft: "" };
    };
    for (let i = 0; i < 20; i++) {
      // 発言が出てきたら 1 回だけ下まで送って、たたまれている下書きを描かせる
      if (!walked && /(あなたの発言|You said):|data-message-author-role|user-message/.test((document.querySelector("main")?.innerText || "") + (document.querySelector("[data-message-author-role],[data-testid=\"user-message\"]") ? "data-message-author-role" : ""))) { await walk(); continue; }
      // ChatGPT：発言に役の印があれば使う
      const roles = [...document.querySelectorAll("[data-message-author-role]")];
      if (roles.length) {
        const turns = [];
        for (const el of roles) {
          const role = el.getAttribute("data-message-author-role");
          const text = el.innerText || "";
          if (role === "user") turns.push({ user: tidy(text), reply: "", draft: "" });
          else if (role === "assistant" && turns.length) { const t = turns[turns.length - 1]; const s = splitDraft("\n" + text + "\n"); t.reply = tidy([t.reply, s.reply].filter(Boolean).join("\n")); if (s.draft) t.draft = tidy([t.draft, s.draft].filter(Boolean).join("\n")); }
        }
        if (turns.length) return { ok: true, url: location.href, title: titleNow(), service, turns };
      }
      // ChatGPT：役の印が無い画面（2026-11 の共有ページ）は「あなたの発言:」「ChatGPT の発言:」で区切る
      const main = document.querySelector("main")?.innerText || "";
      const U = /\n?(?:あなたの発言|You said):\n/, A = /\n(?:ChatGPT の発言|ChatGPT said):\n/;
      if (service === "chatgpt" && U.test(main) && A.test(main)) {
        const body = main.slice(main.search(U));
        const turns = body.split(new RegExp(U.source)).filter((p) => p.trim()).map((p) => {
          const [u, ...rest] = p.split(new RegExp(A.source));
          const r = rest.join("\n").replace(/\n(?:昨日|今日)?\s*\d{1,2}:\d{2}\s*$/, "").replace(/(ChatGPT は間違えることがあります|ChatGPT can make mistakes)[\s\S]*$/, "");
          return { user: tidy(u), ...splitDraft("\n" + r + "\n") };
        });
        if (turns.length) return { ok: true, url: location.href, title: titleNow(), service, turns };
      }
      // Claude：自分の発言の印と、Claude の返事の印を、ページの上から順に並べる
      if (service === "claude") {
        const us = [...document.querySelectorAll('[data-testid="user-message"]')];
        const as = [...document.querySelectorAll('.font-claude-response, .font-claude-message, [data-testid="assistant-message"]')].filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)));
        if (us.length && as.length) {
          const all = [...us.map((el) => ({ el, u: true })), ...as.map((el) => ({ el, u: false }))]
            .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
          const turns = [];
          for (const x of all) {
            if (x.u) turns.push({ user: tidy(x.el.innerText), reply: "", draft: "" });
            else if (turns.length) { const t = turns[turns.length - 1]; t.reply = tidy([t.reply, x.el.innerText].filter(Boolean).join("\n")); }
          }
          if (turns.length) return { ok: true, url: location.href, title: titleNow(), service, turns };
        }
      }
      await sleep(500);
    }
    return { ok: false, message: "このページから発言を読めませんでした。チャットが全部表示されてから、もう一度押してください" };
  }

  addEventListener("message", async (e) => {
    const f = frame();
    if (e.origin !== ANKEN_ORIGIN || !f || e.source !== f.contentWindow) return;
    const m = e.data || {};
    if (m.src !== "anken" || !["peek", "grab"].includes(m.type)) return;
    try {
      const tab = await activeTab();
      const url = tab?.url || "";
      if (m.type === "peek") return postA({ type: "reply", id: m.id, ok: true, data: { url, title: tab?.title || "", chat: CHAT_URL.test(url) } });
      if (!tab || !CHAT_URL.test(url)) throw new Error("ChatGPT か Claude のチャットのタブを開いてから押してください");
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readChat });
      const data = res?.result;
      if (!data?.ok) throw new Error(data?.message || "このページから発言を読めませんでした");
      postA({ type: "reply", id: m.id, ok: true, data });
    } catch (err) { postA({ type: "reply", id: m.id, ok: false, error: String(err?.message || err) }); }
  });

  // 見ているタブが変わったら知らせる（案件くんを出しているとき・自分の窓だけ）
  const mine = (winId) => myWin == null || winId === myWin;
  const notify = () => { if (window.S2P && window.S2P.isShown("anken")) postA({ type: "tab" }); };
  chrome.tabs.onActivated.addListener((info) => { if (mine(info.windowId)) notify(); });
  chrome.tabs.onUpdated.addListener((_, info, tab) => { if ((info.url || info.status === "complete") && tab && tab.active && mine(tab.windowId)) notify(); });
  chrome.windows.onFocusChanged.addListener((winId) => { if (winId !== chrome.windows.WINDOW_ID_NONE && mine(winId)) notify(); });
  addEventListener("s2p:show", (e) => { if (e.detail === "anken") notify(); });
})();

/**
 * シアニンパネル（2026-10-31 開発部・全アプリ統合のサイドパネル 1 便目）。
 * 上の帯でアプリを選ぶと、そのアプリの細い画面をこのパネルの中に出す。細い画面が無いアプリは「ほか ↗」から新しいタブで開く。
 * 一度開いたアプリの画面は消さずに隠すだけなので、戻ったときに書きかけやタイマーがそのまま残る。最後に開いたアプリを覚える。
 * スワイプくん・X攻略くんの「見ているページを読む」は bridge-swipe.js・bridge-x.js（元の各パネルと同じやりとり）。
 */
(() => {
  const APPS = window.S2P_APPS || { panel: [], tab: [] };
  const LAST = "s2p:last";
  const $ = (id) => document.getElementById(id);
  const strip = $("strip"), stage = $("stage"), nameEl = $("name"), more = $("more"), pop = $("pop"), empty = $("empty");
  const frames = new Map(); // key → iframe
  let current = null;

  const LEAF = "M44 0H114A14 14 0 0 1 128 14V84A44 44 0 0 1 84 128H14A14 14 0 0 1 0 114V44A44 44 0 0 1 44 0Z";
  const WAVE = "M0 128V58C34 58 40 82 64 82S94 104 128 104V128Z";
  const DARK = new Set(["#334155", "#57534e", "#1c1917"]);
  let seq = 0;
  /** 小さい版のアイコン（make_icons.py の icon(small=True) と同じ形） */
  function icon(a, px) {
    const id = "i" + (++seq), op = DARK.has(a.color) ? 0.3 : 0.22;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 128 128" aria-hidden="true">`
      + `<defs><clipPath id="${id}c"><path d="${LEAF}"/></clipPath><mask id="${id}m"><rect width="128" height="128" fill="#fff"/><g fill="#000"><circle cx="132" cy="40" r="19"/><circle cx="-4" cy="90" r="19"/></g></mask></defs>`
      + `<g mask="url(#${id}m)"><g clip-path="url(#${id}c)"><rect width="128" height="128" fill="${a.color}"/><path d="${WAVE}" fill="#000" fill-opacity="${op}"/></g>`
      + `<g transform="translate(14 14) scale(4.17)" fill="none" stroke="#fff" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round">${a.g}</g></g></svg>`;
  }
  const el = (tag, attrs = {}, html = "") => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === "onclick") e.addEventListener("click", v); else e.setAttribute(k, v); } if (html) e.innerHTML = html; return e; };
  const openTab = (url) => { try { chrome.tabs.create({ url }); } catch { window.open(url, "_blank", "noopener"); } };
  const store = {
    get: () => new Promise((ok) => { try { chrome.storage.local.get(LAST, (r) => ok(r && r[LAST])); } catch { ok(null); } }),
    set: (v) => { try { chrome.storage.local.set({ [LAST]: v }); } catch { /* 覚えられなくても動く */ } },
  };

  /* ---- 上の帯（パネルで開くアプリ） ---- */
  APPS.panel.forEach((a) => {
    strip.append(el("button", { class: "ab", type: "button", "data-key": a.key, "aria-pressed": "false", "aria-label": a.name + "をパネルで開く", title: a.name, onclick: () => select(a.key) }, icon(a, 22)));
  });

  /* ---- いま開いているアプリの名前と「別タブで開く」 ---- */
  function paintName(a) {
    nameEl.innerHTML = "";
    if (!a) return;
    nameEl.append(el("b", {}, ""), el("span", { style: "flex:1" }, ""));
    nameEl.firstChild.textContent = a.name;
    const b = el("button", { class: "ib", type: "button", style: "height:28px;min-width:0;font-size:12px", title: a.name + "を別タブで開く", onclick: () => openTab(a.open) }, "別タブで開く ↗");
    nameEl.append(b);
  }

  function select(key) {
    const a = APPS.panel.find((x) => x.key === key);
    if (!a) return;
    current = key;
    let f = frames.get(key);
    if (!f) {
      f = el("iframe", { title: a.name, src: a.url, allow: "clipboard-read; clipboard-write; autoplay" });
      frames.set(key, f);
      stage.append(f);
    }
    frames.forEach((x, k) => { x.hidden = k !== key; });
    empty.hidden = true;
    strip.querySelectorAll(".ab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.key === key)));
    const btn = strip.querySelector(`[data-key="${key}"]`);
    if (btn) btn.scrollIntoView({ inline: "nearest", block: "nearest" });
    paintName(a);
    store.set(key);
  }

  /* ---- ほかのアプリ（新しいタブで開く） ---- */
  function closePop(back) {
    if (pop.hidden) return;
    pop.hidden = true; more.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onDown, true);
    if (back) more.focus();
  }
  function onDown(e) { if (!pop.contains(e.target) && e.target !== more) closePop(false); }
  function openPop() {
    pop.innerHTML = "";
    pop.append(el("h2", {}, "新しいタブで開く"));
    APPS.tab.forEach((a) => pop.append(el("button", { class: "it", type: "button", role: "menuitem", onclick: () => { closePop(true); openTab(a.open); } }, icon(a, 20) + `<span class="l"></span><span class="r">↗</span>`)));
    pop.querySelectorAll(".it .l").forEach((s, i) => { s.textContent = APPS.tab[i].name; });
    if (current) {
      const a = APPS.panel.find((x) => x.key === current);
      pop.append(el("h2", {}, "いまのアプリ"));
      const b = el("button", { class: "it", type: "button", role: "menuitem", onclick: () => { closePop(true); openTab(a.open); } }, icon(a, 20) + `<span class="l"></span><span class="r">別タブで開く ↗</span>`);
      b.querySelector(".l").textContent = a.name;
      pop.append(b);
    }
    pop.hidden = false; more.setAttribute("aria-expanded", "true");
    const first = pop.querySelector(".it"); if (first) first.focus();
    setTimeout(() => document.addEventListener("pointerdown", onDown, true), 0);
  }
  more.addEventListener("click", () => (pop.hidden ? openPop() : closePop(true)));
  document.addEventListener("keydown", (e) => {
    if (pop.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); closePop(true); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const its = [...pop.querySelectorAll(".it")], i = its.indexOf(document.activeElement);
      e.preventDefault(); its[(i + (e.key === "ArrowDown" ? 1 : -1) + its.length) % its.length].focus();
    }
  });
  /* 帯の中は ← → でも選べる（並びの中を移るだけ。開くのは Enter か押す） */
  strip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const bs = [...strip.querySelectorAll(".ab")], i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault(); bs[(i + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length].focus();
  });

  window.S2P = { frameOf: (key) => frames.get(key) || null, select };

  store.get().then((k) => select(APPS.panel.some((a) => a.key === k) ? k : (APPS.panel[0] || {}).key));
})();

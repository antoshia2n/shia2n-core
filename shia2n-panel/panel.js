/**
 * シアニンパネル（2026-10-31 開発部・全アプリ統合のサイドパネル 1 便目／2026-11-01 2 便目で挙動を直した）。
 * 上の帯でアプリを選ぶと、そのアプリの細い画面をこのパネルの中に出す。1.3.0 から上の帯に全アプリを左から使った順に並べる（細い画面が無いアプリはふつうの画面を出す）。
 * 一度開いたアプリの画面は消さずに隠すだけなので、戻ったときに書きかけやタイマーがそのまま残る。最後に開いたアプリを覚える。
 * スワイプくん・X攻略くんの「見ているページを読む」は bridge-swipe.js・bridge-x.js（元の各パネルと同じやりとり）。
 * 2 便目：読み込み中の表示・「読み込み直す」・FMオレの動画に要る許可（暗号化した動画・全画面・小窓）を元のパネルにそろえた・
 *   隠れているアプリにはタブの変化を知らせず、出したときに 1 回知らせる（S2P.isShown と "s2p:show"）・メニューの外へ Tab で出たら閉じる。
 * 3 便目（1.2.0）：「ほか ▼」のアプリ（細い画面の無いアプリ）も、押すとふつうの画面をそのままパネルの中に出す。行の右の ↗ は新しいタブ。
 *   ほかのアプリの画面は重いので、隠して残すのは最後に開いた 3 つまで（それより古いものは閉じる。上の帯のアプリは閉じない）。
 * 4 便目（1.3.0・Naoki「上のアイコンをスライダーで全部スライドできるように・左から使用履歴順に」）：
 *   上の帯に全アプリを並べ、左から使った順にする。押した直後に並びが動くと押し間違えるので、並べ替えはマウスと選択が帯を離れてから。
 *   帯は下の細いつまみ・ホイール・つかんで引く、のどれでも横に動く。「一覧 ▼」は全アプリを名前で並べる（↗ は新しいタブ）。
 */
(() => {
  const APPS = window.S2P_APPS || { panel: [], tab: [] };
  const ALL = [...APPS.panel, ...APPS.tab];
  const isTab = (key) => APPS.tab.some((a) => a.key === key);
  const KEEP_TAB = 3; // 細い画面の無いアプリ（apps.js の tab）の画面を隠して残す数
  const tabOrder = []; // 細い画面の無いアプリを開いた順（古い → 新しい）
  const LAST = "s2p:last";
  const ORDER = "s2p:order"; // 使った順（新しい → 古い）の key の並び
  // 細い画面に渡す許可。FMオレの YouTube は encrypted-media がないと流れない動画がある（元の FMオレのパネルと同じ並び）
  const ALLOW = "clipboard-read; clipboard-write; autoplay; encrypted-media; picture-in-picture; fullscreen";
  const $ = (id) => document.getElementById(id);
  const strip = $("strip"), stage = $("stage"), nameEl = $("appname"), nameBtns = $("namebtns"), more = $("more"), pop = $("pop"), empty = $("empty"), loading = $("loading"), loadMsg = $("loadmsg"), sr = $("sr");
  const STUCK_MS = 15000; // これだけ待っても読み込みが終わらないときは、覆いを外して中を見せる（「読み込み直す」で直せる）
  const frames = new Map(); // key → iframe
  const pending = new Set(); // 読み込み中の key
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
    get: () => new Promise((ok) => { try { chrome.storage.local.get([LAST, ORDER], (r) => ok(r || {})); } catch { ok({}); } }),
    set: (o) => { try { chrome.storage.local.set(o); } catch { /* 覚えられなくても動く */ } },
  };

  /* ---- 上の帯（全アプリ・左から使った順） ---- */
  let history = []; // 使った順（新しい → 古い）
  /** 使った順に並べ、まだ使っていないアプリは元の並び（細い画面のあるアプリ → 無いアプリ）で後ろへ */
  const ordered = () => [...history.map((k) => ALL.find((a) => a.key === k)).filter(Boolean), ...ALL.filter((a) => !history.includes(a.key))];
  ALL.forEach((a) => {
    strip.append(el("button", { class: "ab", type: "button", "data-key": a.key, "aria-pressed": "false", "aria-label": a.name + "をパネルで開く", title: a.name, onclick: () => { if (!dragged) select(a.key); } }, icon(a, 22)));
  });
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let reorderWaiting = false, reorderTimer = 0;
  /** 帯を使った順に並べ直す。マウスが帯の上にある間・帯の中を選んでいる間は待つ（押す前に動かないように） */
  function reorder(force, left) {
    // マウスで押したあとはフォーカスが帯に残るので、待つのはキーボードで帯の中を選んでいるとき（:focus-visible）だけ
    // left：帯からマウスが出た知らせのあと（:hover の付け替えが遅れることがあるので見ない）
    if (!force && ((!left && strip.matches(":hover")) || strip.querySelector(":focus-visible"))) {
      reorderWaiting = true;
      // 知らせが来ないまま帯を離れたとき（アプリの画面へ直に入ったときなど）のために、待っている間だけ 0.6 秒ごとに見直す
      clearTimeout(reorderTimer); reorderTimer = setTimeout(() => { if (reorderWaiting) reorder(false); }, 600);
      return;
    }
    clearTimeout(reorderTimer);
    reorderWaiting = false;
    const bs = [...strip.children], before = new Map(bs.map((b) => [b, b.getBoundingClientRect().left]));
    const want = ordered().map((a) => strip.querySelector(`[data-key="${a.key}"]`));
    if (want.every((b, i) => b === bs[i])) return;
    const had = document.activeElement; // 並べ替えで動かすとフォーカスが外れるので、あとで戻す
    want.forEach((b) => strip.append(b));
    if (had && strip.contains(had) && document.activeElement !== had) had.focus({ preventScroll: true });
    strip.scrollTo({ left: 0, behavior: reduce() ? "auto" : "smooth" });
    if (reduce()) return;
    want.forEach((b) => { // 前の場所から滑らせる
      const dx = before.get(b) - b.getBoundingClientRect().left;
      if (dx) b.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: 220, easing: "ease-out" });
    });
  }
  strip.addEventListener("pointerleave", (e) => { if (reorderWaiting && e.pointerType === "mouse") setTimeout(() => reorder(false, true), 0); });
  strip.addEventListener("focusout", () => { if (reorderWaiting) setTimeout(() => reorder(false), 0); });
  // アプリの画面（よその住所の枠）へマウスが入ると、帯の pointerleave が来ないことがあるので、ほかの所に触れた・この画面から外れた、でも見る
  document.addEventListener("pointerover", (e) => { if (reorderWaiting && e.pointerType === "mouse" && !strip.contains(e.target)) reorder(false, true); });
  window.addEventListener("blur", () => { if (reorderWaiting) setTimeout(() => reorder(false, true), 0); });
  function used(key) {
    history = [key, ...history.filter((k) => k !== key && ALL.some((a) => a.key === k))];
    store.set({ [LAST]: key, [ORDER]: history });
    reorder(false);
  }

  /* ---- 帯を横に動かす：下のスライダー・ホイール・つかんで引く ---- */
  const slider = $("slider"), thumb = $("thumb");
  function paintEdges() { // 続きがある側だけ端を薄くする・スライダーのつまみを今の位置へ
    const max = strip.scrollWidth - strip.clientWidth;
    strip.classList.toggle("l", strip.scrollLeft > 2);
    strip.classList.toggle("r", strip.scrollLeft < max - 2);
    slider.hidden = max <= 2; // 全部入るときはスライダーを出さない
    const tw = slider.clientWidth, w = Math.max(28, tw * strip.clientWidth / strip.scrollWidth);
    thumb.style.width = w + "px";
    thumb.style.transform = `translateX(${max > 0 ? (tw - w) * strip.scrollLeft / max : 0}px)`;
  }
  // つまみを引く・溝を押す（押した所へつまみの真ん中を寄せて、そのまま引ける）
  let sdrag = null;
  slider.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const tw = slider.clientWidth, w = thumb.offsetWidth, max = strip.scrollWidth - strip.clientWidth;
    const r = slider.getBoundingClientRect(), tl = thumb.getBoundingClientRect().left - r.left;
    let grab = e.clientX - r.left - tl;
    if (e.target !== thumb) { grab = w / 2; strip.scrollLeft = (e.clientX - r.left - grab) / Math.max(1, tw - w) * max; }
    sdrag = { grab, id: e.pointerId }; slider.setPointerCapture(e.pointerId); slider.classList.add("dragging");
  });
  slider.addEventListener("pointermove", (e) => {
    if (!sdrag || e.pointerId !== sdrag.id) return;
    const tw = slider.clientWidth, w = thumb.offsetWidth, max = strip.scrollWidth - strip.clientWidth, r = slider.getBoundingClientRect();
    strip.scrollLeft = (e.clientX - r.left - sdrag.grab) / Math.max(1, tw - w) * max;
  });
  const endS = () => { sdrag = null; slider.classList.remove("dragging"); };
  slider.addEventListener("pointerup", endS);
  slider.addEventListener("pointercancel", endS);
  strip.addEventListener("scroll", paintEdges, { passive: true });
  window.addEventListener("resize", paintEdges);
  try { new ResizeObserver(paintEdges).observe(strip); } catch { /* 古い Chrome は resize だけ */ }
  const onWheel = (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) { if (e.currentTarget === slider) { e.preventDefault(); strip.scrollLeft += e.deltaX; } return; } // 横のホイール・トラックパッドは帯ではそのまま
    e.preventDefault(); strip.scrollLeft += e.deltaY;
  };
  strip.addEventListener("wheel", onWheel, { passive: false });
  slider.addEventListener("wheel", onWheel, { passive: false });
  let drag = null, dragged = false;
  strip.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return; // 指はもともと横に滑らせられる
    drag = { x: e.clientX, left: strip.scrollLeft, id: e.pointerId }; dragged = false;
  });
  strip.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!(e.buttons & 1)) return endDrag(); // ボタンを放したのがアプリの画面の上だと pointerup が来ない
    const dx = e.clientX - drag.x;
    if (!dragged && Math.abs(dx) > 5) { dragged = true; strip.setPointerCapture(drag.id); strip.classList.add("dragging"); }
    if (dragged) strip.scrollLeft = drag.left - dx;
  });
  const endDrag = () => { if (!drag) return; drag = null; strip.classList.remove("dragging"); setTimeout(() => { dragged = false; }, 0); };
  strip.addEventListener("pointerup", endDrag);
  strip.addEventListener("pointercancel", endDrag);
  strip.addEventListener("lostpointercapture", endDrag);
  document.addEventListener("pointerup", endDrag);
  window.addEventListener("blur", endDrag);

  /* ---- 読み込み中の表示（いま出しているアプリが読み込み中のときだけ） ---- */
  const stuck = new Map(); // key → 時間切れの印
  function paintLoading() {
    const on = current != null && pending.has(current);
    loading.hidden = !on;
    // 細い画面の無いアプリは、よそから枠に入れるのを断る画面（ログイン画面など）だと黙って出ないことがあるので、逃げ道を書いておく
    loadMsg.textContent = on && isTab(current) ? "読み込み中…（出ないときは上の「別タブで開く ↗」）" : "読み込み中…";
    stage.setAttribute("aria-busy", String(on));
    sr.textContent = on ? "読み込み中" : ""; // 読み上げは、いつもある 1 つの欄の文を替えて知らせる
  }
  function done(key) { pending.delete(key); clearTimeout(stuck.get(key)); stuck.delete(key); paintLoading(); }
  function load(key, f, url) {
    pending.add(key); paintLoading();
    clearTimeout(stuck.get(key)); stuck.set(key, setTimeout(() => done(key), STUCK_MS));
    f.src = url; // 同じ住所を入れ直しても読み込み直す（よその住所の画面なので、中の reload は呼べない）
  }

  /* ---- いま開いているアプリの名前と「読み込み直す」「別タブで開く」 ---- */
  function paintName(a) {
    nameEl.textContent = a ? a.name : ""; // 名前の欄だけを読み上げる（ボタンは読み上げない）
    nameBtns.innerHTML = "";
    if (!a) return;
    nameBtns.append(
      el("button", { class: "ib nb", type: "button", "aria-label": a.name + "を読み込み直す", title: "表示がおかしいときや、ログインし直したあとに", onclick: () => { const f = frames.get(a.key); if (f) load(a.key, f, a.url); } }, "読み込み直す"),
      el("button", { class: "ib nb", type: "button", "aria-label": a.name + "を別タブで開く", onclick: () => openTab(a.open) }, "別タブで開く ↗"),
    );
  }

  /** 細い画面の無いアプリの画面が KEEP_TAB を超えたら、古いものから閉じる（いま出しているものは閉じない） */
  function trimTabFrames(key) {
    const i = tabOrder.indexOf(key); if (i >= 0) tabOrder.splice(i, 1);
    tabOrder.push(key);
    while (tabOrder.length > KEEP_TAB) {
      const old = tabOrder.shift(), f = frames.get(old);
      if (f) { f.remove(); frames.delete(old); done(old); }
    }
  }

  function select(key) {
    const a = ALL.find((x) => x.key === key);
    if (!a) return;
    const changed = current !== key;
    current = key;
    if (isTab(key)) trimTabFrames(key);
    used(key);
    let f = frames.get(key);
    if (!f) {
      f = el("iframe", { title: a.name, allow: ALLOW, allowfullscreen: "" });
      f.addEventListener("load", () => done(key));
      frames.set(key, f);
      stage.append(f);
      load(key, f, a.url);
    }
    frames.forEach((x, k) => { x.hidden = k !== key; });
    empty.hidden = true;
    paintLoading();
    // 帯は Tab で 1 回だけ止まる（いま出しているアプリ）。中は ←→・Home・End で移る
    strip.querySelectorAll(".ab").forEach((b) => { const on = b.dataset.key === key; b.setAttribute("aria-pressed", String(on)); b.tabIndex = on ? 0 : -1; });
    const btn = strip.querySelector(`[data-key="${key}"]`);
    if (btn) btn.scrollIntoView({ inline: "nearest", block: "nearest" });
    paintName(a);
    // 隠れていた間のタブの変化は知らせていないので、出したときに 1 回だけ知らせる（bridge-*.js が受ける）
    if (changed) window.dispatchEvent(new CustomEvent("s2p:show", { detail: key }));
  }

  /* ---- 一覧（全アプリを名前で・使った順。押すとパネルの中に出す・↗ は新しいタブ） ---- */
  function closePop(back) {
    if (pop.hidden) return;
    pop.hidden = true; more.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onDown, true);
    if (back) more.focus();
  }
  function onDown(e) { if (!pop.contains(e.target) && !more.contains(e.target)) closePop(false); }
  function openPop() {
    pop.innerHTML = "";
    pop.append(el("h2", { role: "presentation" }, "パネルで開く（↗ は新しいタブ）"));
    ordered().forEach((a) => {
      const row = el("div", { class: "row", role: "none" });
      const main = el("button", { class: "it", type: "button", role: "menuitem", "aria-current": String(current === a.key), onclick: () => { closePop(true); select(a.key); } }, icon(a, 20) + `<span class="l"></span>`);
      main.querySelector(".l").textContent = a.name;
      const go = el("button", { class: "go", type: "button", role: "menuitem", "aria-label": a.name + "を新しいタブで開く", title: "新しいタブで開く", onclick: () => { closePop(true); openTab(a.open); } }, "↗");
      row.append(main, go); pop.append(row);
    });
    pop.hidden = false; more.setAttribute("aria-expanded", "true");
    const first = pop.querySelector(".it"); if (first) first.focus();
    setTimeout(() => document.addEventListener("pointerdown", onDown, true), 0);
  }
  more.addEventListener("click", () => (pop.hidden ? openPop() : closePop(true)));
  // Tab でメニューの外へ出たら閉じる（「一覧」へ戻るときはそのまま）
  document.addEventListener("focusin", (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== more) closePop(false); });
  // アプリの画面（よその住所の iframe）へ移ったときは focusin が来ないので、この画面から外れたときに見る
  // Tab でこのパネルの外（ブラウザの側）へ出たときも同じ
  window.addEventListener("blur", () => setTimeout(() => { if (!pop.hidden && (!document.hasFocus() || (document.activeElement && document.activeElement.tagName === "IFRAME"))) closePop(false); }, 0));
  document.addEventListener("keydown", (e) => {
    if (pop.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); closePop(true); return; }
    // ↑↓ は行を移る（同じ列のまま）・←→ は行の中で「パネルで開く」と「↗」を切り替える・Home／End は最初と最後の行
    const rows = [...pop.querySelectorAll(".row")];
    if (!rows.length) return;
    const a = document.activeElement, r = rows.findIndex((x) => x.contains(a)), col = a && a.classList.contains("go") ? 1 : 0;
    const at = (ri, c) => rows[ri].querySelectorAll(".it,.go")[c].focus();
    if (e.key === "ArrowDown") { e.preventDefault(); at(r < 0 ? 0 : (r + 1) % rows.length, col); }
    else if (e.key === "ArrowUp") { e.preventDefault(); at(r < 0 ? rows.length - 1 : (r - 1 + rows.length) % rows.length, col); }
    else if (e.key === "Home") { e.preventDefault(); at(0, col); }
    else if (e.key === "End") { e.preventDefault(); at(rows.length - 1, col); }
    else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && r >= 0) { e.preventDefault(); at(r, e.key === "ArrowRight" ? 1 : 0); }
  });
  /* 帯の中は ← → でも選べる（並びの中を移るだけ。開くのは Enter か押す） */
  strip.addEventListener("keydown", (e) => {
    const bs = [...strip.querySelectorAll(".ab")], i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    const to = { ArrowRight: (i + 1) % bs.length, ArrowLeft: (i - 1 + bs.length) % bs.length, Home: 0, End: bs.length - 1 }[e.key];
    if (to == null) return;
    e.preventDefault();
    bs.forEach((b, j) => { b.tabIndex = j === to ? 0 : -1; });
    bs[to].focus();
  });
  strip.addEventListener("focusout", (e) => { // 帯から出たら、Tab で止まる所をいま出しているアプリへ戻す
    if (strip.contains(e.relatedTarget)) return;
    strip.querySelectorAll(".ab").forEach((b) => { b.tabIndex = b.dataset.key === current ? 0 : -1; });
  });

  window.S2P = { frameOf: (key) => frames.get(key) || null, isShown: (key) => current === key, select };

  store.get().then((r) => {
    history = Array.isArray(r[ORDER]) ? r[ORDER].filter((k) => ALL.some((a) => a.key === k)) : [];
    if (!history.length && r[LAST]) history = [r[LAST]]; // 1.2.0 までは最後の 1 つだけ覚えていた
    reorder(true);
    const k = r[LAST];
    select(ALL.some((a) => a.key === k) ? k : (APPS.panel[0] || {}).key);
    paintEdges();
  });
})();

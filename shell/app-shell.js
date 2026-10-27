/**
 * 各アプリ共通の外枠（2026-10-26 開発部・1 本目は思考整理くん）。
 *
 * 目的の状態：会員がアプリを開いたとき、次の 4 つに迷わず届く。
 *   ① いま何を開いているか   → タブの名前は「開いているものの名前」だけ。アプリはファビコン（アイコン）で示す（setTabTitle）
 *   ② 誰で入っているか       → 右上の丸（アカウント）。名前・メール・ログアウト・設定
 *   ③ 他のアプリへの移り方   → 右上の「アプリ一覧」。その人が開けるアプリだけを出す（appListedFor）
 *   ④ 何ができてどう操作するか → 右上の「？」。マニュアル 2 軸（A できることの一覧・B 画面の上の操作の案内）
 *
 * 開ける・開けないは新しく作らない。ポータル（portal.shia2n.jp）の管理の画面にある切り替えと、共通の門番（AuthGuard）の決まりをそのまま読む
 *   （appListedFor の注を見る）。アプリ一覧は「出すかどうか」だけで、入れるかを決めるのは行き先のアプリの門番。
 *
 * React を使わない（思考整理くんの画面は素の JS のため）。見た目は Shadow DOM の中に閉じ、色はアプリの CSS 変数を読む。
 * 開く窓（メニュー・マニュアル・案内）は、外を押す・Esc・別の物を開く、のどれでも閉じ、閉じたら押したボタンへ戻る。
 */
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { APP_ICONS, hostOf, iconSvg } from "./icons.js";
import { appListedFor } from "./app-access.js";
import { ALL_APPS, readRecent, touchRecent, sortByRecent } from "./all-apps.js";

export const PORTAL_URL = "https://portal.shia2n.jp";
/** 「会員の目で見る」で使う見え方：しあらぼ生（basic）・個別許可なし。生徒の大半がこの形（2026-10-26 実測） */
export const MEMBER_PREVIEW = Object.freeze({ role: "user", paymentStatus: "basic", allowedApps: [] });

const T = (s) => String(s ?? "").trim();

/* 「開けるアプリ」の判定は shell/app-access.js の 1 本（ポータルの会員の画面も同じものを読む） */
export { appListedFor };

/** タブの名前。アプリ名は入れない（アプリはファビコンで示す・2026-10-26 Naoki OK） */
export function setTabTitle(name, fallback) {
  const v = T(name);
  document.title = v || T(fallback) || "";
}

/** ポータルの切り替えを読む既定の口（試験のときは cfg.source で差し替える） */
const firebaseSource = {
  user: () => auth.currentUser,
  async profile(uid) {
    const s = await getDoc(doc(db, "users", uid));
    return s.exists() ? s.data() : null;
  },
  async apps() {
    const q = query(collection(db, "apps"), where("isActive", "==", true));
    const r = await getDocs(q);
    return r.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async signOut() { await signOut(auth); },
  watch(cb) { return onAuthStateChanged(auth, cb); },
};

/* 置き場の取り出しも try の中で行う（サイトのデータを止めたブラウザでは、localStorage に触るだけで止まるため） */
const store = {
  get(k, session) { try { return (session ? sessionStorage : localStorage).getItem(k); } catch { return null; } },
  set(k, v, session) { try { const a = session ? sessionStorage : localStorage; if (v == null) a.removeItem(k); else a.setItem(k, v); } catch { /* 保存できない環境でも画面は動かす */ } },
};

const SVG = {
  help: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.3"/><path d="M6.2 6.2a1.9 1.9 0 0 1 3.6.7c0 1.3-1.8 1.6-1.8 2.7"/><path d="M8 11.6h.01"/></svg>',
  apps: '<svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="3.5" r="1.35"/><circle cx="8" cy="3.5" r="1.35"/><circle cx="12.5" cy="3.5" r="1.35"/><circle cx="3.5" cy="8" r="1.35"/><circle cx="8" cy="8" r="1.35"/><circle cx="12.5" cy="8" r="1.35"/><circle cx="3.5" cy="12.5" r="1.35"/><circle cx="8" cy="12.5" r="1.35"/><circle cx="12.5" cy="12.5" r="1.35"/></svg>',
  close: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  out: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 3h4v4M13 3L7.5 8.5M12 9.5V13H3V4h3.5"/></svg>',
  chev: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 3.5L10.5 8 6 12.5"/></svg>',
  back: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>',
  eye: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  gear: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1"/></svg>',
  logout: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6M10.5 11l3-3-3-3M13.5 8H6"/></svg>',
  book: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 3h4a1.5 1.5 0 0 1 1.5 1.5V13a1.2 1.2 0 0 0-1.2-1.2H2.5zM13.5 3h-4A1.5 1.5 0 0 0 8 4.5V13a1.2 1.2 0 0 1 1.2-1.2h4.3z"/></svg>',
};

const CSS = `
:host{all:initial;font-family:var(--f-body,"Geist","Hiragino Sans","Noto Sans JP",system-ui,sans-serif);color:var(--fg,#1a1a1a);font-size:14px;line-height:1.5}
*,*::before,*::after{box-sizing:border-box}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
a{color:inherit}
[hidden]{display:none!important}
:focus-visible{outline:2px solid var(--accent,#f59e0b);outline-offset:2px;border-radius:8px}
.bar{display:flex;align-items:center;gap:2px}
.ib{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:var(--muted,#6b6259)}
.ib:hover,.ib[aria-expanded="true"]{background:var(--soft,#f7f3ee);color:var(--fg,#1a1a1a)}
.av{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;margin-left:4px;overflow:hidden;background:var(--ink,#1a1a1a);color:var(--on-ink,#fff);font-weight:700;font-size:13px;box-shadow:0 0 0 2px var(--panel,#fff),0 0 0 3px var(--line,#e6dfd6)}
.av img{width:100%;height:100%;object-fit:cover;display:block}
.av.member{box-shadow:0 0 0 2px var(--panel,#fff),0 0 0 4px var(--accent,#f59e0b)}
.pill{font-size:11.5px;font-weight:700;padding:4px 9px;border-radius:999px;background:var(--accent-bg,#fef3c7);color:var(--accent-ink,#b45309);margin-right:6px;white-space:nowrap}
@media (max-width:640px){.wide{display:none}}

.pop:focus,.drawer:focus,.bub:focus{outline:none}
.pop{position:fixed;z-index:2147483000;min-width:280px;max-width:min(340px,calc(100vw - 16px));max-height:calc(100vh - 80px);overflow:auto;background:var(--panel,#fff);border:1px solid var(--line,#e6dfd6);border-radius:14px;box-shadow:var(--shadow,0 1px 2px rgba(60,40,20,.05),0 8px 24px rgba(60,40,20,.09));padding:6px}
.ph{font-size:11px;font-weight:700;color:var(--faint,#a8a09a);padding:8px 10px 4px;letter-spacing:.02em}
.pn{font-size:12px;color:var(--muted,#6b6259);padding:4px 10px 8px}
.sep{height:1px;background:var(--line,#e6dfd6);margin:6px 4px}
.it{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:8px 10px;border-radius:8px;font-size:13.5px;text-decoration:none;color:var(--fg,#1a1a1a)}
.it:hover,.it:focus-visible{background:var(--soft,#f7f3ee)}
.it .i{width:22px;display:grid;place-items:center;flex:none;color:var(--muted,#6b6259)}
.it .l{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.it .r{font-size:11.5px;color:var(--faint,#a8a09a);display:flex;align-items:center;gap:4px;flex:none}
.it.cur{background:var(--accent-bg,#fef3c7)}
.it.cur .r{color:var(--accent-ink,#b45309);font-weight:700}
.it.danger{color:var(--danger,#dc2626)}.it.danger .i{color:var(--danger,#dc2626)}
.me{display:flex;align-items:center;gap:12px;padding:10px 10px 12px}
.me .av{width:40px;height:40px;margin:0;font-size:16px;cursor:default}
.me .nm{font-weight:700;font-size:14.5px}
.me .em{font-size:12px;color:var(--muted,#6b6259);word-break:break-all}
.sw{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:8px 10px;border-radius:8px;font-size:13.5px}
.sw:hover{background:var(--soft,#f7f3ee)}
.sw .i{width:22px;display:grid;place-items:center;color:var(--muted,#6b6259)}
.sw .l{flex:1}
.tg{width:34px;height:20px;border-radius:999px;background:var(--line,#e6dfd6);position:relative;flex:none;transition:background .15s}
.tg::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--panel,#fff);box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .15s}
.sw[aria-checked="true"] .tg{background:var(--accent,#f59e0b)}
.sw[aria-checked="true"] .tg::after{left:16px}
.seg{display:flex;gap:4px;padding:2px 10px 10px}
.seg button{flex:1;font-size:12.5px;font-weight:600;padding:7px 0;border-radius:8px;border:1px solid var(--line,#e6dfd6);color:var(--muted,#6b6259);background:var(--panel,#fff)}
.seg button[aria-pressed="true"]{background:var(--ink,#1a1a1a);color:var(--on-ink,#fff);border-color:var(--ink,#1a1a1a)}
.back{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted,#6b6259);padding:6px 10px;border-radius:8px}
.back:hover{background:var(--soft,#f7f3ee)}
.ai{display:grid;place-items:center;width:22px;height:22px;flex:none}

.scrim{position:fixed;inset:0;z-index:2147482900;background:rgba(20,14,8,.32)}
.drawer{position:fixed;top:0;right:0;bottom:0;z-index:2147483000;width:min(440px,100vw);background:var(--panel,#fff);border-left:1px solid var(--line,#e6dfd6);box-shadow:var(--shadow,0 8px 24px rgba(60,40,20,.09));display:flex;flex-direction:column}
.dh{display:flex;align-items:center;gap:10px;padding:14px 12px 10px 18px}
.dh .t{font-weight:800;font-size:18px;letter-spacing:-.01em;flex:1}
.dh .t small{display:block;font-size:11.5px;font-weight:600;color:var(--faint,#a8a09a);letter-spacing:0}
.tabs{display:flex;gap:4px;padding:0 14px;border-bottom:1px solid var(--line,#e6dfd6)}
.tab{font-size:13px;font-weight:700;padding:10px 10px;color:var(--muted,#6b6259);border-bottom:2px solid transparent;margin-bottom:-1px}
.tab[aria-selected="true"]{color:var(--fg,#1a1a1a);border-color:var(--accent,#f59e0b)}
.db{flex:1;overflow:auto;padding:14px 18px 28px}
.intro{font-size:13px;color:var(--muted,#6b6259);margin:0 0 14px}
.sec{margin:0 0 18px}
.sec h3{font-size:12px;font-weight:800;color:var(--faint,#a8a09a);margin:0 0 6px;letter-spacing:.03em}
.mi{padding:9px 0;border-bottom:1px solid var(--hair,#f3eee8)}
.mi:last-child{border-bottom:0}
.mi .h{font-size:13.5px;font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.mi .d{font-size:12.5px;color:var(--muted,#6b6259);margin-top:2px}
.kb{font-family:var(--f-mono,ui-monospace,Menlo,monospace);font-size:10.5px;border:1px solid var(--line,#e6dfd6);border-bottom-width:2px;border-radius:5px;padding:0 5px;background:var(--panel,#fff);color:var(--muted,#6b6259);font-weight:500}
.own{font-size:10.5px;font-weight:700;color:var(--accent-ink,#b45309);background:var(--accent-bg,#fef3c7);border-radius:4px;padding:0 5px}
details{border:1px solid var(--line,#e6dfd6);border-radius:12px;padding:4px 12px;margin-top:4px}
summary{cursor:pointer;font-size:13px;font-weight:700;padding:8px 0}
.kr{display:flex;gap:10px;align-items:baseline;padding:4px 0;font-size:12.5px}
.kr .kb{flex:none}
.kg{font-size:11px;font-weight:800;color:var(--faint,#a8a09a);margin:10px 0 2px}
.card{border:1px solid var(--line,#e6dfd6);border-radius:12px;padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start}
.card .n{width:26px;height:26px;border-radius:50%;background:var(--accent-bg,#fef3c7);color:var(--accent-ink,#b45309);display:grid;place-items:center;font-weight:800;font-size:12.5px;flex:none}
.card .b{flex:1;min-width:0}
.card .h{font-weight:700;font-size:14px}
.card .d{font-size:12.5px;color:var(--muted,#6b6259);margin:2px 0 8px}
.go{background:var(--ink,#1a1a1a);color:var(--on-ink,#fff);font-weight:700;font-size:12.5px;padding:7px 12px;border-radius:8px}
.go:hover{opacity:.88}
.ghost{font-size:12.5px;font-weight:600;border:1px solid var(--line,#e6dfd6);border-radius:8px;padding:6px 11px;background:var(--panel,#fff);color:var(--muted,#6b6259)}
.ghost:hover{background:var(--soft,#f7f3ee);color:var(--fg,#1a1a1a)}

.tour{position:fixed;inset:0;z-index:2147483100}
.spot{position:fixed;border-radius:10px;box-shadow:0 0 0 9999px rgba(20,14,8,.55);pointer-events:none;transition:all .2s ease;outline:2px solid var(--accent,#f59e0b);outline-offset:2px}
.spot.none{box-shadow:0 0 0 9999px rgba(20,14,8,.55);outline:0;width:0;height:0;left:50%;top:40%}
.bub{position:fixed;width:min(320px,calc(100vw - 24px));background:var(--panel,#fff);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.25);padding:14px 16px 12px}
.bub .k{font-size:11px;font-weight:700;color:var(--faint,#a8a09a)}
.bub .h{font-weight:800;font-size:15px;margin:2px 0 4px}
.bub .d{font-size:13px;color:var(--muted,#6b6259);white-space:pre-line}
.bub .row{display:flex;align-items:center;gap:6px;margin-top:12px}
.bub .row .grow{flex:1}
.hint{position:fixed;z-index:2147483000;width:250px;background:var(--ink,#1a1a1a);color:var(--on-ink,#fff);border-radius:12px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:13px}
.hint .row{display:flex;gap:6px;margin-top:10px;justify-content:flex-end}
.hint .go{background:var(--accent,#f59e0b);color:#1a1a1a}
.hint .ghost{background:transparent;color:inherit;border-color:rgba(255,255,255,.35)}
.hint::before{content:"";position:absolute;top:-6px;right:var(--ax,16px);width:12px;height:12px;background:inherit;transform:rotate(45deg);border-radius:2px}
`;

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

/**
 * 外枠を作る。返した shell.attach(要素) で、右上のボタンをその要素の中へ置く（画面ごとに置き場所が違うアプリは呼び直す）。
 *
 * cfg = {
 *   appId, appName,                         // アプリの名前（マニュアルの見出しと「いま開いている」に出す）
 *   host,                                   // 省略可。住所が本番と違う画面（試験など）で、どのアプリかを決める
 *   manual: { intro, sections:[{title, items:[{t, d, keys?:[], who?:'admin'}]}] },  // A できることの一覧
 *   keys:   [[まとまり, キー, すること], …],  // A の最後に出すキーボードの近道（アプリの一覧をそのまま渡す）
 *   tours:  [{id, title, desc, steps:[{el, title, body, before?}] , before?}],      // B 操作の案内
 *   settings: [{label, note, run(anchor)}],  // アプリ固有の設定（見た目は外枠が持つ）
 *   onViewChange(isMember),                 // 「会員の目で見る」を切り替えたとき
 *   beforeSignOut(),                         // ログアウトの前に待つ（保存を出し切る）。false を返すとログアウトを止める
 *   source,                                 // 試験用の差し替え（user・profile・apps・signOut・watch）
 * }
 */
export function mountAppShell(cfg = {}) {
  const src = { ...firebaseSource, ...(cfg.source || {}) };
  const appId = T(cfg.appId) || "app";
  const appName = T(cfg.appName) || appId;
  const here = (T(cfg.host) || location.hostname).toLowerCase(); // 住所でアイコンと「いま開いている」を決める
  const VIEWKEY = "s2shell:viewas";
  const HINTKEY = "s2shell:hint:" + appId;
  const THEMEKEY = "s2shell:theme";
  touchRecent(here); // アプリ一覧の「最近開いた順」に使う（shell/all-apps.js）

  /* 見た目（自動・明るい・暗い）。アプリの CSS は data-theme を読む（作り方の 1 枚 §5）。覚えるのはアプリの住所ごと */
  const applyTheme = (v) => { if (v === "light" || v === "dark") document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme; };
  { const t = store.get(THEMEKEY); if (t === "light" || t === "dark") applyTheme(t); }

  /* ---- 右上のボタン（置き場所に入る側） ---- */
  const slotHost = h("div", { class: "s2-shell", style: "display:contents" });
  const sr = slotHost.attachShadow({ mode: "open" });
  sr.append(h("style", { html: CSS }));
  const pill = h("button", { class: "pill", type: "button", hidden: true, title: "押すと自分の見え方に戻ります" }, "会員の目");
  const bHelp = h("button", { class: "ib wide", type: "button", "aria-label": "使い方（マニュアル）", title: "使い方（マニュアル）", "aria-haspopup": "dialog", "aria-expanded": "false", html: SVG.help });
  const bApps = h("button", { class: "ib wide", type: "button", "aria-label": "アプリ一覧", title: "アプリ一覧", "aria-haspopup": "dialog", "aria-expanded": "false", html: SVG.apps });
  const bMe = h("button", { class: "av", type: "button", "aria-label": "アカウント", "aria-haspopup": "dialog", "aria-expanded": "false" });
  sr.append(h("div", { class: "bar" }, pill, bHelp, bApps, bMe));

  /* ---- 浮かぶもの（body の直下・どの画面の重なりにも負けないように） ---- */
  const layerHost = h("div", { class: "s2-shell-layer" });
  const lr = layerHost.attachShadow({ mode: "open" });
  lr.append(h("style", { html: CSS }));
  document.body.appendChild(layerHost);

  let user = null, profile = null, apps = null, appsErr = null, loading = null;
  let memberView = store.get(VIEWKEY, true) === "1";
  const isAdmin = () => !!profile && profile.role === "admin";
  const viewing = () => (isAdmin() && memberView ? MEMBER_PREVIEW : profile);
  const asMember = () => !isAdmin() || memberView;

  function nameOf() {
    const u = user || {};
    return T(u.displayName) || T(profile?.displayName) || T(profile?.nickname) || T((u.email || "").split("@")[0]) || "ログイン中";
  }
  function paintMe() {
    bMe.innerHTML = "";
    const u = user || {};
    if (u.photoURL) bMe.append(h("img", { src: u.photoURL, alt: "", referrerpolicy: "no-referrer" }));
    else bMe.append(nameOf().slice(0, 1));
    bMe.title = nameOf() + (u.email ? "（" + u.email + "）" : "");
    bMe.classList.toggle("member", isAdmin() && memberView);
    pill.hidden = !(isAdmin() && memberView);
  }

  async function load(force) {
    if (loading && !force) return loading;
    loading = (async () => {
      user = src.user();
      paintMe();
      try {
        if (user && user.uid) profile = (await src.profile(user.uid)) || {};
        paintMe();
      } catch { profile = profile || {}; }
      try { apps = await src.apps(); appsErr = null; } catch (e) { apps = null; appsErr = e; }
    })();
    return loading;
  }

  /* ---- 開く窓の共通（1 つだけ開く・外を押す/Esc/別の物を開くで閉じる・閉じたら押したボタンへ戻る） ---- */
  let open = null; // { el, trigger, onClose }
  function close(reason) {
    if (!open) return;
    const o = open; open = null;
    o.els.forEach((e) => e.remove());
    if (o.trigger) o.trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    if (o.onClose) o.onClose();
    const back = () => { if (o.trigger && o.trigger.isConnected) o.trigger.focus(); };
    if (reason === "esc" || reason === "done") back();
    /* 外を押したときは、押した先がフォーカスを取らなかった場合だけボタンへ戻す（書く欄を押した人の邪魔をしない） */
    else if (reason === "outside") setTimeout(() => { const a = document.activeElement; if (!a || a === document.body) back(); }, 0);
  }
  function onDown(e) {
    if (!open) return;
    const path = e.composedPath();
    if (open.els.some((x) => path.includes(x))) return;
    if (open.trigger && path.includes(open.trigger)) return; // 同じボタンは自分の click で閉じる
    close("outside");
  }
  function onKey(e) {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (open.esc) open.esc(); else close("esc"); return; }
    /* 案内とマニュアルの中では Tab が外へ出ないようにする（外に出ると、押したキーが後ろの画面に効くため） */
    if (e.key === "Tab" && open.trap) {
      const f = [...open.trap().querySelectorAll("button:not([disabled]),a[href],input,textarea,select,summary")].filter((x) => x.offsetParent !== null || x.getClientRects().length);
      if (!f.length) { e.preventDefault(); return; }
      const i = f.indexOf(lr.activeElement);
      e.preventDefault(); e.stopPropagation();
      f[(i < 0 ? 0 : i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      return;
    }
    if (open.keys) open.keys(e);
    /* 外枠の中から来たキーは各ホストで止める。それ以外（窓の中の字を押してフォーカスが外れたときなど）はここで止める */
    if (open && !e.composedPath().some((n) => n === layerHost || n === slotHost)) e.stopPropagation();
  }
  function onResize() { if (open && open.place) open.place(); }
  function show(els, trigger, opts = {}) {
    close();
    dismissHint(); // 何かを開いた人には、もう「はじめての方へ」は要らない
    open = { els, trigger, ...opts };
    els.forEach((e) => lr.appendChild(e));
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    setTimeout(() => {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("resize", onResize);
    }, 0);
    if (open.place) open.place();
    /* 窓の中の字を押してもフォーカスを窓に残す（外へ落ちると Tab やキーが後ろの画面に効くため） */
    els.forEach((el) => {
      if (!el.hasAttribute("tabindex") && !el.classList.contains("scrim")) el.setAttribute("tabindex", "-1");
      el.addEventListener("pointerdown", (e) => {
        const t = e.composedPath()[0];
        if (t && t.closest && !t.closest("button,a,input,textarea,select,summary,[tabindex]:not([tabindex='-1'])")) setTimeout(() => { const box = t.closest("[tabindex='-1']"); if (box && !box.contains(lr.activeElement)) box.focus({ preventScroll: true }); }, 0);
      });
    });
  }
  const isOpenFrom = (t) => open && open.trigger === t;

  /* ---- 小さなメニュー（アプリ一覧・アカウント） ---- */
  function popover(trigger, build) {
    if (isOpenFrom(trigger)) { close("esc"); return; }
    const pop = h("div", { class: "pop", role: "dialog" });
    const stack = [];
    const draw = (b) => { pop.innerHTML = ""; b(pop, drill); };
    const drill = (b) => { stack.push(build); build = b; draw(b); focusFirst(); };
    const up = () => { const b = stack.pop(); if (b) { build = b; draw(b); focusFirst(); } };
    const focusFirst = () => { const f = pop.querySelector("button,a"); if (f) f.focus(); };
    const place = () => {
      const r = trigger.getBoundingClientRect();
      const w = pop.offsetWidth, ht = pop.offsetHeight;
      let x = Math.min(r.right - w, innerWidth - w - 8); x = Math.max(8, x);
      let y = r.bottom + 6; if (y + ht > innerHeight - 8) y = Math.max(8, innerHeight - ht - 8);
      pop.style.left = x + "px"; pop.style.top = y + "px";
    };
    draw(build);
    show([pop], trigger, {
      place,
      esc: () => { if (stack.length) up(); else close("esc"); },
      keys: (e) => {
        const items = [...pop.querySelectorAll("button,a")];
        const i = items.indexOf(lr.activeElement);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault(); e.stopPropagation();
          const n = i < 0 ? 0 : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[n] && items[n].focus();
        } else if (e.key === "ArrowLeft" && stack.length) { e.preventDefault(); up(); }
      },
    });
    pop._up = up;
    setTimeout(focusFirst, 0);
  }
  const item = (icon, label, right, on, cls) =>
    h("button", { class: "it" + (cls ? " " + cls : ""), type: "button", onclick: on }, h("span", { class: "i", html: icon || "" }), h("span", { class: "l" }, label), right ? h("span", { class: "r", html: right }) : null);
  const back = (p) => h("button", { class: "back", type: "button", onclick: () => p._up && p._up(), html: SVG.back + "<span>戻る</span>" });

  function appsBuild(p) {
    p.append(h("div", { class: "ph" }, asMember() ? "開けるアプリ" : "全アプリ（最近開いた順）"));
    const curHost = here;
    const cur = h("div", { class: "it cur", "aria-current": "page" }, h("span", { class: "ai", html: iconSvg(curHost, 22) }), h("span", { class: "l" }, appName), h("span", { class: "r" }, "いま開いています"));
    p.append(cur);
    if (appsErr && !p._retried) { p._retried = true; appsErr = null; apps = null; load(true).then(() => { if (open && open.trigger === bApps) { p.innerHTML = ""; appsBuild(p); if (open.place) open.place(); } }); }
    if (!apps && !appsErr) {
      p.append(h("div", { class: "pn" }, "読み込み中…"));
      if (!p._retried) load().then(() => { if (open && open.trigger === bApps) { p.innerHTML = ""; appsBuild(p); if (open.place) open.place(); } });
    } else if (appsErr) {
      p.append(h("div", { class: "pn" }, "ポータルのアプリの設定を読めませんでした。少し待ってから開き直すか、下のポータルから選んでください。"));
    } else {
      const v = viewing();
      const seen = new Set([curHost]);
      const items = [];
      apps.filter((a) => appListedFor(v, a)).forEach((a) => {
        const host = hostOf(a.url);
        if (!host || seen.has(host)) return;
        seen.add(host);
        items.push({ host, url: T(a.url), desc: T(a.description), name: (APP_ICONS[host] || {}).name || T(a.name) || "アプリ" });
      });
      /* 管理者が自分の目で見ているときだけ、ポータルの設定に無いアプリも名簿から足す（会員の見え方は変えない） */
      if (!asMember()) ALL_APPS.forEach((x) => {
        if (seen.has(x.host)) return;
        seen.add(x.host);
        items.push({ host: x.host, url: x.host, desc: "", name: (APP_ICONS[x.host] || {}).name || x.name });
      });
      const list = sortByRecent(items, readRecent());
      if (!list.length) p.append(h("div", { class: "pn" }, "ほかに開けるアプリはありません。"));
      list.forEach(({ host, url: u, desc, name }) => {
        let url = u; if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        p.append(h("a", { class: "it", href: url, title: desc || name, onclick: () => touchRecent(host) }, h("span", { class: "ai", html: iconSvg(host, 22) }), h("span", { class: "l" }, name)));
      });
    }
    p.append(h("div", { class: "sep" }));
    p.append(h("a", { class: "it", href: PORTAL_URL, target: "_blank", rel: "noopener" }, h("span", { class: "i", html: SVG.out }), h("span", { class: "l" }, "ポータルを開く（教材とアプリの入口）")));
    if (isAdmin() && memberView) p.append(h("div", { class: "pn" }, "会員の目で見ています（しあらぼ生・個別許可なし）。"));
  }

  function settingsBuild(p) {
    p.append(back(p), h("div", { class: "ph" }, "見た目"));
    const now = store.get(THEMEKEY) || "auto";
    const seg = h("div", { class: "seg", role: "group", "aria-label": "見た目" });
    [["auto", "自動"], ["light", "明るい"], ["dark", "暗い"]].forEach(([k, l]) => {
      seg.append(h("button", { type: "button", "aria-pressed": String(now === k), onclick: () => { store.set(THEMEKEY, k === "auto" ? null : k); applyTheme(k); p.innerHTML = ""; settingsBuild(p); } }, l));
    });
    p.append(seg);
    const extra = Array.isArray(cfg.settings) ? cfg.settings : [];
    if (extra.length) {
      p.append(h("div", { class: "ph" }, appName + " の設定"));
      extra.forEach((s) => {
        const b = item("", s.label, "", () => { close("done"); setTimeout(() => s.run && s.run(bMe), 0); });
        if (s.note) b.title = s.note;
        p.append(b);
      });
    }
  }

  function meBuild(p, drill) {
    const u = user || {};
    const av = h("span", { class: "av" + (isAdmin() && memberView ? " member" : "") });
    if (u.photoURL) av.append(h("img", { src: u.photoURL, alt: "", referrerpolicy: "no-referrer" })); else av.append(nameOf().slice(0, 1));
    p.append(h("div", { class: "me" }, av, h("div", null, h("div", { class: "nm" }, nameOf()), u.email ? h("div", { class: "em" }, u.email) : null)));
    if (isAdmin()) {
      const sw = h("button", { class: "sw", type: "button", role: "switch", "aria-checked": String(memberView), onclick: () => setMemberView(!memberView) },
        h("span", { class: "i", html: SVG.eye }), h("span", { class: "l" }, "会員の目で見る"), h("span", { class: "tg" }));
      p.append(sw, h("div", { class: "pn" }, "アプリ一覧とマニュアルが、しあらぼ生（個別許可なし）の見え方になります。管理者にだけ出ます。"));
    }
    p.append(h("div", { class: "sep" }));
    p.append(item(SVG.book, "使い方（マニュアル）", "", () => { close(); openManual("a", bMe); }));
    p.append(item(SVG.apps, "アプリ一覧", SVG.chev, () => drill((q) => { q.append(back(q)); appsBuild(q); })));
    p.append(item(SVG.gear, "設定", SVG.chev, () => drill(settingsBuild)));
    p.append(h("div", { class: "sep" }));
    const lo = item(SVG.logout, "ログアウト", "このアプリだけ", async () => {
      if (lo.disabled) return;
      lo.disabled = true;
      /* アプリに保存待ちの変更があれば、出し切ってからログアウトする（書いた分を落とさないため） */
      let ok = true;
      try { if (cfg.beforeSignOut) ok = (await cfg.beforeSignOut()) !== false; } catch { ok = false; }
      if (!ok) {
        lo.disabled = false;
        if (!p.querySelector(".lo-note")) lo.after(h("div", { class: "pn lo-note" }, "保存が終わっていない変更があるので、ログアウトを止めました。通信が戻ってから、もう一度押してください。"));
        return;
      }
      close();
      try { await src.signOut(); } finally { location.reload(); }
    }, "danger");
    lo.title = "このアプリからログアウトします。ほかのアプリは、それぞれで押してください";
    p.append(lo);
  }

  function setMemberView(on) {
    memberView = !!on;
    store.set(VIEWKEY, memberView ? "1" : null, true);
    paintMe();
    if (open && open.trigger === bMe) { close(); popover(bMe, meBuild); setTimeout(() => { const sw = open && open.els[0].querySelector(".sw"); if (sw) sw.focus(); }, 10); }
    if (cfg.onViewChange) try { cfg.onViewChange(memberView); } catch { /* アプリ側の失敗で外枠を止めない */ }
  }

  /* ---- マニュアル（A できることの一覧・B 操作の案内） ---- */
  let lastTab = "a";
  function openManual(tab, trigger = bHelp) {
    if (isOpenFrom(trigger) && open.kind === "manual") { close("esc"); return; }
    dismissHint();
    lastTab = tab || lastTab;
    const scrim = h("div", { class: "scrim", onclick: () => close("outside") });
    const dr = h("aside", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": appName + " の使い方" });
    const x = h("button", { class: "ib", type: "button", "aria-label": "閉じる", title: "閉じる（Esc）", html: SVG.close, onclick: () => close("esc") });
    dr.append(h("div", { class: "dh" }, h("span", { class: "ai", html: iconSvg(here, 26) }), h("div", { class: "t" }, "使い方", h("small", null, appName)), x));
    const tA = h("button", { class: "tab", type: "button", role: "tab" }, "できること");
    const tB = h("button", { class: "tab", type: "button", role: "tab" }, "操作の案内");
    dr.append(h("div", { class: "tabs", role: "tablist" }, tA, tB));
    const body = h("div", { class: "db" });
    dr.append(body);
    const paint = () => {
      tA.setAttribute("aria-selected", String(lastTab === "a")); tB.setAttribute("aria-selected", String(lastTab === "b"));
      body.innerHTML = ""; body.scrollTop = 0;
      if (lastTab === "a") paintA(body); else paintB(body);
    };
    tA.onclick = () => { lastTab = "a"; paint(); };
    tB.onclick = () => { lastTab = "b"; paint(); };
    paint();
    show([scrim, dr], trigger, { kind: "manual", trap: () => dr });
    setTimeout(() => (lastTab === "a" ? tA : tB).focus(), 0);
  }
  function paintA(body) {
    const m = cfg.manual || {};
    if (m.intro) body.append(h("p", { class: "intro" }, m.intro));
    const showAdmin = !asMember();
    (m.sections || []).forEach((s) => {
      const its = (s.items || []).filter((x) => x.who !== "admin" || showAdmin);
      if (!its.length) return;
      const sec = h("div", { class: "sec" }, h("h3", null, s.title));
      its.forEach((x) => {
        const hd = h("div", { class: "h" }, x.t);
        (x.keys || []).forEach((k) => hd.append(h("span", { class: "kb" }, k)));
        if (x.who === "admin") hd.append(h("span", { class: "own" }, "管理者だけ"));
        sec.append(h("div", { class: "mi" }, hd, x.d ? h("div", { class: "d" }, x.d) : null));
      });
      body.append(sec);
    });
    if (Array.isArray(cfg.keys) && cfg.keys.length) {
      const det = h("details", null, h("summary", null, "キーボードの近道（全部）"));
      let g = "";
      cfg.keys.forEach(([grp, k, what]) => {
        if (grp !== g) { det.append(h("div", { class: "kg" }, grp)); g = grp; }
        det.append(h("div", { class: "kr" }, h("span", { class: "kb" }, k), h("span", null, what)));
      });
      body.append(det);
    }
  }
  function paintB(body) {
    body.append(h("p", { class: "intro" }, "画面の上で、押す場所を順に示します。案内の途中は画面を触れません（読むだけ）。Esc か外を押すと終わります。"));
    (cfg.tours || []).forEach((t, i) => {
      body.append(h("div", { class: "card" },
        h("span", { class: "n" }, String(i + 1)),
        h("div", { class: "b" }, h("div", { class: "h" }, t.title), h("div", { class: "d" }, (t.desc || "") + "（" + t.steps.length + " 手）"),
          h("button", { class: "go", type: "button", onclick: () => startTour(t.id) }, "始める"))));
    });
  }

  /* ---- 操作の案内（押す場所を順に光らせる） ---- */
  async function startTour(id) {
    const t = (cfg.tours || []).find((x) => x.id === id);
    if (!t) return;
    close();
    if (t.before) {
      let r;
      try { r = await t.before(); } catch (e) { r = String(e && e.message || e); }
      if (typeof r === "string") { tourMessage(t, r); return; }
    }
    let i = 0;
    const wrap = h("div", { class: "tour", role: "dialog", "aria-modal": "true", "aria-label": t.title });
    const spot = h("div", { class: "spot" });
    const bub = h("div", { class: "bub" });
    wrap.append(spot, bub);
    const find = (s) => {
      let el = null;
      try { el = typeof s.el === "function" ? s.el() : s.el ? document.querySelector(s.el) : null; } catch { el = null; }
      if (el && !(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) el = null;
      return el;
    };
    const place = () => {
      const s = t.steps[i]; const el = find(s);
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        const r = el.getBoundingClientRect(); const pad = 6;
        spot.className = "spot";
        Object.assign(spot.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
        const bw = bub.offsetWidth, bh = bub.offsetHeight;
        let y = r.bottom + 14; if (y + bh > innerHeight - 12) y = r.top - bh - 14;
        if (y < 12) y = Math.min(innerHeight - bh - 12, Math.max(12, r.top + r.height / 2 - bh / 2));
        let x = r.left + r.width / 2 - bw / 2;
        if (y > r.top - bh && y < r.bottom && r.right + 14 + bw < innerWidth) x = r.right + 14;
        x = Math.max(12, Math.min(x, innerWidth - bw - 12));
        bub.style.left = x + "px"; bub.style.top = y + "px";
      } else {
        spot.className = "spot none"; spot.removeAttribute("style");
        bub.style.left = Math.max(12, innerWidth / 2 - bub.offsetWidth / 2) + "px";
        bub.style.top = Math.max(12, innerHeight * 0.35 - bub.offsetHeight / 2) + "px";
      }
    };
    const paint = async () => {
      const s = t.steps[i];
      if (s.before) { try { await s.before(); } catch { /* 準備に失敗しても案内は続ける（光らせる先が無ければ真ん中に出す） */ } }
      bub.innerHTML = "";
      const last = i === t.steps.length - 1;
      const prev = h("button", { class: "ghost", type: "button", disabled: i === 0 ? true : null, onclick: () => { if (i > 0) { i--; paint(); } } }, "戻る");
      const next = h("button", { class: "go", type: "button", onclick: () => { if (last) close("done"); else { i++; paint(); } } }, last ? "終わる" : "次へ");
      bub.append(h("div", { class: "k" }, t.title + "　" + (i + 1) + " / " + t.steps.length), h("div", { class: "h" }, s.title), h("div", { class: "d" }, s.body),
        h("div", { class: "row" }, h("button", { class: "ghost", type: "button", onclick: () => close("esc") }, "やめる"), h("span", { class: "grow" }), prev, next));
      requestAnimationFrame(() => { place(); next.focus(); });
    };
    wrap.addEventListener("pointerdown", (e) => { if (!e.composedPath().includes(bub)) { e.preventDefault(); close("outside"); } });
    show([wrap], bHelp, {
      kind: "tour", place, trap: () => bub,
      keys: (e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); if (i < t.steps.length - 1) { i++; paint(); } }
        else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); if (i > 0) { i--; paint(); } }
        else if (!["Tab", "Enter", " "].includes(e.key)) { e.stopPropagation(); }
      },
    });
    paint();
  }
  function tourMessage(t, msg) {
    const wrap = h("div", { class: "tour", role: "dialog", "aria-modal": "true" });
    const bub = h("div", { class: "bub" }, h("div", { class: "k" }, t.title), h("div", { class: "d" }, msg),
      h("div", { class: "row" }, h("span", { class: "grow" }), h("button", { class: "go", type: "button", onclick: () => close("done") }, "閉じる")));
    wrap.append(h("div", { class: "spot none" }), bub);
    show([wrap], bHelp, { kind: "tour", trap: () => bub });
    requestAnimationFrame(() => {
      bub.style.left = Math.max(12, innerWidth / 2 - bub.offsetWidth / 2) + "px";
      bub.style.top = Math.max(12, innerHeight * 0.35 - bub.offsetHeight / 2) + "px";
      bub.querySelector(".go").focus();
    });
  }

  /* ---- はじめて開いた人へ：「？」の下に 1 回だけ出す ---- */
  let hintEl = null, hintT = null;
  function dismissHint() { if (hintEl) { hintEl.remove(); hintEl = null; } store.set(HINTKEY, "1"); }
  function maybeHint() {
    if (hintEl || store.get(HINTKEY) || open || !bHelp.isConnected) return;
    const target = bHelp.offsetParent ? bHelp : bMe;
    if (!target.isConnected || !target.getClientRects().length) return;
    const r = target.getBoundingClientRect();
    hintEl = h("div", { class: "hint", role: "status" }, "はじめての方へ。使い方と、画面の上の案内はここから開けます。",
      h("div", { class: "row" },
        h("button", { class: "ghost", type: "button", onclick: dismissHint }, "閉じる"),
        h("button", { class: "go", type: "button", onclick: () => { dismissHint(); openManual("b", bHelp); } }, "案内を見る")));
    lr.appendChild(hintEl);
    const w = 250; const x = Math.max(8, Math.min(r.right - w, innerWidth - w - 8));
    hintEl.style.left = x + "px"; hintEl.style.top = r.bottom + 10 + "px";
    hintEl.style.setProperty("--ax", Math.max(10, r.right - x - r.width / 2 - 6) + "px");
  }

  /* 外枠の中で押したキーは、アプリの画面へ流さない（Enter や Delete がマップの枝に効いてしまうため）。
     ボタンを押す・字を打つなど、外枠の中での働きはそのまま残る */
  const keep = (e) => e.stopPropagation();
  slotHost.addEventListener("keydown", keep);
  layerHost.addEventListener("keydown", keep);
  slotHost.addEventListener("keyup", keep);
  layerHost.addEventListener("keyup", keep);

  bHelp.addEventListener("click", () => openManual(lastTab, bHelp));
  bApps.addEventListener("click", () => popover(bApps, appsBuild));
  bMe.addEventListener("click", () => popover(bMe, meBuild));
  pill.addEventListener("click", () => setMemberView(false));

  load();
  let lastUid = null, unwatch = null;
  if (src.watch) { try { unwatch = src.watch((u) => { const id = u ? u.uid : null; if (id !== lastUid) { lastUid = id; load(true); } }); } catch { /* 見張れなくても最初の読みで動く */ } }

  return {
    /** 右上のボタンを el の中へ置く（画面を切り替えたら呼び直してよい） */
    attach(el) {
      if (!el) return;
      /* 置き場所を移すだけで、開いている窓（メニュー・マニュアル・案内）は閉じない。
         画面を描くたびに置き場所を作り直すアプリ（X攻略くん）では、閉じると案内の「始める」が何も起こさなくなるため（2026-10-27） */
      if (slotHost.parentNode !== el) { el.appendChild(slotHost); if (open && open.place) requestAnimationFrame(() => { if (open && open.place) open.place(); }); }
      if (hintEl) { hintEl.remove(); hintEl = null; } // 置き場所が変わったら、前の場所を指したままにしない
      clearTimeout(hintT);
      if (!store.get(HINTKEY)) hintT = setTimeout(maybeHint, 600);
    },
    setTitle: setTabTitle,
    openManual: (tab) => openManual(tab, bHelp),
    startTour,
    close: () => close(),
    isMemberView: () => isAdmin() && memberView,
    /** 外枠の窓（メニュー・マニュアル・案内）が開いているか。アプリのキーの処理で、開いている間は動かないために使う */
    isOpen: () => !!open,
    reload: () => load(true),
    /** React などで作り直すときは、前の外枠を必ず destroy する（2 つ並ばないため） */
    destroy() { close(); if (hintEl) { hintEl.remove(); hintEl = null; } clearTimeout(hintT); if (unwatch) unwatch(); slotHost.remove(); layerHost.remove(); },
  };
}

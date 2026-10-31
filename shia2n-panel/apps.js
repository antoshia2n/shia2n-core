/**
 * 統合パネルに並べるアプリ（2026-10-31 開発部・Naoki「OK」12:34）。
 * panel：パネルの中に細い画面を出すアプリ（押すと切り替わる）。tab：細い画面が無いので、押すと新しいタブで開くアプリ。
 * 地の色と絵は shia2n-core の shell/icons.js の写し（形の正本は開発部のプロジェクト資料 claude/icon-rules.md）。アプリを足したら 1 行足す。
 */
window.S2P_APPS = {
  panel: [
    { key: "swipe", name: "スワイプくん", url: "https://swipe.shia2n.jp/panel", open: "https://swipe.shia2n.jp/", color: "#2563eb", g: '<path d="M6 3.5h12v17l-6-4.2-6 4.2z"/><path d="M9.5 8.5h5M9.5 12h5"/>' },
    { key: "mindmap", name: "思考整理くん", url: "https://mindmap.shia2n.jp/panel", open: "https://mindmap.shia2n.jp/", color: "#7c3aed", g: '<circle cx="12" cy="12" r="2.6"/><circle cx="4.8" cy="5.5" r="1.9"/><circle cx="19.2" cy="5.5" r="1.9"/><circle cx="19.2" cy="18.5" r="1.9"/><path d="M10.1 10.3 6.2 6.9M13.9 10.3l3.9-3.4M13.9 13.7l3.9 3.4"/>' },
    { key: "contents", name: "コンテンツくん", url: "https://content-os.shia2n.jp/panel", open: "https://content-os.shia2n.jp/", color: "#ea580c", g: '<path d="M4.5 19.5h4l10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16.5z"/><path d="M14 7.5l3 3"/>' },
    { key: "xkoryaku", name: "X攻略くん", url: "https://x-koryaku.shia2n.jp/panel", open: "https://x-koryaku.shia2n.jp/", color: "#4d7c0f", g: '<path d="M4 19.5h16"/><path d="M5 15.5l4.5-5 3.5 3 6-7"/><circle cx="19" cy="6.5" r="1.4"/>' },
    { key: "shr", name: "しあらぼ管理", url: "https://shiarabo-admin.shia2n.jp/panel", open: "https://shiarabo-admin.shia2n.jp/", color: "#0d9488", g: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"/><circle cx="17" cy="9.5" r="2.3"/><path d="M16.5 14.2c2.5.2 4.2 2.4 4.2 5"/>' },
    { key: "taskmaster", name: "TaskMaster", url: "https://taskmaster.shia2n.jp/?view=panel", open: "https://taskmaster.shia2n.jp/", color: "#334155", g: '<path d="M4 6.5l2 2 3.5-3.5M4 14.5l2 2 3.5-3.5"/><path d="M13 7.5h7M13 15.5h7"/>' },
    { key: "kiroku", name: "記録くん", url: "https://kiroku.shia2n.jp/?view=panel", open: "https://kiroku.shia2n.jp/", color: "#4338ca", g: '<rect x="5" y="4" width="14" height="16.5" rx="2"/><path d="M8.5 2.8v3M15.5 2.8v3M8.5 10.5h7M8.5 14h7M8.5 17.5h4"/>' },
    { key: "fmore", name: "FMオレ", url: "https://fm-ore.pages.dev/", open: "https://fm-ore.pages.dev/", color: "#57534e", g: '<rect x="3.5" y="9" width="17" height="11.5" rx="2.2"/><path d="M7 9 17.5 3.5"/><circle cx="15.5" cy="14.75" r="2.6"/><path d="M6.8 13h4.2M6.8 16.5h4.2"/>' },
  ],
  tab: [
    { key: "haaku", name: "haAku", open: "https://haaku.shia2n.jp/", color: "#0284c7", g: '<path d="M3.8 16.5a8.2 8.2 0 0 1 16.4 0"/><path d="M12 16.5l4-5"/><circle cx="12" cy="16.5" r="1.4"/><path d="M3.5 20h17"/>' },
    { key: "note", name: "note攻略くん", open: "https://note-koryaku.shia2n.jp/", color: "#9f1239", g: '<path d="M6 3.5h8.5L18 7v13.5H6z"/><path d="M14.5 3.5V7H18"/><path d="M12 18c-2.6-1.7-4.2-3.2-4.2-4.9a2.1 2.1 0 0 1 4.2-.5 2.1 2.1 0 0 1 4.2.5c0 1.7-1.6 3.2-4.2 4.9z"/>' },
    { key: "sales", name: "売上管理", open: "https://sales-manager.shia2n.jp/", color: "#ca8a04", g: '<circle cx="12" cy="12" r="8.5"/><path d="M8.8 7.2 12 11.5l3.2-4.3M12 11.5v6M9.2 12.8h5.6M9.2 15.5h5.6"/>' },
    { key: "marke", name: "マーケくん", open: "https://lab.shia2n.jp/admin", color: "#c026d3", g: '<path d="M3.5 10v4a1 1 0 0 0 1 1H7l10 4.5v-15L7 9H4.5a1 1 0 0 0-1 1z"/><path d="M7.5 15l1.3 4.5h2.4l-1-3.6"/><path d="M20.5 10.2v3.6"/>' },
    { key: "asset", name: "AssetOS", open: "https://asset-os.shia2n.jp/", color: "#b45309", g: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.5l2 2h7.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>' },
    { key: "anken", name: "案件くん", open: "https://anken.shia2n.jp/", color: "#724128", g: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.6c0-.9.7-1.6 1.6-1.6h2.8c.9 0 1.6.7 1.6 1.6v1.9"/><path d="M3.5 12.5h17M12 11.3v2.4"/>' },
    { key: "okane", name: "お金を守るくん", open: "https://okane.shia2n.jp/", color: "#16724c", g: '<path d="M12 3.2 19 6v5.6c0 4.3-2.9 7.6-7 9.2-4.1-1.6-7-4.9-7-9.2V6z"/><path d="M9.4 8.2 12 11.6l2.6-3.4M12 11.6v4.9M9.8 12.9h4.4M9.8 15h4.4"/>' },
    { key: "consult", name: "個別相談管理", open: "https://consult-manager.shia2n.jp/", color: "#218fa5", g: '<path d="M3.5 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9.2L6 15.8V13h-.5a2 2 0 0 1-2-2z"/><path d="M18.5 9.2a2 2 0 0 1 2 2v4.3a2 2 0 0 1-2 2H18v2.6l-3.1-2.6H12a2 2 0 0 1-1.9-1.4"/>' },
    { key: "manabu", name: "学ぶくん", open: "https://manabu.shia2n.jp/", color: "#8c1c70", g: '<path d="M12 6.8C10 5.3 7.2 4.8 4 5.3v13c3.2-.5 6 0 8 1.5 2-1.5 4.8-2 8-1.5v-13c-3.2-.5-6 0-8 1.5z"/><path d="M12 6.8v13"/>' },
    { key: "portal", name: "ポータル", open: "https://portal.shia2n.jp/", color: "#286672", g: '<path d="M13 3.5h5a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-5"/><path d="M4 12h10M10.5 8.5 14 12l-3.5 3.5"/>' },
    { key: "site", name: "公式サイト", open: "https://evolab.shia2n.jp/", color: "#075f8c", g: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5S9.6 6.1 12 3.5z"/>' },
    { key: "members", name: "会員管理くん", open: "https://members.shia2n.jp/", color: "#725705", g: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><circle cx="8.6" cy="10.6" r="2"/><path d="M5.8 15.6c.5-1.4 1.6-2.2 2.8-2.2s2.3.8 2.8 2.2"/><path d="M13.5 10h4.5M13.5 13.5h3.5"/>' },
  ],
};

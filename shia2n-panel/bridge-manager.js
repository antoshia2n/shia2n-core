/**
 * マネージャーくんとのやりとり（2026-11-21 開発部・マネージャーくん 2便目・Naoki「OK」22:36）。
 * マネージャーくんの細い画面（https://manager.shia2n.jp/?view=panel）で「この拡張をつなぐ」を押すと、書くだけの鍵がここへ渡る。
 *   ext-key：鍵と送り先を chrome.storage.local に持つ（capture.js と background.js が使う）
 *   ext-forget：鍵を消す（画面の「止める」）
 *   ext-hello：つないでいるか・最後に残したものを画面へ返す
 * 鍵は書くことしかできない（マネージャーくんの台帳を読む力は無い）。止めるとサーバー側でも使えなくなる。
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
  addEventListener("message", async (e) => {
    const f = frame();
    if (!f || e.source !== f.contentWindow || !ORIGINS.includes(e.origin)) return;
    const m = e.data || {};
    if (m.src !== "manager") return;
    if (m.type === "ext-key" && /^mk_[A-Za-z0-9_-]{30,}$/.test(String(m.key || "")) && ORIGINS.includes(m.base)) {
      await chrome.storage.local.set({ mk_key: m.key, mk_base: m.base, mk_last: null });
    } else if (m.type === "ext-forget") {
      await chrome.storage.local.remove(["mk_key", "mk_base", "mk_last"]);
    } else if (m.type !== "ext-hello") return;
    state();
  });
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && (ch.mk_last || ch.mk_key)) state(); });
})();

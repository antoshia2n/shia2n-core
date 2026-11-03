/** 外枠の軽い入口（2026-11-03 1.13.0）。lib/firebase-lite.js のログインを読む。動きは shell/app-shell.js と同じ */
import { auth, db } from "../lib/firebase-lite.js";
import { firebaseSource } from "./firebase-source-lite.js";
import { mountAppShell as mountCore } from "./shell-core.js";

export { setTabTitle, appListedFor, MEMBER_PREVIEW, PORTAL_URL } from "./shell-core.js";

export function mountAppShell(cfg = {}) {
  return mountCore({ ...cfg, source: { ...firebaseSource(auth, db), ...(cfg.source || {}) } });
}

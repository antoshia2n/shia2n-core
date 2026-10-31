/**
 * 各アプリ共通の外枠の、今までどおりの入口（shia2n-core の lib/firebase.js の Firebase でログインを読む）。
 *
 * 本体は shell/shell-core.js（2026-10-31・1.10.0 で分けた）。ここは本体に Firebase の読み方（shell/firebase-source.js）を渡すだけで、動きは 1.9.0 と同じ。
 * 自前の Firebase の初期化を持つアプリや、Firebase でログインしないアプリは、ここではなく shell-core.js を読む
 * （ここを読むと lib/firebase.js が動き、アプリ側の初期化とぶつかるため）。
 */
import { auth, db } from "../lib/firebase.js";
import { firebaseSource } from "./firebase-source.js";
import { mountAppShell as mountCore } from "./shell-core.js";

export { setTabTitle, appListedFor, MEMBER_PREVIEW, PORTAL_URL } from "./shell-core.js";

export function mountAppShell(cfg = {}) {
  return mountCore({ ...cfg, source: { ...firebaseSource(auth, db), ...(cfg.source || {}) } });
}

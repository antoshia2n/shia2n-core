/**
 * 外枠（shell/shell-core.js）に渡す「ログインの読み方」の Firebase 版（2026-10-31・1.10.0 で app-shell.js から切り出した）。
 *
 * auth と db はアプリが持っているものを渡す（shia2n-core の lib/firebase.js を読まないので、アプリ側の初期化とぶつからない）。
 *   使い方：mountAppShell({ ..., source: firebaseSource(auth, db) })
 * db は利用者（users）とポータルの設定（apps）がある名前つきのデータベース。
 */
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

export const GATE_URL = "https://shia2n-mcp.gameister1.workers.dev/gate/resolve";

/** 門番が答える、この人が開けるアプリの名前（権利の表 member_access）。台帳にいない人は []。引けなければ投げる（2026-10-28） */
export async function gateAppsFor(user, fetcher = globalThis.fetch) {
  if (!user || typeof user.getIdToken !== "function") return [];
  const token = await user.getIdToken();
  const r = await fetcher(GATE_URL, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const b = await r.json().catch(() => null);
  if (b && b.ok === true) return Array.isArray(b.apps) ? b.apps : [];
  if (r.status === 403) return []; // 台帳にいない・メールが無いなど（門番が断った）
  throw new Error("gate " + r.status);
}

export function firebaseSource(auth, db) {
  return {
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
    gateApps: () => gateAppsFor(auth.currentUser),
    async signOut() { await signOut(auth); },
    watch(cb) { return onAuthStateChanged(auth, cb); },
  };
}

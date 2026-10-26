// Auth
export { AuthGuard } from "./auth/AuthGuard.jsx";
export { useAuthUid, useAuthUser } from "./auth/useAuthUid.js";

// Firebase
export { auth, db, firebaseApp } from "./lib/firebase.js";

// Supabase + 汎用 CRUD
export {
  supabase,
  fetchAll, fetchOne,
  insertOne, updateOne, deleteOne,
  upsertOne,
  dbGatewayEnabled, dbGatewayPath,
} from "./lib/supabase.js";

// Design tokens & utils
export { T, fmt, fmtK, currentMonth, today, p2, clamp } from "./tokens.js";

// Shared styles
export { card, lb10, mc, inp, solidBtn, ghostBtn, mono } from "./styles.js";

// Shared components
export { Delta } from "./components/Delta.jsx";

// 各アプリ共通の外枠（タブの名前・右上のメニュー・アプリ一覧・マニュアル 2 軸・2026-10-26）
export { mountAppShell, setTabTitle, canOpenApp, MEMBER_PREVIEW, PORTAL_URL } from "./shell/app-shell.js";
export { APP_ICONS, iconSvg, hostOf } from "./shell/icons.js";

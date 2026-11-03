/**
 * shia2n-core の軽い入口（2026-11-03 1.13.0）。import { ... } from "shia2n-core/lite.js"
 * 今までの入口（index.js）と同じ名前を出すが、中身が軽い：
 *   - supabase は表の読み書きだけ（@supabase/postgrest-js）。.from() の書き方は同じ。ログイン・置き場・リアルタイムは無い
 *   - Firebase の db は firestore/lite（一度読む・書くだけ。onSnapshot などのリアルタイムの読み込みは無い）。db には firebase/firestore/lite の関数を使う
 * 乗り換えはアプリごと。リアルタイムの読み込みや supabase.auth / storage を使うアプリは今までの入口のまま。
 */
// Auth
export { AuthGuard } from "./auth/AuthGuard-lite.jsx";
export { useAuthUid, useAuthUser } from "./auth/useAuthUid-lite.js";

// Firebase（firestore/lite）
export { auth, db, firebaseApp } from "./lib/firebase-lite.js";

// Supabase（表の読み書きだけ）+ 汎用 CRUD
export {
  supabase,
  fetchAll, fetchOne,
  insertOne, updateOne, deleteOne,
  upsertOne,
  dbGatewayEnabled, dbGatewayPath,
  getWorkspace, setWorkspace,
} from "./lib/supabase-lite.js";

// Design tokens & utils / styles / components（今までと同じ）
export { T, fmt, fmtK, currentMonth, today, p2, clamp } from "./tokens.js";
export { card, lb10, mc, inp, solidBtn, ghostBtn, mono } from "./styles.js";
export { Delta } from "./components/Delta.jsx";

// 各アプリ共通の外枠（firestore/lite で読む）
export { mountAppShell, setTabTitle, appListedFor, MEMBER_PREVIEW, PORTAL_URL } from "./shell/app-shell-lite.js";
export { APP_ICONS, iconSvg, hostOf } from "./shell/icons.js";

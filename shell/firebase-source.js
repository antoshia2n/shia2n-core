/**
 * 外枠（shell/shell-core.js）に渡す「ログインの読み方」の Firebase 版（2026-10-31・1.10.0 で app-shell.js から切り出した）。
 *
 * auth と db はアプリが持っているものを渡す（shia2n-core の lib/firebase.js を読まないので、アプリ側の初期化とぶつからない）。
 *   使い方：mountAppShell({ ..., source: firebaseSource(auth, db) })
 * db は利用者（users）とポータルの設定（apps）がある名前つきのデータベース。
 */
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { makeFirebaseSource } from "./source-core.js";
export { GATE_URL, gateAppsFor } from "./source-core.js";

/** 2026-11-03 1.13.0：中身は shell/source-core.js（軽い入口と同じもの）。ここは firestore の全部の関数を渡すだけ */
export const firebaseSource = makeFirebaseSource({ doc, getDoc, collection, query, where, getDocs });

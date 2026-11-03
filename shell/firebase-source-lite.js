/** 軽い入口の「ログインの読み方」（2026-11-03 1.13.0・firestore/lite）。中身は shell/source-core.js */
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore/lite";
import { makeFirebaseSource } from "./source-core.js";
export { GATE_URL, gateAppsFor } from "./source-core.js";
export const firebaseSource = makeFirebaseSource({ doc, getDoc, collection, query, where, getDocs });

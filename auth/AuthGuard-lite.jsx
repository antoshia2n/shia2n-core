/** 軽い入口の AuthGuard（2026-11-03 1.13.0・lib/firebase-lite.js・firestore/lite）。中身は auth/AuthGuard-core.jsx */
import { doc, getDoc } from "firebase/firestore/lite";
import { auth, db } from "../lib/firebase-lite.js";
import { createAuthGuard } from "./AuthGuard-core.jsx";
export const AuthGuard = createAuthGuard({ auth, db, doc, getDoc });

/** 軽い入口の useAuthUid（2026-11-03 1.13.0・lib/firebase-lite.js）。中身は auth/useAuthUid.js と同じ */
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase-lite.js";

export function useAuthUid() {
  const [uid, setUid] = useState(() => auth.currentUser?.uid ?? null);
  useEffect(() => onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null)), []);
  return uid;
}

export function useAuthUser() {
  const [user, setUser] = useState(() => auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

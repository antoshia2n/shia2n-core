import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase.js";

// AuthGuard の内側で呼ぶ前提 → uid が null になることは基本ない
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

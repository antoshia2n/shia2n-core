import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { T } from "../tokens.js";
import { solidBtn } from "../styles.js";
import { passesGate } from "./access-rule.js";

const PORTAL_URL = "https://portal.shia2n.jp";

/* 2026-10-27 から入場は権利の表（門番の apps）で決める。ポータルの札（shell/app-access.js）はまだ Firestore の値で、別の便で直す */
async function checkAccess(user, appId) {
  const snap = await getDoc(doc(db, "users", user.uid));
  const role = snap.exists() ? snap.data().role : undefined;
  if (role === "admin") return true;
  try {
    const idToken = await user.getIdToken();
    const res = await fetch("https://shia2n-mcp.gameister1.workers.dev/gate/resolve", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const body = await res.json().catch(() => ({}));
    return passesGate(role, body, appId);
  } catch {
    return false;
  }
}

export function AuthGuard({ appId, appName, children }) {
  const [state, setState] = useState("loading");

  useEffect(() => {
    if (!appId) {
      console.error("[AuthGuard] appId is required");
      setState("error");
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setState("login"); return; }
      try {
        const ok = await checkAccess(user, appId);
        if (ok) {
          setState("ok");
        } else {
          window.location.href = PORTAL_URL;
        }
      } catch (e) {
        console.error("[AuthGuard]", e);
        setState("error");
      }
    });
    return unsub;
  }, [appId]);

  if (state === "loading") return <Loading />;
  if (state === "ok")      return children;
  return <LoginScreen appName={appName ?? appId} isError={state === "error"} />;
}

function Loading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg, fontSize: 13, color: T.muted }}>
      読み込み中...
    </div>
  );
}

function LoginScreen({ appName, isError }) {
  const [loading, setLoading] = useState(false);
  const signIn = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      setLoading(false);
    }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -0.5 }}>{appName}</div>
        {isError && <div style={{ fontSize: 12, color: T.red }}>エラーが発生しました。再度お試しください。</div>}
        <button onClick={signIn} disabled={loading} style={{ ...solidBtn(T.text), opacity: loading ? 0.6 : 1, padding: "10px 24px" }}>
          {loading ? "ログイン中..." : "Googleでログイン"}
        </button>
      </div>
    </div>
  );
}

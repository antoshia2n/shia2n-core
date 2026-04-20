import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { T } from "../tokens.js";
import { solidBtn } from "../styles.js";

const PORTAL_URL = "https://portal.shia2n.jp";

async function checkAccess(uid, appId) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return false;
  const { role, allowedApps, paymentStatus } = snap.data();
  return (
    role === "admin" ||
    paymentStatus === "premium" ||
    paymentStatus === "monitor" ||
    (Array.isArray(allowedApps) && allowedApps.includes(appId))
  );
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
        const ok = await checkAccess(user.uid, appId);
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

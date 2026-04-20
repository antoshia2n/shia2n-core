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
} from "./lib/supabase.js";

// Design tokens & utils
export { T, fmt, fmtK, currentMonth, today, p2, clamp } from "./tokens.js";

// Shared styles
export { card, lb10, mc, inp, solidBtn, ghostBtn, mono } from "./styles.js";

// Shared components
export { Delta } from "./components/Delta.jsx";

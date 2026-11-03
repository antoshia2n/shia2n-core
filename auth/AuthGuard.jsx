/** 今までの入口の AuthGuard（lib/firebase.js・firestore の全部）。中身は auth/AuthGuard-core.jsx */
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { createAuthGuard } from "./AuthGuard-core.jsx";
export const AuthGuard = createAuthGuard({ auth, db, doc, getDoc });

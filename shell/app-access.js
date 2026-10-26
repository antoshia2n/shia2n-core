/**
 * そのアプリを「開けるアプリ」として出すかの判定（2026-10-26 開発部）。
 *
 * 外枠のアプリ一覧（shell/app-shell.js）と、ポータル（portal.shia2n.jp）の会員の画面の札が、同じこの 1 本を読む。
 * 別の判定を作らないため、Firebase も画面も読み込まない（この 1 枚だけを読めば、どのアプリからも使える）。
 *   使い方：import { appListedFor } from "shia2n-core/shell/app-access.js";
 *
 * ここは「出すかどうか」だけで、鍵ではない。入れるかを決めるのは行き先のアプリの門番（auth/AuthGuard.jsx）。
 */
import { hostOf } from "./icons.js";

const T = (s) => String(s ?? "").trim();

/** 共通の門番（auth/AuthGuard.jsx の checkAccess）が通すランク。門番を変えたらここも変える */
export const GUARD_PASS_STATUSES = Object.freeze(["premium", "monitor"]);

/**
 * アプリ一覧にそのアプリを出すか（表示だけ。入れるかを決めるのは行き先のアプリの門番で、ここは鍵ではない）。
 * 「出したのに押すと入れない」を無くすため、ポータルの切り替えと門番の決まりの両方が通すものだけを出す：
 *   有効でない・住所が無い → 出さない
 *   管理者 → 有効なものは全部（門番も管理者は全部通す）
 *   会員ランチャーに公開していない（isPublic が false）→ 出さない
 *   ポータルが許す：個別許可（allowedApps）にポータルのアプリの番号がある、または使える会員ランク（allowedStatuses）にその人のランクがある
 *   門番が許す：ランクが premium か monitor、または個別許可に門番のアプリの名前（住所のいちばん左。x-koryaku.shia2n.jp なら x-koryaku）がある
 *   両方が許す → 出す
 */
export function appListedFor(profile, app) {
  if (!app || app.isActive === false || !T(app.url)) return false;
  if (profile && profile.role === "admin") return true;
  if (app.isPublic === false) return false;
  const allowed = Array.isArray(profile?.allowedApps) ? profile.allowedApps.map(T) : [];
  const mine = T(profile?.paymentStatus);
  const id = T(app.id);
  const st = Array.isArray(app.allowedStatuses) ? app.allowedStatuses.map(T) : [];
  const portalOk = (!!id && allowed.includes(id)) || (!!mine && st.includes(mine));
  const guardKey = hostOf(app.url).split(".")[0];
  /* 門番が見るのは門番のアプリの名前だけ（ポータルの番号は見ない）。番号と名前が同じアプリ（content-os など）はどちらでも通る */
  const guardOk = GUARD_PASS_STATUSES.includes(mine) || (!!guardKey && allowed.includes(guardKey));
  return portalOk && guardOk;
}

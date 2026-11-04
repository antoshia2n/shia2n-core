#!/usr/bin/env node
/**
 * 生徒用の版を作る（2026-11-04 開発部）。アプリのリポジトリの一番上で走らせる：
 *   node node_modules/shia2n-core/tools/release-stable.mjs
 * 今のコードを vite で /stable/ の下に組み立て、public/stable/ に置く。結合すると生徒の画面がこれに変わる。
 * public/ の中身は組み立てに写されるので、写しの中の写し（stable/stable）は消す。
 */
import { execSync } from "node:child_process";
import { rmSync, renameSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const tmp = join(root, ".stable-build");
// 写しの置き場は vite の publicDir の下（アプリによって public/ だったり static/ だったりする）
const viteDir = dirname(createRequire(join(root, "package.json")).resolve("vite/package.json"));
const { resolveConfig } = await import(pathToFileURL(join(viteDir, "dist/node/index.js")).href);
const cfg = await resolveConfig({ root }, "build", "production");
if (!cfg.publicDir) throw new Error("publicDir がありません");
const out = join(cfg.publicDir, "stable");
// 画面に焼き込む公開の値（VITE_...）が無いと、写しはログインできない画面になる。先に止める
const need = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_PROJECT_ID", "VITE_SUPABASE_URL"];
const miss = need.filter((k) => !cfg.env[k]);
if (miss.length) throw new Error(`画面に焼き込む値がありません（${miss.join(", ")}）。.env.production か vite.config.js に置いてください`);
rmSync(tmp, { recursive: true, force: true });
execSync(`npx vite build --base=/stable/ --outDir ${JSON.stringify(tmp)} --emptyOutDir`, { cwd: root, stdio: "inherit" });
for (const n of ["stable", "_redirects", "_routes.json", "_headers"]) rmSync(join(tmp, n), { recursive: true, force: true }); // 置き場の設定は一番上のものだけが効く
if (!existsSync(join(tmp, "index.html"))) throw new Error("index.html ができていません");
rmSync(out, { recursive: true, force: true });
renameSync(tmp, out);
let commit = "";
try { commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim(); } catch {}
const at = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" });
writeFileSync(join(out, "RELEASE.json"), JSON.stringify({ released_at: at, from_commit: commit }, null, 2) + "\n");
console.log(`生徒用の版を作りました（${relative(root, out)}・${at}・${commit}・${readdirSync(out).length} 項目）`);

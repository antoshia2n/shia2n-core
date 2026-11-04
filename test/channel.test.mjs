import test from "node:test";
import assert from "node:assert/strict";
import { serveChannel, isPageRequest, channelCookie, isNext } from "../server/channel.js";

const page = (u, h = {}) => new Request(u, { headers: { accept: "text/html", ...h } });
const assets = (have = true) => async (req) => {
  const p = new URL(req.url).pathname;
  if (p === "/stable/") return have ? new Response("STABLE", { status: 200 }) : new Response("nf", { status: 404 });
  return new Response("LATEST " + p);
};

test("画面の要求だけを対象にする", () => {
  const u = (s) => new URL(s);
  assert.equal(isPageRequest(page("https://mindmap.shia2n.jp/"), u("https://mindmap.shia2n.jp/")), true);
  assert.equal(isPageRequest(page("https://mindmap.shia2n.jp/s/abc"), u("https://mindmap.shia2n.jp/s/abc")), true);
  assert.equal(isPageRequest(page("https://x.shia2n.jp/api/db"), u("https://x.shia2n.jp/api/db")), false);
  assert.equal(isPageRequest(page("https://x.shia2n.jp/assets/a.js"), u("https://x.shia2n.jp/assets/a.js")), false);
  assert.equal(isPageRequest(page("https://x.shia2n.jp/stable/"), u("https://x.shia2n.jp/stable/")), false);
  const img = new Request("https://x.shia2n.jp/", { headers: { "sec-fetch-dest": "image", accept: "text/html" } });
  assert.equal(isPageRequest(img, u("https://x.shia2n.jp/")), false);
  assert.equal(isPageRequest(new Request("https://x.shia2n.jp/", { method: "POST", headers: { accept: "text/html" } }), u("https://x.shia2n.jp/")), false);
});

test("印が無ければ写し（生徒用）、印があれば何もしない（最新）", async () => {
  let r = await serveChannel(page("https://swipe.shia2n.jp/"), assets());
  assert.equal(await r.text(), "STABLE");
  assert.equal(r.headers.get("x-lab-channel"), "stable");
  r = await serveChannel(page("https://swipe.shia2n.jp/", { cookie: "a=1; lab_ch=next" }), assets());
  assert.equal(r, null);
});

test("写しがまだ無ければ最新のまま（止めない）", async () => {
  assert.equal(await serveChannel(page("https://swipe.shia2n.jp/"), assets(false)), null);
});

test("部品と API には触らない", async () => {
  assert.equal(await serveChannel(page("https://swipe.shia2n.jp/api/db/x"), assets()), null);
  assert.equal(await serveChannel(new Request("https://swipe.shia2n.jp/assets/index-abc.js"), assets()), null);
});

test("?ch= で印を付け外しし、shia2n.jp の全部の住所で共通にする", async () => {
  const r = await serveChannel(page("https://mindmap.shia2n.jp/maps?ch=next&x=1"), assets());
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "/maps?x=1");
  assert.match(r.headers.get("set-cookie"), /^lab_ch=next;.*Domain=shia2n\.jp$/);
  const off = await serveChannel(page("https://mindmap.shia2n.jp/?ch=stable"), assets());
  assert.match(off.headers.get("set-cookie"), /^lab_ch=; .*Max-Age=0/);
  assert.ok(!channelCookie("x.pages.dev", "next").includes("Domain"));
  assert.equal(isNext("lab_ch=nextx"), false);
});

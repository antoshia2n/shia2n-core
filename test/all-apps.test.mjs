import test from "node:test";
import assert from "node:assert/strict";
import { ALL_APPS, parseRecent, formatRecent, sortByRecent, readRecent, touchRecent, RECENT_COOKIE } from "../shell/all-apps.js";

test("名簿に住所の重なりが無い・note攻略くんと思考整理くんが入る", () => {
  const hosts = ALL_APPS.map((a) => a.host);
  assert.equal(new Set(hosts).size, hosts.length);
  assert.ok(hosts.includes("note-koryaku.shia2n.jp") && hosts.includes("mindmap.shia2n.jp"));
  assert.ok(!hosts.includes("marke.shia2n.jp"));
});

test("記録の読み書きが往復する・壊れた欄は飛ばす", () => {
  const m = { "a.shia2n.jp": 1700000000000, "b.shia2n.jp": 1700000500000 };
  assert.deepEqual(parseRecent(formatRecent(m)), m);
  assert.deepEqual(parseRecent("x;y,:12,bad host:zz,c.shia2n.jp:abc"), { "c.shia2n.jp": parseInt("abc", 36) * 1000 });
});

test("新しく開いた順・開いていないものは後ろに名前順", () => {
  const items = [{ host: "a", name: "い" }, { host: "b", name: "あ" }, { host: "c", name: "う" }];
  const out = sortByRecent(items, { c: 2000, a: 1000 }).map((x) => x.host);
  assert.deepEqual(out, ["c", "a", "b"]);
  assert.deepEqual(sortByRecent(items, {}).map((x) => x.host), ["b", "a", "c"]);
});

test("touchRecent は shia2n.jp では共通の置き場に書き、読み直すと先頭に来る", () => {
  const jar = { v: "" , set cookie(s) { this.last = s; this.v = s.split(";")[0]; }, get cookie() { return this.v; } };
  touchRecent("x-koryaku.shia2n.jp", { doc: jar, now: 1700000000000, hostname: "note-koryaku.shia2n.jp" });
  touchRecent("haaku.shia2n.jp", { doc: jar, now: 1700000900000, hostname: "note-koryaku.shia2n.jp" });
  assert.match(jar.last, /domain=\.shia2n\.jp/);
  assert.ok(jar.v.startsWith(RECENT_COOKIE + "="));
  const r = readRecent(jar);
  assert.deepEqual(sortByRecent([{ host: "x-koryaku.shia2n.jp", name: "X" }, { host: "haaku.shia2n.jp", name: "h" }], r).map((x) => x.host), ["haaku.shia2n.jp", "x-koryaku.shia2n.jp"]);
  touchRecent("a.b", { doc: jar, now: 1, hostname: "localhost" });
  assert.doesNotMatch(jar.last, /domain=/);
});

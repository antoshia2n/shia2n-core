import test from "node:test";
import assert from "node:assert/strict";
import { contentMatches, extensionOf } from "../server/storage-gateway.js";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).buffer;
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]).buffer;
const GIF = new TextEncoder().encode("GIF89a....").buffer;
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]).buffer;
const SVG = new TextEncoder().encode('﻿  <svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').buffer;

test("名前と中身が合う画像は通る", () => {
  assert.ok(contentMatches("png", PNG));
  assert.ok(contentMatches("jpg", JPG));
  assert.ok(contentMatches("jpeg", JPG));
  assert.ok(contentMatches("gif", GIF));
  assert.ok(contentMatches("webp", WEBP));
});

test("a.png の名前で SVG の中身は断る（ほかの拡張子でも）", () => {
  for (const ext of ["png", "jpg", "jpeg", "gif", "webp"]) assert.equal(contentMatches(ext, SVG), false, ext);
  assert.equal(contentMatches("png", JPG), false);
});

test("アプリが足した拡張子でも、< で始まる字の文書は断る", () => {
  assert.equal(contentMatches("txt", SVG), false);
  assert.ok(contentMatches("txt", new TextEncoder().encode("hello").buffer));
});

test("svg・html はどのアプリが許しても受けない／既定は png jpg jpeg gif webp だけ", () => {
  assert.throws(() => extensionOf("a.svg", ["svg", "png"]), /置けません/);
  assert.throws(() => extensionOf("a.html", ["html"]), /置けません/);
  assert.throws(() => extensionOf("a.avif", ["jpg", "jpeg", "png", "gif", "webp"]), /置けません/);
  assert.equal(extensionOf("写真.PNG", ["jpg", "jpeg", "png", "gif", "webp"]), "png");
});

test("pdf は %PDF- で始まるものだけ（スワイプくん）", () => {
  assert.ok(contentMatches("pdf", new TextEncoder().encode("%PDF-1.7\n").buffer));
  assert.equal(contentMatches("pdf", SVG), false);
  assert.equal(contentMatches("pdf", PNG), false);
});

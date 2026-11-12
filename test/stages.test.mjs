import test from "node:test";
import assert from "node:assert/strict";
import { stepTabs, stepHead, folded, isSimple, modeToggle, flowCard } from "../shell/stages.js";

const STEPS = [["policy", "方針"], ["ana", "分析"], ["st", "戦略"]];
const IO = { policy: ["（起点）", "方針を決める", "②へ"], ana: ["①から", "見る", "③へ"], st: ["②から", "打ち手", "④へ"] };

test("上の帯：済んだ段は ✓、今の段は on", () => {
  const h = stepTabs({ steps: STEPS, cur: "ana", done: k => k === "policy", badge: { home: 3 } });
  assert.match(h, /data-id="home"[^>]*aria-label="ホーム（残り 3）"/);
  assert.match(h, /data-id="policy"[^>]*>.*?✓.*?方針/);
  assert.match(h, /class="s2-stp on" data-act="s2step" data-id="ana"/);
});

test("段の頭：前の段へ戻る・次の段へ渡す・○ は移る先のキー", () => {
  const h = stepHead({ steps: STEPS, key: "ana", io: IO.ana, decides: [["相手", true, "acc"], ["点数", false, "sc"]] });
  assert.match(h, /②分析/);
  assert.match(h, /data-act="s2step" data-id="policy"/);
  assert.match(h, /data-act="s2step" data-id="st"/);
  assert.match(h, /決めること 1\/2/);
  assert.match(h, /data-act="s2dec" data-id="sc">○ 点数/);
  assert.match(h, /✓ 相手/);
  assert.equal(stepHead({ steps: STEPS, key: "x", io: [] }), "");
});

test("最初の段は受け取る先が無い・決めることが無ければ行を出さない", () => {
  const h = stepHead({ steps: STEPS, key: "policy", io: IO.policy });
  assert.match(h, /s2-sio off/);
  assert.doesNotMatch(h, /s2-dcd/);
});

test("シンプル：ほかはたたむ（消さない）・開くと全部とたたむボタン", () => {
  assert.equal(isSimple("t"), true); // 覚える場所が無いときはシンプル
  assert.equal(folded("t", "k", ["A"], ["B", "C"], false), 'A<button type="button" class="s2-more" data-act="s2more" data-id="k" data-v="1" aria-expanded="false">ほかのカード（2）を見る ▼</button>');
  assert.match(folded("t", "k", ["A"], ["B"], true), /^AB.*たたむ ▲/);
  assert.equal(folded("t", "k", ["A"], [], false), "A");
  assert.match(modeToggle("t"), /data-id="simple" class="on" aria-pressed="true"/);
});

test("流れ：段ごとに押すボタン", () => {
  const h = flowCard({ steps: STEPS, io: IO, done: k => k === "st" });
  assert.equal((h.match(/data-act="s2step"/g) || []).length, 3);
  assert.match(h, /data-act="s2intro"/);
});

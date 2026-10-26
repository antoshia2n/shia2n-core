# shia2n-core

Naoki の全アプリで共有する中核モジュール。AuthGuard、Firebase・Supabase の初期化、デザイントークン、共通スタイル、共通コンポーネントを一式提供する。

---

## インストール

各アプリの `package.json` に以下を追加：

```json
"dependencies": {
  "shia2n-core": "github:antoshia2n/shia2n-core"
}
```

---

## 使い方

### 認証

```jsx
import { AuthGuard } from "shia2n-core";

// main.jsx
<AuthGuard appId="cashflow-os" appName="CashFlowOS">
  <App />
</AuthGuard>
```

### ユーザーID取得（AuthGuardの内側で使う）

```jsx
import { useAuthUid } from "shia2n-core";

export default function App() {
  const uid = useAuthUid();
  // ...
}
```

### Supabase CRUD

```js
import { fetchAll, insertOne, updateOne, deleteOne } from "shia2n-core";

// 一覧取得（user_id自動フィルタ）
const { data } = await fetchAll("cf_accounts", uid, "sort_order");

// 追加（user_id自動付与）
await insertOne("cf_accounts", uid, { name: "楽天銀行", balance: 0 });

// 更新
await updateOne("cf_accounts", id, { balance: 100000 });

// 削除
await deleteOne("cf_accounts", id);
```

### デザイントークン & スタイル

```jsx
import { T, fmt, card, lb10, solidBtn, Delta } from "shia2n-core";

<div style={{ ...card, padding: 14 }}>
  <div style={lb10}>残高</div>
  <div>{fmt(1234567)}</div>
  <Delta now={1234567} prev={1000000} />
  <button style={solidBtn()}>保存</button>
</div>
```

---

## 必須の環境変数（アプリ側で設定）

Cloudflare Pages の Environment variables に以下を設定：

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_ID
```

出入り口を使うアプリは、これに加えて `VITE_DB_GATEWAY`（平文）と `SUPABASE_SERVICE_ROLE_KEY`（Secret）を設定する。

---

## 必須の Vite 設定（アプリ側）

`vite.config.js` で node_modules 内の JSX も変換するよう設定：

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      include: [/\.jsx?$/, /node_modules\/shia2n-core\/.*/],
    }),
  ],
  optimizeDeps: {
    include: ["shia2n-core"],
  },
});
```

---

## データの出入り口（2026-07-30 決定「画面は公開キーでデータベースに直接触らない」）

表の読み書きを、Supabase へ直結せず **自分のアプリのサーバー経由** にする仕組み。
呼び出し側のコードは一切変えない（接続の向き先だけが変わる）。

**設定したアプリだけが新方式になる。** `VITE_DB_GATEWAY` を設定していないアプリはこれまで通り直結で動く。

### 経由するもの・しないもの

| 対象 | 経路 |
|---|---|
| 表の読み書き・データベース関数 | アプリのサーバー経由（管理者キーはサーバーだけが持つ） |
| 添付ファイルの置き場（Storage）への保存 | アプリのサーバー経由（下の「置き場の出入り口」を見る） |
| 添付ファイルの置き場（Storage）からの取り出し | これまで通り直結（置き場は公開のまま） |

### アプリ側の入れ方（2手順）

**1. 受け皿を1ファイル置く** — `functions/api/db/[[path]].js`

```js
import { createDbGateway } from "shia2n-core/server/db-gateway.js";

export const onRequest = createDbGateway({
  basePath:  "/api/db",
  tables:    { sw_swipes: { owner: "user_id" }, sw_zeus_orphans: { owner: "user_id" } },
  functions: { sw_increment_ref: { owner: "p_user_id" } },
});
```

#### 関数ごとの締めつけ（任意）

`functions` は2つの書き方を受け付ける。

| 書き方 | 動き |
|---|---|
| `["sw_increment_ref"]` | 名前が一覧にあるかだけを見て、送られてきた中身をそのまま渡す（従来どおり） |
| `{ sw_increment_ref: { owner: "p_user_id" } }` | 送信内容の `p_user_id` を、サーバーで確定した本人の印で必ず上書きする |

`owner` を書いた関数では、画面が他人の印を入れて送ってきても捨てられる。ただし**関数の側も直すこと**。引数を受け取るだけで絞り込まない関数のままだと、印が増えるだけで他人の行に届いてしまう。関数の側は「その引数と一致する行だけ」を対象にする。

`owner` を書いた関数は、送信内容を差し替える必要があるため POST だけを通す。

#### 表ごとの締めつけ（任意）

`tables` の各表には、次の設定を足せる。書かなければ従来どおりの動きになる。

| 設定 | 書き方 | 動き |
|---|---|---|
| 持ち主で分ける | `{ owner: "user_id" }` | 本人の行だけに絞る（既定）。`null` で分けない |
| 読み取り専用 | `{ readOnly: true }` | 取り出す以外の操作を断る |
| 決まった絞り込み | `{ force: { is_active: "eq.true" } }` | 取り出し・書き換え・削除に必ずこの条件を足す |

利用者を絞れないアプリ（ログインさえすれば誰でも入れる画面）で、持ち主で分けられないマスタ表を扱うときに使う。

```js
tables: {
  members_decrypted:       { owner: "firebase_uid" },
  plan_entitlement_matrix: { owner: null, readOnly: true, force: { is_active: "eq.true" } },
}
```

`force` を書いた表に新しい行を作るときは、同じ値が強制的に入る（絞り込みの外側に行を作れないようにするため）。`eq.` 以外の条件を書いた表では、入れる値が決まらないため作成を断る。

**2. Cloudflare Pages に設定を足す**

| 名前 | 種別 | 値 |
|---|---|---|
| `VITE_DB_GATEWAY` | 平文 | `/api/db` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase の service role キー |

`_routes.json` の `include` に `/api/*` が入っていること。

### 出入り口が守っていること

1. ログイン済みの証明を毎回サーバーで照合する（画面からの `user_id` の自己申告は使わない）
2. `tables` / `functions` に書いた分だけ通す
3. 読み書きの条件に本人の印を強制で足す（追加時は本人の印で上書き、更新時は持ち主の変更を拒否）
4. `owner` を書いた関数呼び出しは、送信内容の印を本人の印で上書きする
5. 別の表を巻き込んで取り出す書き方を拒否する
6. 管理者キーはサーバーだけが持つ

### 診断

`checkDbGateway(env)` で設定の有無とログイン確認の準備可否だけを返す（値は返さない）。

---

## 置き場の出入り口（2026-08-09 追加）

添付ファイルを置き場へ**保存する**ときだけ、Supabase へ直結せず **自分のアプリのサーバー経由** にする仕組み。
取り出し（表示）は通らない。置き場は公開のままにしてあるため、画面はこれまで通り公開の住所で表示する。

守るのは「見られないこと」ではなく「**勝手に置かれない・消されない**こと」。

### アプリ側の入れ方（2手順）

**1. 受け皿を1ファイル置く** — `functions/api/storage/upload.js`

```js
import { createStorageGateway } from "shia2n-core/server/storage-gateway.js";

export const onRequestPost = createStorageGateway({
  buckets: {
    contentos: { prefix: "images/" },
  },
});
```

**2. 画面から呼ぶ**

```js
const token = await auth.currentUser.getIdToken();
const res = await fetch(
  `/api/storage/upload?bucket=contentos&name=${encodeURIComponent(file.name)}`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
    body: file,
  },
);
const out = await res.json();   // { ok: true, bucket: "contentos", path: "images/1754..._abc.jpg" }
```

返ってくるのは保存先の名前（`path`）だけ。表示用の住所は画面側で
`supabase.storage.from(bucket).getPublicUrl(out.path)` から作る。

### 入れ物ごとの設定（すべて任意）

| 設定 | 既定 | 動き |
|---|---|---|
| `prefix` | `""` | 保存先の頭に付ける文字列（例 `images/`） |
| `maxBytes` | 50MB | これより大きいファイルを断る |
| `extensions` | `jpg / jpeg / png / gif / webp / avif` | これ以外の拡張子を断る |
| `contentTypePrefix` | `image/` | これ以外の種類を断る |

`allowUids` に利用者を並べると、その人たちだけが置けるようになる（空なら全員）。

### 出入り口が守っていること

1. ログイン済みの証明を毎回サーバーで照合する
2. `buckets` に書いた入れ物だけを通す
3. 決めた種類・大きさだけを通す
4. **保存先の名前はサーバーが決める**（画面が決めた名前は使わないため、既に置いてあるファイルを上書きできない）
5. 管理者キーはサーバーだけが持つ

置き場の側は、書き込みと削除の許可から公開キーとログイン済みキーを外しておくこと。
外さないと、この口を通らずに直接置ける道が残る。

### 診断

`checkStorageGateway(env)` で設定の有無だけを返す（値は返さない）。

---

## 共通の外枠（2026-10-26 追加・1 本目は思考整理くん）

どのアプリでも、開いた人が次の 4 つに迷わず届くようにする部品。React を使わないので、素の JS の画面でも React の画面でも同じに使える。

| 目的 | 部品 | 中身 |
|---|---|---|
| いま何を開いているか | `setTabTitle(名前)` | タブの名前は開いているものの名前だけ。アプリはファビコンで示す（アプリ名を文字で出さない） |
| 誰で入っているか | 右上の丸 | 名前・メール・設定（見た目：自動／明るい／暗い ＋ アプリ固有）・ログアウト |
| 他のアプリへの移り方 | 右上の「アプリ一覧」 | その人が開けるアプリだけ。ポータルの切り替え（apps の isActive・isPublic・allowedStatuses と users の allowedApps）と、共通の門番（AuthGuard）の決まりの両方が通すものを出す。新しい権利は作らない。一覧は表示だけで鍵ではない（入れるかは行き先の門番） |
| 何ができてどう操作するか | 右上の「？」 | A できることの一覧（アプリが文を渡す）・B 画面の上で押す場所を順に示す案内 |

管理者には、アカウントのメニューに「会員の目で見る」が出る（アプリ一覧とマニュアルが、しあらぼ生・個別許可なしの見え方になる）。

### アプリ側の入れ方（3 手順）

```js
import { mountAppShell, setTabTitle } from "shia2n-core";

// 1. ログインの内側で 1 回作る
const shell = mountAppShell({
  appId: "mindmap", appName: "思考整理くん",
  manual: { intro: "…", sections: [{ title: "書く", items: [{ t: "枝を足す", d: "Tab で子、Enter で兄弟", keys: ["Tab"] }] }] },
  keys: [["マップ", "Tab", "子を足す"]],                 // アプリのキーの一覧をそのまま
  tours: [{ id: "first", title: "はじめの 1 枚", desc: "…", steps: [{ el: "#newBtn", title: "＋ 新規", body: "…" }] }],
  settings: [{ label: "段ごとの文字", note: "…", run: (anchor) => openMySettings(anchor) }],
});
// 2. 右上に置く場所を渡す（画面ごとに置き場所が違えば、切り替えるたびに呼ぶ）
shell.attach(document.querySelector("#header-right"));
// 3. 開いているものが変わったらタブの名前を変える
setTabTitle("11月セミナー設計");
```

- 開く窓は、外を押す・Esc・別の物を開く、のどれでも閉じ、閉じたら押したボタンへ戻る
- 見た目は Shadow DOM の中に閉じ、色はアプリの CSS 変数（--bg・--panel・--fg・--accent など。作り方の 1 枚 §5）を読む
- ファビコンを置いていないアプリは、タブにアプリの印が出ない。先に icon-rules.md の形でファビコンを置く

---

## エクスポート一覧

| カテゴリ | エクスポート |
|---|---|
| Auth | `AuthGuard`, `useAuthUid`, `useAuthUser` |
| Firebase | `auth`, `db`, `firebaseApp` |
| Supabase | `supabase`, `fetchAll`, `fetchOne`, `insertOne`, `updateOne`, `deleteOne`, `upsertOne`, `dbGatewayEnabled`, `dbGatewayPath` |
| 出入り口（サーバー） | `shia2n-core/server/db-gateway.js` の `createDbGateway`, `verifyIdToken`, `checkDbGateway` |
| 置き場の出入り口（サーバー） | `shia2n-core/server/storage-gateway.js` の `createStorageGateway`, `checkStorageGateway` |
| Tokens | `T`, `fmt`, `fmtK`, `currentMonth`, `today`, `p2`, `clamp` |
| Styles | `card`, `lb10`, `mc`, `inp`, `solidBtn`, `ghostBtn`, `mono` |
| Components | `Delta` |
| 共通の外枠 | `mountAppShell`, `setTabTitle`, `appListedFor`, `MEMBER_PREVIEW`, `PORTAL_URL`, `APP_ICONS`, `iconSvg`, `hostOf` |
| 開けるアプリの判定（Firebase を読まない） | `shia2n-core/shell/app-access.js` の `appListedFor`, `GUARD_PASS_STATUSES`。外枠のアプリ一覧とポータルの会員の札が同じこの 1 本を読む |

---

## 更新方法

このリポジトリに直接コミットすると、各アプリで `npm install` し直すだけで反映される。

```
rm -rf node_modules package-lock.json   ← ローカル作業なら
npm install
```

Cloudflare Pages は push で自動で `npm install` するので、アプリ側の再デプロイだけで最新版が適用される。

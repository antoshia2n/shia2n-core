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
| 添付ファイルの置き場（Storage） | これまで通り直結（別途対応） |

### アプリ側の入れ方（2手順）

**1. 受け皿を1ファイル置く** — `functions/api/db/[[path]].js`

```js
import { createDbGateway } from "shia2n-core/server/db-gateway.js";

export const onRequest = createDbGateway({
  basePath:  "/api/db",
  tables:    { sw_swipes: { owner: "user_id" }, sw_zeus_orphans: { owner: "user_id" } },
  functions: ["sw_increment_ref"],
});
```

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
4. 別の表を巻き込んで取り出す書き方を拒否する
5. 管理者キーはサーバーだけが持つ

### 診断

`checkDbGateway(env)` で設定の有無とログイン確認の準備可否だけを返す（値は返さない）。

---

## エクスポート一覧

| カテゴリ | エクスポート |
|---|---|
| Auth | `AuthGuard`, `useAuthUid`, `useAuthUser` |
| Firebase | `auth`, `db`, `firebaseApp` |
| Supabase | `supabase`, `fetchAll`, `fetchOne`, `insertOne`, `updateOne`, `deleteOne`, `upsertOne`, `dbGatewayEnabled`, `dbGatewayPath` |
| 出入り口（サーバー） | `shia2n-core/server/db-gateway.js` の `createDbGateway`, `verifyIdToken`, `checkDbGateway` |
| Tokens | `T`, `fmt`, `fmtK`, `currentMonth`, `today`, `p2`, `clamp` |
| Styles | `card`, `lb10`, `mc`, `inp`, `solidBtn`, `ghostBtn`, `mono` |
| Components | `Delta` |

---

## 更新方法

このリポジトリに直接コミットすると、各アプリで `npm install` し直すだけで反映される。

```
rm -rf node_modules package-lock.json   ← ローカル作業なら
npm install
```

Cloudflare Pages は push で自動で `npm install` するので、アプリ側の再デプロイだけで最新版が適用される。

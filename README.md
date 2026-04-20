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

## エクスポート一覧

| カテゴリ | エクスポート |
|---|---|
| Auth | `AuthGuard`, `useAuthUid`, `useAuthUser` |
| Firebase | `auth`, `db`, `firebaseApp` |
| Supabase | `supabase`, `fetchAll`, `fetchOne`, `insertOne`, `updateOne`, `deleteOne`, `upsertOne` |
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

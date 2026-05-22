# modules/lms/auth/loginLms.js

Wonder Gym LMS（lecturer-portal）に  
**自動ログインした状態の browser / page を取得するための共通認証モジュール**。

---

## 🎯 このモジュールの責務

このディレクトリは、LMS に対する **ログイン処理のみ** を担当します。

- スクレイピングは行わない
- JSON 出力は行わない
- 「ログイン済み状態（page）」を作ることだけに集中する

以降のすべての LMS 処理は、  
**このモジュールが返す「ログイン完了済み page」** を前提に動作します。

---

## 🔧 実装上の前提（重要）

- `openLmsSession()` は Puppeteer の browser を起動し、`browser.newPage()` で page を生成した上でログインします
- `launchBrowser()`（modules/common/browser.js）は **browser を返すだけ**（page は作らない）

この前提により、利用側は常に `{ browser, page }` を受け取れます。

---

## 🚪 使い方（入口）

```js
import { openLmsSession } from "./loginLms.js";

const { browser, page } = await openLmsSession();

// ログイン済み状態で自由に操作できる
await page.goto("<LMS_BASE_URL>/lecturer-portal/");

// 終了時は必ず閉じる
await browser.close();
```

---

## ✅ よくあるエラーと原因

- `Cannot read properties of undefined (reading 'setDefaultTimeout')`
  - `page` が作られていない/渡されていない状態で `loginLms(page)` が呼ばれている可能性があります
  - `openLmsSession()` が `browser.newPage()` を実行しているか確認してください

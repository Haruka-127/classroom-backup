# Google Classroom Student Backup CLI

Google Classroom の生徒アカウントから、本人が閲覧可能な授業データと関連 Drive ファイルをローカルへ保存する CLI です。初回フル同期と、その後の差分同期を想定しています。

## MVP 範囲

- Google OAuth によるローカル CLI 認証
- コース、トピック、お知らせ、課題、教材、提出物の取得
- Drive ファイル metadata、blob、Google Workspace export、コメントの保存
- SQLite / JSON / artifact / manifest によるローカル保存
- フル同期、差分同期、verify コマンド
- `unsupported` / `skipped` / `failed` / `pending_materialization` の記録

## 既知の制約

- Classroom 投稿コメントと private comments は API 非対応のため取得しません。
- `drive.readonly` は restricted scope です。公開配布時は Google 側の審査が必要になる場合があります。
- Google Workspace 文書の export は元データを完全再現しません。
- 学校や組織のポリシーによっては OAuth や API アクセス自体が制限される場合があります。
- `login` は `127.0.0.1` loopback redirect を使います。ローカル待受やブラウザ起動が制限される環境では失敗します。

## セットアップ

1. Node.js 20 以上を用意します。
2. 依存関係をインストールします。

```bash
npm install
```

3. Google Cloud Console で installed app 用の OAuth client credentials JSON を作成します。

## OAuth クライアント設定入力契約

`login` は次の優先順位で credentials を解決します。

1. `login --credentials <path>`
2. `GOOGLE_OAUTH_CLIENT_SECRET_PATH`
3. 設定ディレクトリ内の登録済み `oauth-client.json`

初回ログインでは 1 か 2 が必要です。ログイン成功後、正規化済みの OAuth client 設定をユーザ設定ディレクトリへ保存し、`backup full` / `backup sync` / `verify` は登録済み設定だけを使います。

## 実行例

```bash
node dist/src/cli.js login --credentials "C:\\path\\to\\installed-app-credentials.json"
node dist/src/cli.js backup full --out "D:\\classroom-backup"
node dist/src/cli.js backup sync --out "D:\\classroom-backup"
node dist/src/cli.js verify --out "D:\\classroom-backup"
```

## 取得できるもの

- コース、トピック、お知らせ、課題、教材
- 生徒本人の提出物、回答、添付、提出履歴、成績関連フィールド
- 関連 Drive ファイル metadata、blob、本体 export、コメント

## 取得できないもの

- Classroom 投稿コメント
- private comments
- 教師 / 管理者専用データ
- 非公式 API やスクレイピングが必要な情報

## 推奨運用

- `--out` はこのリポジトリの外を指定してください。
- OAuth client JSON は `login --credentials` で明示的に渡してください。
- バックアップ結果の JSON / SQLite / artifact は Git 管理に入れないでください。

## テストとビルド

```bash
npm test
npm run build
```

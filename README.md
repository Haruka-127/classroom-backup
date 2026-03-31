# Google Classroom Student Backup CLI

Google Classroom の生徒アカウントから、本人が閲覧可能な授業データと関連 Drive ファイルをローカルへ保存する CLI です。初回フル同期と、その後の差分同期を想定しています。

## MVP 範囲

- Google OAuth によるローカル CLI 認証
- コース、トピック、お知らせ、課題、教材、提出物の取得
- Drive ファイル metadata、blob、Google Workspace export、コメントの保存
- `backup.sqlite` 単一ファイルによるローカル保存
- フル同期、差分同期、verify コマンド
- Classroom 風の read-only ローカル viewer
- `unsupported` / `skipped` / `failed` / `pending_materialization` の記録

## 既知の制約

- Classroom 投稿コメントと private comments は API 非対応のため取得しません。
- `drive.readonly` は restricted scope です。公開配布時は Google 側の審査が必要になる場合があります。
- `classroom.rosters.readonly` と guardian 系 scope は学校や組織ポリシーで拒否される場合があります。
- Google Workspace 文書の export は元データを完全再現しません。
- 学校や組織のポリシーによっては OAuth や API アクセス自体が制限される場合があります。
- `login` は `127.0.0.1` loopback redirect を使います。ローカル待受やブラウザ起動が制限される環境では失敗します。
- `viewer` は `127.0.0.1` にのみ bind するローカル専用の read-only 閲覧機能です。
- `viewer` では `People` タブ、投稿コメント、private comments は再現しません。

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

必要な OAuth scope は次の通りです。

- `classroom.courses.readonly`
- `classroom.announcements.readonly`
- `classroom.coursework.me.readonly`
- `classroom.courseworkmaterials.readonly`
- `classroom.topics.readonly`
- `classroom.rosters.readonly`
- `classroom.guardianlinks.me.readonly`
- `classroom.guardianlinks.students.readonly`
- `drive.readonly`

scope が追加・変更された後は、保存済みトークンを再作成するために `login` を再実行してください。

## 実行例

```bash
node dist/src/cli.js login --credentials "C:\\path\\to\\installed-app-credentials.json"
node dist/src/cli.js backup full --out "D:\\classroom-backup"
node dist/src/cli.js backup sync --out "D:\\classroom-backup"
node dist/src/cli.js verify --out "D:\\classroom-backup"
node dist/src/cli.js viewer --out "D:\\classroom-backup" --open
```

## Viewer

`viewer` は、`backup full` または `backup sync` 実行後の `backup.sqlite` だけを read-only で参照するローカル閲覧 UI です。

```bash
node dist/src/cli.js backup full --out "D:\classroom-backup"
node dist/src/cli.js viewer --out "D:\classroom-backup" --port 4173 --open
```

- 先に `backup full` または `backup sync` を実行してください。
- viewer は `127.0.0.1` のみで待ち受けます。
- viewer は DB 初期化や migration を行わず、read-only でバックアップを読みます。
- viewer の artifact 配信も `backup.sqlite` 内の BLOB を直接返します。
- 未再現要素として `People` タブ、投稿コメント、private comments、Classroom の一部装飾があります。
- People 相当の roster / invitation / guardian データはバックアップされますが、viewer UI ではまだ表示しません。

## 取得できるもの

- コース、トピック、お知らせ、課題、教材
- コース詳細、エイリアス、grading period settings、rubric
- 生徒本人の提出物、回答、添付、提出履歴、成績関連フィールド
- roster、user profile、invitation、student group、guardian 系データ
- 関連 Drive ファイル metadata、blob、本体 export、コメント

## 取得できないもの

- Classroom 投稿コメント
- private comments
- 非公式 API やスクレイピングが必要な情報
- Add-ons 専用 endpoint と書き込み endpoint

## 保存形式

- 新しいバックアップ形式は `backup.sqlite` のみです。
- `--out` 配下に `files/`, `json/`, `reports/`, `manifest.json`, `status-report.json` は生成しません。
- verify は SQLite 内の artifact メタデータと BLOB 実体を照合します。
- この変更は旧保存形式との互換を持ちません。既存データは考慮せず、新しいバックアップを作り直す前提です。

## 補足

- guardian / guardian invitation 系 endpoint は、学校やドメイン設定によって空配列または権限エラーになることがあります。
- 追加の Classroom resource も各テーブルの `raw_json` に保存されます。

## 推奨運用

- `--out` はこのリポジトリの外を指定してください。
- OAuth client JSON は `login --credentials` で明示的に渡してください。
- バックアップ結果の `backup.sqlite` は Git 管理に入れないでください。

## テストとビルド

```bash
npm test
npm run build
npm run lint
```

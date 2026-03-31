# Google Classroom Student Backup CLI

Google Classroom の生徒アカウントで閲覧できる授業データと関連する Google Drive ファイルを、ローカルの `backup.sqlite` に保存する CLI ツールです。

バックアップ後は、同じ SQLite ファイルを使って Classroom 風の read-only viewer をローカル起動できます。

## 概要

- Google OAuth でローカル認証する
- Classroom の授業データを取得して SQLite に保存する
- 関連する Drive ファイルのメタデータ、バイナリ、Google Workspace export、コメントを保存する
- 保存済みデータをローカル viewer で閲覧する
- 保存済み artifact の整合性を `verify` で検証する

## 主な機能

- コース、トピック、お知らせ、課題、教材、提出物の取得
- コース別の roster、invitation、student group、guardian 系データの取得
- Drive ファイル metadata、blob、export 物、コメントの保存
- `backup.sqlite` 単一ファイルへの集約保存
- `backup full` と `backup sync` による再同期
- Stream / Classwork / People を表示するローカル viewer
- `failed` `skipped` `unsupported` `pending_materialization` などの状態記録

## 動作要件

- Node.js 20 以上
- Google Classroom API と Google Drive API を利用できる Google アカウント
- Installed app 用の OAuth client credentials JSON
- OS の secure storage

`login` で取得したトークンは `keytar` 経由で OS の secure storage に保存します。キーチェーンや資格情報ストアが使えない環境では、認証や再認証に失敗する可能性があります。

## Quick Start

1. 依存関係をインストールします。

```bash
npm install
```

2. CLI をビルドします。

```bash
npm run build
```

3. Google Cloud Console で Installed application 用の OAuth client を作成し、credentials JSON を取得します。

4. 初回ログインを実行します。

```bash
node dist/src/cli.js login --credentials "C:\path\to\installed-app-credentials.json"
```

5. フルバックアップを作成します。

```bash
node dist/src/cli.js backup full --out "D:\classroom-backup"
```

6. 整合性を確認します。

```bash
node dist/src/cli.js verify --out "D:\classroom-backup"
```

7. viewer を起動します。

```bash
node dist/src/cli.js viewer --out "D:\classroom-backup" --open
```

開発中はビルド済み CLI の代わりに `npm run dev -- <command>` でも実行できます。

```bash
npm run dev -- login --credentials "C:\path\to\installed-app-credentials.json"
npm run dev -- backup full --out "D:\classroom-backup"
```

## セットアップ

### 1. Google Cloud 設定

Google Cloud Console 側で以下を用意してください。

- Google Classroom API
- Google Drive API
- Installed app 用 OAuth client credentials JSON

`login` は loopback redirect を使うため、ローカルブラウザで認証ページを開ける環境が必要です。

### 2. OAuth scope

このアプリは次の scope を要求します。

- `https://www.googleapis.com/auth/classroom.courses.readonly`
- `https://www.googleapis.com/auth/classroom.announcements.readonly`
- `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
- `https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly`
- `https://www.googleapis.com/auth/classroom.topics.readonly`
- `https://www.googleapis.com/auth/classroom.rosters.readonly`
- `https://www.googleapis.com/auth/classroom.guardianlinks.me.readonly`
- `https://www.googleapis.com/auth/classroom.guardianlinks.students.readonly`
- `https://www.googleapis.com/auth/drive.readonly`

scope を追加・変更した場合は、保存済みトークンを取り直すために `login` を再実行してください。

### 3. OAuth client 解決順

`login` は次の順で credentials を解決します。

1. `login --credentials <path>`
2. 環境変数 `GOOGLE_OAUTH_CLIENT_SECRET_PATH`
3. ユーザー設定ディレクトリ内の保存済み `oauth-client.json`

初回ログイン時は 1 または 2 が必要です。ログイン成功後、正規化済みの OAuth client 設定をユーザー設定ディレクトリへ保存します。

## 使い方

### `login`

Google OAuth で認証し、以後の `backup` `verify` `viewer` 実行に必要な認証情報を登録します。

```bash
node dist/src/cli.js login --credentials "C:\path\to\installed-app-credentials.json"
```

オプション:

- `--credentials <path>`: Installed app OAuth client credentials JSON のパス
- `--out <dir>`: 関連パス解決に使う出力ディレクトリ。既定値は `./backup`

### `backup full`

バックアップ先ディレクトリに `backup.sqlite` を作成し、取得可能な Classroom / Drive データを保存します。

```bash
node dist/src/cli.js backup full --out "D:\classroom-backup"
node dist/src/cli.js backup full --out "D:\classroom-backup" --drive-concurrency 6
```

オプション:

- `--out <dir>`: バックアップ出力先
- `--drive-concurrency <number>`: Drive ファイル取得の最大並列数。既定値は `4`

### `backup sync`

既存バックアップを前提に再同期します。現在見えているコースと関連データを再取得しつつ、Drive の変更チェックポイント情報も扱います。

```bash
node dist/src/cli.js backup sync --out "D:\classroom-backup"
node dist/src/cli.js backup sync --out "D:\classroom-backup" --drive-concurrency 6
```

オプション:

- `--out <dir>`: バックアップ出力先
- `--drive-concurrency <number>`: Drive ファイル取得の最大並列数。既定値は `4`

### `verify`

SQLite 内に保存された artifact BLOB を走査し、サイズと SHA-256 を検証します。

```bash
node dist/src/cli.js verify --out "D:\classroom-backup"
```

### `viewer`

保存済み `backup.sqlite` を read-only で参照するローカル viewer を起動します。

```bash
node dist/src/cli.js viewer --out "D:\classroom-backup" --port 4173 --open
```

オプション:

- `--out <dir>`: バックアップ出力先
- `--port <number>`: 待ち受けポート。既定値は `4173`
- `--open`: 起動後にブラウザを開く

viewer は `127.0.0.1` のみに bind します。

## 保存場所とローカルデータ

### バックアップ出力

`--out` で指定したディレクトリには、現在の実装では次のファイルだけを作成します。

- `backup.sqlite`

以前の JSON やファイルツリー形式は使っていません。`files/` `json/` `reports/` `manifest.json` `status-report.json` などは生成されません。

### OAuth client 設定

ログイン成功後、正規化済み OAuth client 設定はユーザー設定ディレクトリに保存されます。

- Windows: `%LOCALAPPDATA%\classroom-backup\oauth-client.json`
- macOS: `~/Library/Application Support/classroom-backup/oauth-client.json`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/classroom-backup/oauth-client.json`

### OAuth トークン

トークンは `keytar` 経由で OS の secure storage に保存され、`backup` 実行時に再利用されます。

## viewer で見られるもの

viewer は `backup.sqlite` を read-only で読み込み、ローカルブラウザから次の情報を表示します。

- コース一覧
- コース詳細
- Stream タブ
- Classwork タブ
- People タブ
- 課題と教材の詳細ページ
- 保存済み artifact へのリンク

viewer 自体は migration や再同期を行いません。バックアップ済みデータの閲覧専用です。

## 取得できるデータ

- コース、トピック、お知らせ、課題、教材
- コース詳細、エイリアス、grading period settings、rubric
- 生徒本人の提出物、添付、提出履歴、成績関連フィールド
- roster、user profile、invitation、student group、guardian 系データ
- 関連 Drive ファイル metadata、blob、Google Workspace export、コメント
- 各種 raw API payload

## 取得できないデータ

- Classroom 投稿コメント
- private comments
- 非公式 API やスクレイピングが必要な情報
- Add-ons 専用 endpoint
- 書き込み系 endpoint

## 既知の制約

- `drive.readonly` は restricted scope です。公開配布時は Google 側の審査が必要になる場合があります。
- `classroom.rosters.readonly` や guardian 系 scope は、学校や組織ポリシーで拒否される場合があります。
- 学校や組織のポリシーによっては OAuth や API アクセス自体が制限される場合があります。
- Google Workspace 文書の export は元データを完全再現しません。
- guardian / guardian invitation 系 endpoint は、環境によって空配列または権限エラーになることがあります。
- `login` は `127.0.0.1` loopback redirect を使います。ローカル待受やブラウザ起動が制限される環境では失敗します。
- `viewer` はローカル専用です。外部公開は想定していません。

## 推奨運用

- `--out` はこのリポジトリの外を指定する
- OAuth client JSON は `login --credentials` で明示的に渡す
- `backup.sqlite` や credentials JSON を Git 管理に入れない
- scope を変えたら `login` をやり直す
- 長期運用では `backup sync` と `verify` を定期実行する

このリポジトリの `.gitignore` には `backup/` `*.sqlite*` `client_secret*.json` `oauth-client*.json` などが含まれています。

## 開発

### よく使うコマンド

```bash
npm run dev -- --help
npm run test
npm run lint
npm run build
```

### CLI ヘルプ

```text
Usage: classroom-backup [options] [command]

Google Classroom student backup CLI

Options:
  -V, --version     output the version number
  -h, --help        display help for command

Commands:
  login [options]   Authenticate with Google and register the OAuth client
  backup            Run backup operations
  verify [options]  Verify manifest and saved artifacts
  viewer [options]  Start the local Classroom-style backup viewer
  help [command]    display help for command
```

### ディレクトリ構成

```text
src/        CLI、本体ロジック、同期、SQLite、viewer server
viewer/     React + Vite 製の viewer フロントエンド
tests/      Vitest ベースのテスト
```

## ライセンス

この README にはライセンス情報を記載していません。必要であれば別途 `LICENSE` を追加してください。

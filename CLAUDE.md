# ソムリンアプリ フロント — 作業ルール

このリポジトリ（`~/dev/sommelin-app`）はソムリンアプリのフロントエンド本番です。各チャットはまずこのルールに従ってください。人間向けの詳しい運用手順は同じフォルダの `作業手順.md` を参照。

## 触る場所
- 編集・デプロイは **このリポジトリ（`~/dev/sommelin-app`）だけ**。
- `~/Documents/Claude/Projects/ソムリンアプリ/`（iCloud）は **旧コピー。コードは編集しない**。Cowork起動時にそちらが選ばれていたら `~/dev/sommelin-app` を `request_cowork_directory` で接続してから作業する。
- backend は別リポジトリ `~/dev/sommelin-trade-platform`。

## デプロイ
- 公開は **ユーザーがデスクトップの「フロント-デプロイ」をダブルクリック** して行う（git add→commit→push、GitHub Pages へ）。
- **アシスタントは git commit / push を代行しない。** 編集まで行い、デプロイはユーザーに依頼する。
- 公開URL: https://sommelintp.github.io/sommelin-app/ （反映1〜2分。確認は `?cb=...` でキャッシュ回避してリロード）

## 主要ファイル（いずれも単一HTML・モバイル幅430px・外部依存なし）
- `prototype.html` 顧客向け / `importer_admin.html` インポーター管理（カレンダー・発信・顧客・カタログ）/ `restaurant_admin.html` 酒販店・飲食店管理 / `login.html`・`onboarding.html` 登録と役割分け / `cellar.html`・`wine_search.html`・`wine_ar.html`・`sommelier-chat.html`
- カラー: `--burgundy #9B1B4B` / `--wine-dark #5C0E2A` / `--gold #C9973A`。データは Supabase に対応する設計。

## チャットを安定させる（重要）
- 会話が長大化すると **ツール呼び出しが壊れて「途中で止まる」**（"malformed" エラー）。用件ごとにチャットを分け、重くなったら新チャットへ。
- 引き継ぎは会話ではなく **git（コード）＋メモ** が担う。だから新チャットでも続きから動ける。
- 巨大ファイルの全読みや巨大データの読み込みを乱発しない（必要な箇所だけ読む）。

## つまずきポイント
- **ESET** が github.io をフィッシングと誤検知してブロックすることがある → ESET で許可、またはスマホで確認。セキュリティ警告は突破しない。
- git commit が bus error: `rm -f .git/index && git reset` → 再 add/commit/push（iCloud 起因。`~/dev` では基本起きない）。
- SQL は Supabase の SQL Editor で実行（ターミナル貼り付けは NG）。

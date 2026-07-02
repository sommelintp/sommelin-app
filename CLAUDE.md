# ソムリンアプリ フロント — 作業ルール

このリポジトリ（`~/dev/sommelin-app`）はソムリンアプリのフロントエンド本番です。各チャットはまずこのルールに従ってください。人間向けの詳しい運用手順は同じフォルダの `作業手順.md` を参照。

## 触る場所
- 編集・デプロイは **このリポジトリ（`~/dev/sommelin-app`）だけ**。
- `~/Documents/Claude/Projects/ソムリンアプリ/`（iCloud）は **旧コピー。コードは編集しない**。Cowork起動時にそちらが選ばれていたら `~/dev/sommelin-app` を `request_cowork_directory` で接続してから作業する。
- backend は別リポジトリ `~/dev/sommelin-trade-platform`（**Google Cloud Run** で稼働。2026-06-25にRailwayから移行。デプロイ=`main` へ push → Cloud Build が自動ビルド&デプロイ。`ANTHROPIC_API_KEY` 等は Cloud Run の環境変数に設定済）。

## デプロイ
- 公開は **ユーザーがデスクトップの「フロント-デプロイ」をダブルクリック** して行う（git add→commit→push、GitHub Pages へ）。
- **アシスタントは git commit / push を代行しない。** 編集まで行い、デプロイはユーザーに依頼する。
- 公開URL: https://sommelintp.github.io/sommelin-app/ （反映1〜2分。確認は `?cb=...` でキャッシュ回避してリロード）

## 主要ファイル（いずれも単一HTML・モバイル幅430px・外部依存なし）
- `prototype.html` 顧客向け / `importer_admin.html` インポーター管理（カレンダー・発信・顧客・カタログ）/ `restaurant_admin.html` 酒販店・飲食店管理 / `login.html`・`onboarding.html` 登録と役割分け / `scouter.html`（本番スカウター＝アプリの入口）・`cellar.html`・`wine_search.html`・`sommelier-chat.html`（`wine_ar.html`＝旧ARデモ/モック）
- カラー: `--burgundy #9B1B4B` / `--wine-dark #5C0E2A` / `--gold #C9973A`。データは Supabase に対応する設計。

## チャットを安定させる（重要）
- 会話が長大化すると **ツール呼び出しが壊れて「途中で止まる」**（"malformed" エラー）。用件ごとにチャットを分け、重くなったら新チャットへ。
- 引き継ぎは会話ではなく **git（コード）＋メモ** が担う。だから新チャットでも続きから動ける。
- 巨大ファイルの全読みや巨大データの読み込みを乱発しない（必要な箇所だけ読む）。

## つまずきポイント
- **ESET** が github.io をフィッシングと誤検知してブロックすることがある → ESET で許可、またはスマホで確認。セキュリティ警告は突破しない。
- git commit が bus error: `rm -f .git/index && git reset` → 再 add/commit/push（iCloud 起因。`~/dev` では基本起きない）。
- SQL は Supabase の SQL Editor で実行（ターミナル貼り付けは NG）。

## スカウター & データ（2026-07-02 現在）
- **スカウター＝アプリの中核入口**。本番は `scouter.html`。`wine_ar.html` は旧ARデモ。
- **ビジョンAI版に書き換え済み（Tesseract廃止）**。流れ＝撮影（長辺1024px JPEGに縮小）→backend `POST /api/identify`→Claude vision（claude-sonnet-4-6）で銘柄特定→`match_wines` 照合→known なら実SP・コスパ／unlisted なら特定情報＋近縁おすすめ（**SP捏造なし＝no-lie原則**）。キーは Cloud Run の `ANTHROPIC_API_KEY`（設定済）。
- backend 実装: `~/dev/sommelin-trade-platform/src/routes/identify.js`（CORS=GitHub Pagesのみ許可・レート制限・scan_events自動記録）。**デプロイ＝backendリポを main に push**（Cloud Build 自動）。
- **要設定**: `scouter.html` 冒頭の `API_BASE` に Cloud Run のURLを入れる（暫定は `?api=https://…run.app` パラメータでも設定可＝localStorageに保存）。
- 設計書: `Documents/Claude/Projects/ソムリンアプリ/スカウター_ビジョンAI_エンドポイント設計.md`（no-lie原則・レスポンス契約・フライホイール）。
- フロントは Supabase を **publishable キーで直接 read/rpc**（既存の管理画面と同方式）。秘密鍵は backend のみ。publishableキーは `gkhdpzfmqraliwaiubwl.supabase.co` / `sb_publishable_...`。
- **wines マスター**: `cospa_clean_scored.csv` 由来（列= name/producer/iro/kuni/chiiki/vintage/price/sp/osu_gbm 等）。あいまい一致は RPC `match_wines(q,lim)`。現在 **15,563件**投入済（フル 62,566 は投入途中＝要再投入）。横文字名 `name_romanized` は未投入（英字ラベル照合用に要充填）。
- **コスパ**＝おすすめ度 `osu_gbm`/`osu_lin` = SP − 価格から期待されるSP（プラスほど割安）。
- DB定義SQL: `~/dev/sommelin-trade-platform/migrations/2026-06-25_scouter_wines.sql`（テーブル＋RPC＋RLS）と `..._scouter_load_master.sql`（ステージング→wines）。
- 今回更新済の画面: `wine_search.html`（結果トップに実SP・コスパ表示）/ `cellar.html`（端末保存=localStorage）/ `prototype.html`（マイページから scouter・cellar・検索・AIソムリエへ導線追加）/ PWA: `manifest.webmanifest`・`sw.js`。

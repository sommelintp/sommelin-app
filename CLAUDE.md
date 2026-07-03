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
- **ビジョンAI版（Tesseract廃止）＋オーバーレイUX（2026-07-02改修）**。撮影（長辺1568px JPEG）→`POST /api/identify-shelf`→写真内の**全ボトル（最大12本）を位置つきで検出・照合**→撮った写真を画面に固定し、各ボトルの位置にマーカー（👑ベスト/❤️好み/★SP/未登録/?）をオーバーレイ表示。タップで下から詳細カード（近縁おすすめは `GET /api/similar`＝DB照会のみで遅延読込）。**画面遷移なし＝Googleレンズ方式**。1本だけの写真も同じ流れ（自動でカードが開く）。known のみ実SP・コスパ表示（**SP捏造なし＝no-lie原則**）。旧 `POST /api/identify`（1本用）はbackendに残置だがフロントは未使用。キーは Cloud Run の `ANTHROPIC_API_KEY`（設定済）。
- backend 実装: `~/dev/sommelin-trade-platform/src/routes/identify.js`（CORS=GitHub Pagesのみ許可・レート制限・scan_events自動記録）。**デプロイ＝backendリポを main に push**（Cloud Build 自動）。
- **リストモード**（2026-07-02追加）: `POST /api/identify-list`＝ワインリスト1枚を一括解析→全行を照合し SP/コスパ/好み度/リスト価格vs参考価格を返す。複数ページはフロントから1枚ずつ送って累積（リアルタイムなし＝コスト最小方針）。
- **好み学習**（2026-07-02追加）: `taste.html`＝好きなワイン/セラー写真→`POST /api/taste/upload`（写真内の全ボトル抽出→`taste_items` に保存。写真自体は保存しない）。3本以上で `personalFit`（好み度）が identify/list の結果に出る。ユーザー識別は匿名UUID（localStorage `somm_uid`）。テーブル定義: `migrations/2026-07-02_taste_items.sql`（**Supabase SQL Editorで要実行**）。
- **要設定**: `scouter.html` 冒頭の `API_BASE` に Cloud Run のURLを入れる（暫定は `?api=https://…run.app` パラメータでも設定可＝localStorageに保存）。
- 設計書: `Documents/Claude/Projects/ソムリンアプリ/スカウター_ビジョンAI_エンドポイント設計.md`（no-lie原則・レスポンス契約・フライホイール）。
- フロントは Supabase を **publishable キーで直接 read/rpc**（既存の管理画面と同方式）。秘密鍵は backend のみ。publishableキーは `gkhdpzfmqraliwaiubwl.supabase.co` / `sb_publishable_...`。
- **wines マスター**: `cospa_clean_scored.csv` 由来（列= name/producer/iro/kuni/chiiki/vintage/price/sp/osu_gbm 等）。あいまい一致は RPC `match_wines(q,lim)`。現在 **15,563件**投入済（フル 62,566 は投入途中＝要再投入）。横文字名 `name_romanized` は未投入（英字ラベル照合用に要充填）。
- **コスパ**＝おすすめ度 `osu_gbm`/`osu_lin` = SP − 価格から期待されるSP（プラスほど割安）。
- DB定義SQL: `~/dev/sommelin-trade-platform/migrations/2026-06-25_scouter_wines.sql`（テーブル＋RPC＋RLS）と `..._scouter_load_master.sql`（ステージング→wines）。
- 今回更新済の画面: `wine_search.html`（結果トップに実SP・コスパ表示）/ `cellar.html`（端末保存=localStorage）/ `prototype.html`（マイページから scouter・cellar・検索・AIソムリエへ導線追加）/ PWA: `manifest.webmanifest`・`sw.js`。
- **prototype.html の実データ化（2026-07-02）**: ①試飲会カレンダー/イベント一覧＝実 `events` テーブル（LINE bot蓄積・anon読取可・status=published）を `loadRealEvents()` で読込。申込みボタンは実 `registration_url` を開く（URL無しは無効化＝偽の申込完了を出さない）。②ランキング＝実 `wines` を osu_gbm 降順で `loadRealRanking()`。③カメラ画面の偽スキャン廃止→ `scouter.html`（`?mode=list` でリストモード直行）。
- **残モック3機能も実装済み（2026-07-03）**:
  - **店内ワインリスト**: `restaurant_admin.html` のリスト管理を Supabase `restaurant_wines`＋`restaurant_settings` に配線（CRUD・公開切替・QR=`prototype.html?r=<owner_id>`）。写真一括インポートは実 `/api/identify-list`（マスター一致分は wine_id 保存）。客側は `prototype.html?r=` で実店舗リスト表示＝クラシックビュー（マスター一致ワインに⭐SP表示）。デモ（Bistrot Lumière）は ?r= 無しの時のみ。テーブル定義: `migrations/2026-07-03_restaurant_wines.sql`（**SQL Editorで要実行**）。
  - **来店履歴**: 端末内 localStorage（`sommelin_visits`=QRでリストを開くと記録／ワインタブ=cellar.htmlと共通の `somm_cellar_v1`）。サーバー送信なし・空状態あり。
  - **AIチャット**: backend `POST /api/chat`（Haiku・レート制限・no-lie=個別SP/在庫は断定せずスカウターへ誘導・taste_profileがあれば好みを加味）。`sommelier-chat.html`（FREE_LIMIT=5/セッション維持）と `prototype.html` のウィジェット両方を配線。定型返信(somurinReplies)は廃止。
- **在庫機能の本物化（2026-07-03）**: `restaurant_admin.html` の「📦在庫」パネルを **`restaurant_wines` と同一データの簡易ビュー**に統合（旧 localStorage `sommelin_store_inventory` 連携は他端末に届かない見せかけだったため廃止。STORE_INFO ハードコードも削除）。「🌐公開する」＝`restaurant_settings`（店舗名/住所/is_public）への実保存。`wine_search.html` の「近くのお店」は公開店舗の `restaurant_wines` を実検索（RLSで非公開店は自動除外）。**偽データのseed（架空の在庫店・インポーターカタログ）は全廃**。住所カラム: `migrations/2026-07-03_settings_address.sql`（**SQL Editorで要実行**）。
- **イベント管理の本物化（2026-07-03）**: ①`importer_admin.html` の新規イベント作成 → backend `POST /api/importer-events`（SupabaseユーザーJWTを検証・profiles.role=importer/adminのみ・events表にstatus=published/source_type=webで保存。LINE botと同じテーブル）。②両管理画面のモックイベントシード（架空の試飲会4件/自社イベント）を全廃＝実`events`のみ表示。③`restaurant_admin.html`の参加申込み＝偽の送信演出を廃止し実`registration_url`を開く方式に（prototype と同方式）。※イベント編集/削除UIは未実装（作成のみ）。
- **イベント作成フォーム改善（2026-07-03 実機FBより）**: ①CORSバグ修正（Authorizationヘッダー未許可で保存が全滅していた）②日付のUTCズレ修正（toISOString→ローカル日付）③複数日開催対応（日付チップUI。backendは `eventDates[]` を受け1日=1行でinsert＝LINE botと同方式）④時間帯はtimeピッカー2つに（自由入力廃止）⑤部制・休憩は任意テキストとしてdescriptionに【時間・部制】で追記（実データの慣習に合わせ構造化しない）。
- **街のワインデータ収集（2026-07-03）**: スカウターのリストモードで解析後に「📍 このお店を記録（匿名・任意）」→ GPS→`GET /api/places/nearby`（OSM Overpass=無料・キー不要）で近隣店候補→選択 or 店名手入力→`POST /api/report-place` が `places`(upsert)＋`venue_list_items`(リスト全行・未登録銘柄も生名で)＋`price_sightings`(マスター一致×ボトル価格) に保存。「どこで飲める？」機能の燃料。テーブル定義: `migrations/2026-07-03_venue_sightings.sql`（**SQL Editorで要実行**）。

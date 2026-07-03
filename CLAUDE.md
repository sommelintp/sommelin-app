# ソムリンアプリ フロント — 作業ルール
<!-- deploy-retrigger: 2026-07-04 GitHub Pages詰まり対策の再push用（#27 Queued詰まり） -->

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

## 事業方針とマイルストーン（2026-07-04 オーナー決定）
- **課金は当面見送り・無料でたくさん使ってもらう**。利用ログで「どの機能に価値があるか」を観測してからプラン設計→有料化（クォータ基盤は実装済みで待機。CHAT_FREE_LIMITはCloud Run環境変数で緩められる）。
- **2026-07-08 に知り合いへお披露目**。それまでの優先順: ①利用ログ基盤（済） ②年間ベスト表彰ページ ③winesフル投入 ④デモ動線の掃除。
- **データ=資産**: winesマスターのSP/コスパは競争力の源泉。`wines`が全件anon読み取り可なのは**デモ後に要修正**（読み方を変える大工事のためデモ直前は避ける）。
- **著作権ルール（2026-07-04 オーナー指示）**: 他媒体（雑誌・批評家・他サイト）の**文章は絶対にそのまま使わない**。事実（銘柄名・産地・価格・点数）はOK、表現はNG。①`external_ratings`は数値スコア＋出典名＋URLのみ（批評文のテキスト欄を作らない・追加しない）②AIチャットのsystemプロンプトに引用・転載禁止を明記済み③ワイン説明文は常にAI生成 or 自社作成のオリジナルのみ④外部データの大量一括取り込みをする際は出典元の利用規約を確認してから。
- **共通利用ログ基盤（2026-07-04実装）**: `app_events`テーブル（uid/auth_uid/role/page/event/meta。書き込み専用・anonから読み取り不可。定義: `migrations/2026-07-04_app_events.sql` **SQL Editorで要実行**）。全11ページに共通スニペット（`sommLog(event, meta)`＋自動page_view）を挿入済み。主要アクション: scan(shelf/list)・chat_send(photo有無)・search・cellar_add・taste_upload・report_place・tab_view・wine_add・tasting_save・event_create。**新機能には必ずsommLogを仕込むこと**。分析はSQL Editorで（migrationファイル末尾にクエリ例）。

## 認証・複数業態（2026-07-03）
- **複数業態アカウント**: `profiles.roles text[]`（例 `{importer,store}`）を追加。既存 `role` は「メイン業態」（ログイン後の初期画面決定用）として残す。入口ガード3枚（importer_admin/restaurant_admin/onboarding）とbackend `verifyRole` は**配列の交差判定**に変更。ガードが `localStorage.sommelin_roles`（JSON配列）を保存。両業態持ちはヘッダーのバッジが**切替ボタン**になる（「インポーター ⇄ 店舗」タップで相互移動。単一業態では通常表示のまま）。業態の追加はv1では運営がSQLで実施（`migrations/2026-07-03_multi_roles.sql` 末尾に例。**SQL Editorで要実行**）。サインアップトリガー `handle_new_user` も roles 初期化に更新済み。
- **業態の可視化＋ログアウト＋ロゴ（2026-07-03 実機FB）**: 絵文字統一＝🚢インポーター/🛒酒販店/🍽レストラン。管理画面ヘッダーは店名の下段に**金色の業態バッジ**（現在の業態を明示）＋他業態持ちには「⇄ ○○に切替」ボタン（roleRow）。ヘッダー右上に⏻ログアウト（Supabaseセッション無効化＋localStorage消去→login.html）。**ヘッダーの店名・アイコンは実データ**（ガードが `profiles.display_name/avatar_url` を `localStorage.sommelin_profile` に保存→`initHeaderIdentity()` が反映）。アイコンタップ→ロゴ変更（256px正方形にトリミング→Storage `avatars/<uid>/logo.jpg` にupsert→`profiles.avatar_url` 更新。バケット/RLS: `migrations/2026-07-03_avatars.sql` **SQL Editorで要実行**）。login.htmlの業種選択に「複数業態はまず主な業態で登録→後から追加」の案内追加・酒販店絵文字🛒に統一。

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
- **イベント作成フォーム第2弾（2026-07-03 実機FB第2回）**: ①保存失敗の根本原因＝`events.importer_id`がLINE用`accounts`表への必須FKでWeb認証と未接続 → backendが**橋渡しaccounts行を自動作成**（`line_user_id='web:<auth uid>'`・`account_type='importer'`）して紐付け。②日付は選んだ瞬間チップに自動追加（追加ボタン廃止）。③時間欄のflexはみ出し修正（min-width:0）。④部制セレクト（一斉〜5部制）×休憩セレクト→開始/終了から各部時間を自動計算し編集可能テキストに。⑤会場サジェスト＝`GET /api/places/search`（**Nominatim**=OSM無料ジオコーダ・要User-Agent・24hキャッシュ）で店名→候補ドロップダウン→住所も自動セット（venue_address保存）。
- **イベント作成フォーム第3弾（2026-07-03 実機FB第3回）**: ①開催日をnative `<input type=date>`から**自作カレンダー**（月表示・タップでハイライト選択/解除・prototype.htmlのrenderCalendarと同パターン）に変更＝選択状態が視覚的に一目瞭然に。②部制を10部制まで拡張。③休憩を選択式(15/30/45/60分)から**5分刻みの数値入力**に変更（数時間の休憩も分換算で入力可）。④時間欄はみ出しは375px実測で再現せず（デプロイ済みのmin-width:0修正で解消と判断・再発時は詳細画面を要確認）。
- **イベント作成フォーム第4弾（2026-07-03 実機FB第4回）**: ①保存失敗のエラーメッセージをbackendの実エラー文をそのまま返す形に変更（原因特定用・次回失敗時に真因が分かる）。②開始/終了時間を横並びflexから**縦積み**に変更（3回目の指摘のため、環境依存の可能性がある横並びのリスクを構造的に排除）。③会場サジェストの体感速度改善：入力直後に「検索中…」を即表示、デバウンス600ms→250ms、入力が進んだ場合は古い結果を破棄。④「公開設定」トグル（インポーター全員/配信先店舗のみ）を削除——`target_type`はLINE bot側でも一度も設定されておらず実質未使用と判明、かつ「配信先店舗のみ」は実際の店舗選択（発信タブの`selectedIds`ベースの配信機能）と未接続の見せかけだった。案内文「登録後は発信タブから店舗を選んで配信可能」に置き換え。
- **会場サジェストGoogle化（2026-07-03）**: `GET /api/places/suggest`＋`/api/places/detail`＝Google Places Autocomplete(New)のbackendプロキシ（セッショントークン方式=候補→detail終端で$0枠。キーはCloud Run環境変数 `GOOGLE_MAPS_API_KEY`。**未設定時はPhotonに自動フォールバック**）。旧 `/api/places/search`(Photon)は残置。
- **試飲メモ＝良かったワインリスト（2026-07-03）**: `restaurant_admin.html` に第5タブ「📸試飲メモ」。カメラロールの写真（複数）→ `/api/identify-shelf` でAI認識→インポーター名・メモを添えて `tasting_notes` へ保存（RLS=本人のみ。定義: `migrations/2026-07-03_tasting_notes.sql` **SQL Editorで要実行**）。表示は 実データ（SP・参考小売のスナップショット）＋一般掛け率明示の目安（仕入=小売7〜8割・提供=仕入2.5〜3倍・グラス=1/4）＋「🍽合う料理をAIに聞く」（既存 `/api/chat` 再利用）。インポーター側は `importer_admin.html` 顧客タブ先頭の「💬反響」→ `GET /api/tasting-feedback?importer=`（要importer権限・店舗名は公開設定店のみ実名）。
- **店舗向けSP格下げ＋★評価（2026-07-03 オーナー方針）**: SPは辛口基準のため店舗に嫌われるリスクあり→試飲メモでは**表に出さない**。前面は「お店の評価★（保存時に1〜5をタップ入力・同じ星再タップで解除）」と「ソムリンおすすめ度★（osu→星5変換、scouterのcospa閾値と同一）」。SPは`<details>`内のみ（「プロ向け辛口基準」注記つき）＋**みんなの評価**＝同一wine_idへの全店舗★の匿名平均（`GET /api/wine-buzz?wineId=`・遅延取得）。列追加: `migrations/2026-07-03_tasting_notes_rating.sql`（rating/osu **SQL Editorで要実行**）。
- **トータル評価＝信頼度加重ベイズ平均（2026-07-03 中核設計）**: `GET /api/wine-score?wineId=`＝ `(Σw·★ + C·m)/(Σw + C)`（m=3.5, C=3）。参加者: ①店舗★（`rater_profiles.base_weight`×活動量ボーナス最大2倍。プロファイル無し=重み1）②SP＝創業者評価（sp2star: SP2→1★/SP8→5★の線形・要校正、重み5）③`external_ratings`（批評家・雑誌の取り込み箱。scale_max換算）。`condition_issue=true`（ブショネ等チェック）は集計除外。**年間ベスト**: `GET /api/best-wines?year=&min=&limit=`（その年の評価件数min以上を加重スコア順）。将来の変数対応の仕込み: 好み補正=評価者平均偏差（全評価が評価者別に残る構造で追加可）／忖度検出=importer_name×自社照合／著名評価者の重みは`rater_profiles`をSQLで引き上げ。テーブル: `migrations/2026-07-03_wine_total_score.sql`（**SQL Editorで要実行**）。
- **AIチャットの写真添付機能（2026-07-03）**: `sommelier-chat.html`と`prototype.html`ウィジェットの両方に📷ボタンを追加。写真（長辺1024px JPEG・scouterと同じgrabFrame方式）を添付してメッセージ送信すると、backendが`/api/identify`と同じvision解析＋`match_wines`照合を内部で実行→winesマスターに実在すれば実SP・コスパを、未登録なら「不明」と正直に伝えた上で、Haikuが自然な会話文で回答（no-lie原則を継承。写真解析結果は`[写真解析結果]`ブロックとしてsystemプロンプトに事実のみ注入し、それ以外の数値は作らせない）。写真付きメッセージも既存の月5回クォータに算入（テツヤさんの決定通り、別枠は作らず同じusage_counters流用）。画像解析はvisionコール＋DB照合＋チャット応答生成の計2回API呼び出しになる分コストは高いが、実装をシンプルに保つことを優先。
- **AIチャット月5回制限の本物化（2026-07-03）**: 従来はフロントlocalStorageの見せかけカウント（リロードで回避可）だった月5回制限を**サーバー側執行**に変更。テーブル `usage_counters`（uid×feature×年月。feature='chat'、将来scouterにも流用可）＋ `premium_users`（運営がSQLで手動付与=無制限。Stripe導入時はwebhookが書く想定）＋ 原子的RPC `increment_usage`/`decrement_usage`（migrations/**2026-07-03_usage_quota.sql** SQL Editorで要実行）。backend: `/api/chat` がクォータ判定（プレミアム→無制限／超過→403 quota_exceeded／AI失敗時は返却／カウンター障害時はフェイルオープンでチャット継続）、`GET /api/chat-quota?userId=` で残数照会（消費なし）。無料上限はenv `CHAT_FREE_LIMIT`（既定5）。フロント: `sommelier-chat.html`（残数=サーバー値表示・取得前は「…」・somm_uid自動生成）と `prototype.html` ウィジェット両方が403対応。**架空の料金プラン（¥3,000/¥9,800）表示は全廃**→「プレミアム準備中・毎月1日リセット・スカウターは無制限」の正直表示に（no-lie）。決済（Stripe）は価格決定後にこの基盤の上に実装する方針（2026-07-03オーナー決定: まず無料で様子見・特典=チャット無制限＋将来スカウター制限も視野）。
- **旧モック3画面の引退（2026-07-03）**: `wine_ar.html`（旧ARデモ）→scouter.htmlへ転送 / `winelist.html`（Bistrot Lumière固定デモ）→prototype.htmlへ転送 / `line_liff_register.html`（未接続の見た目モック）→LINE公式 `@sommelin_official` 友だち追加へ転送。3ファイルとも中身をリダイレクトページに置換（元コードはgit履歴）。参照元も差し替え済み: prototype.htmlのARカード削除＋偽「最近スキャンしたワイン」削除＋非公開バナーのQRデモボタン削除 / cellar.htmlナビ「リスト」→「🔍検索」(wine_search.html) / index.htmlのLINEバナー→公式友だち追加・デモカードLIFF→スカウターに差替。
- **街のワインデータ収集（2026-07-03）**: スカウターのリストモードで解析後に「📍 このお店を記録（匿名・任意）」→ GPS→`GET /api/places/nearby`（OSM Overpass=無料・キー不要）で近隣店候補→選択 or 店名手入力→`POST /api/report-place` が `places`(upsert)＋`venue_list_items`(リスト全行・未登録銘柄も生名で)＋`price_sightings`(マスター一致×ボトル価格) に保存。「どこで飲める？」機能の燃料。テーブル定義: `migrations/2026-07-03_venue_sightings.sql`（**SQL Editorで要実行**）。

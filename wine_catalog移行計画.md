# wine_catalog 移行計画（2026-07-05 策定）

頭脳プロジェクト（ソムリンワイン評価効率化）が完成させた正本テーブル `wine_catalog`（67,034銘柄・多言語・産地4階層・SP・年別コスパ）へ、アプリの全機能を段階的に接続する計画。

**原則（頭脳側の指示。厳守）**
1. wine_catalog が正。アプリ都合で構造・master行の値を変更しない
2. SP とコミュニティ評価は別軸。混ぜない
3. プッシュ型おすすめ（ランキング・recommend）は `recommendable=true` のみ
4. プル型（スカウター遭遇時）は全年対象。実売価格×年別係数で「今日のコスパ」を計算
5. 未知ワインは entry_source + curation_status='pending' で追加可（masterは名乗れない）
6. スキーマ外の情報は catalog_observations へJSONB記録（捨てる操作は存在しない）
7. 甘辛は整備中。断定表示しない

## 中核の設計判断：ID の橋渡し

既存 `wines.id`（bigint）を FK に持つテーブルが9つある（filter_items / taste_items / tasting_notes / restaurant_wines / venue_list_items / price_sightings / barcodes / scan_events / external_ratings）。wine_catalog は UUID。**一斉張り替えはしない**。

- **名寄せマップ** `wines_catalog_map (wine_id bigint PK, catalog_id uuid, method text)` を作る
  - 突合キー: (名前, 生産者, ヴィンテージ, 価格) の完全一致 → 残りは trgm 類似で候補を作り確信度つきで採用
  - 既存 wines は cospa_clean_scored 由来（15,563件）＝wine_catalog と同じ元データ（入力シート）由来なので高一致率が見込める
- **9テーブルに `catalog_id uuid` 列を追加**（wine_id は残す＝過去データ互換）
  - 新規書き込みは catalog_id を正とする。過去行はマップで backfill
- **読み取りは catalog_id 優先**、無ければ wine_id→マップ経由（移行期間の互換読み）

## フェーズ

### Phase 1: 投入と名寄せ（アプリ無変更＝無リスク）★進行中
1. ✅ 完了: catalog_observations の定義を頭脳側が supabase_wine_catalog.sql 末尾に追記済み（テーブル+索引+RLS）。**頭脳側で既に実行済み（再実行不要）**。定義書として参照。列: `wine_id`(→wine_catalog.id・不明時null) / `target_type` / `kind`(自由) / `payload` jsonb / `source` / `review_status`(new→頭脳側が精査してadopted/rejected/archivedへ)。rejectedも含め行は削除しない。
2. `supabase_wine_catalog.sql` を SQL Editor で実行（wine_catalog本体。catalog_observations部分は IF NOT EXISTS のため再実行しても無害） — **実行待ち**
3. ✅ 完了（2026-07-05）: ワインマスター_v1.tsv（67,034行）→ wine_catalogスキーマの4分割CSVに変換 → **投入完了。`select count(*)`=67,034件で完全一致を確認済み**
   - 出力先: `~/Documents/Claude/Projects/ソムリンアプリ/wine_data_hub/catalog_chunks/catalog_part1〜4.csv`
   - 投入SQL: `~/dev/sommelin-trade-platform/migrations/2026-07-05_wine_catalog_load.sql`
   - つまずいた点（次回の教訓）: ①CSV取込時にSupabaseが一部の数値っぽい列(data_year等)を自動でbigint型と判定→`btrim(bigint)`エラー。全列を`::text`にキャストしてから処理する形に修正して解消。②再実行で一部重複→`ON CONFLICT (src_pdf,src_no) WHERE entry_source='master' DO NOTHING`で冪等化。③ソースデータに「オープン(1200)」「未定」等の非数値価格、SP列に「2,3」のようなカンマ小数やブドウ品種名の混入（列ズレ）が511件（0.8%）→ 正規表現で数値と確認できたものだけキャストし、それ以外はNULL（捏造しない）。カンマ小数はピリオドに正規化。**この511件の列ズレは頭脳側のソースデータ品質issue→報告推奨**
4. ✅ 完了（2026-07-05）: 名寄せマップ作成 SQL実行（`migrations/2026-07-05_wines_catalog_map.sql`）→ **一致率96.8%（15,063/15,563）で目標95%達成**。内訳: exact 15,057 / fuzzy(trgm) 6。未一致500件はほぼ全てproducer NULL＝③の列ズレ511件と同一原因の可能性大。頭脳側（ソムリンDBセッション）へ報告済み。列ズレ修復後に再実行すれば一致率さらに向上見込み
5. 9テーブルへ catalog_id 列追加＋マップで backfill（**次にやる**・7/8デモには必須ではない＝現行機能は引き続きwinesテーブル参照のまま動く）

### Phase 2: スカウターの配線替え（backend中心）
1. RPC `match_catalog(q, lim)`：name_ja/name_en/producer_ja/producer_en の trgm 照合（多言語で照合精度向上＝英字ラベルに強くなる）
2. backend `matchMaster()` → catalog 版に差し替え。レスポンスの wine オブジェクトは互換形（name=name_ja, producer=producer_ja, iro=color_ja, kuni=country_ja, chiiki=region1_ja, price=price_jpy…）＋ `catalogId` を追加
3. **「今日のコスパ」**: `evaluation_model_by_year.json` を backend に同梱。リスト/棚で実売価格を観測した known ワインに `osuToday = sp - (a*ln(price750換算) + b)`（観測年に最も近い係数）を返し、フロントで「掘り出し物」表示
4. **未知ワインの pending 自動追加**: unlisted 判定時に wine_catalog へ entry_source='scouter'・pending で自動insert（vision結果の name/producer/色/国。重複防止に trgm 事前チェック）。ユーザー入力ゼロで「育つカタログ」
5. 書き込み系（taste_items, venue_list_items 等）の新規行は catalog_id を保存

### Phase 3: 残り機能の参照切替
- top-wines / recommend / best-wines: 参照を wine_catalog に + **recommendable=true 限定**（原則3）
- top-places / store-analytics / wine-places / producer.html / wine_search / prototype ランキング直読み: 順次 catalog へ
- 多言語UI（i18n）と接続: 言語が en のとき name_en/producer_en を優先表示（i18n基盤と横文字データがここで合流）

### Phase 4: 退役（頭脳側承認済み・2026-07-05。追加条件つき）
- **旧winesにしか無いデータは捨てずに移行すること**（頭脳側の明示指示）。対象の洗い出し:
  - `barcodes`（GTIN↔ワイン対応）: wine_catalogにバーコード列が無い＝**catalog_observationsへ`kind='barcode'`で記録**し頭脳側の精査＋将来の列昇格に委ねる
  - `wines.volume_ml`・`source`等のwine_catalogに対応列が無い属性値: 差分があれば同様にcatalog_observationsへ
  - **名寄せで一致しなかった旧wines行**（誰かのセラー登録・レストランのリスト・試飲メモ等、実利用履歴が紐づく可能性）: 削除せず、`entry_source='user'|'restaurant'`・`curation_status='pending'`の新規wine_catalog行として救済し catalog_id を持たせる（「育つカタログ」の原則にも合致）。判断に迷うものはcatalog_observationsへ回してよい（頭脳側承認）
  - `label_image_url`: 現行方針は「写真は保存しない」のため当面NULLのまま。方針変更時のみ対応
- 全参照が catalog に切り替わり、上記の移行漏れチェックが完了したら wines テーブル読み取り停止 → 観察期間 → drop
- `2026-07-04_wines_full_reload.sql`・cospa 4分割CSV は廃棄（正本が wine_catalog になったため）

## 留意点
- 甘辛（sweetness_ja/en）: 泡はBrut仮定の低確信度。UI で使う時は「(推定)」表記か非表示（原則7）
- label_image_url: 現方針「写真は保存しない」と衝突するため当面 NULL のまま（保存するなら方針変更をオーナーと合意してから）
- pending 行の精査・昇格は頭脳側の仕事。アプリは curation_status を触らない

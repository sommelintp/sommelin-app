/* ═════════════════════════════════════════════════════════════
   Sommelin 評価・国旗の共有表示ヘルパー（2026-07-11 U節実装／2026-07-12 称号仕様確定）
   oshi-card.js/bottle-svg.jsと同じ方式。グローバル変数を参照せず、
   すべて引数から読む。
   「ソムリン星」は称号（食べログのゴールド/シルバー/ブロンズ相当）で
   あり、おすすめ度の数値スコアではない。整数1〜5のみ・半星なし。
   星なし(null)は基本状態（全体の約70%）で、称号なしなだけ＝低評価でも
   集計中でもない。空スロットも「収集中」文言も出さない（DBさん合意）。
   公開API: window.WineDisplay = { starsHtml, flagOf, ratingLabel, scoreBlock, rankOf }
   【重要】このファイルを変更したら、読み込み側5ページ（scouter/wine_search/
   producer/prototype/restaurant_admin）の <script src="assets/wine-display.js?v=日付">
   の ?v= も必ず上げること。素のsrcだとスマホのキャッシュに旧版が残り、
   新HTML×旧JSの組合せで壊れる（2026-07-18: scoreBlock未定義でスカウターの
   詳細カードが開けなくなる実害が発生した）。
   ═════════════════════════════════════════════════════════════ */
(function(){
  // AJ-10(2026-07-14): オーナー判断で星バッジ・星ラベルにブランド名を冠するのをやめた。
  // 星の横には何も出さない（称号は星の数だけで語る）。sourceごとの出し分けは将来復活可。
  const RATING_LABELS = {};
  function ratingLabel(source){
    return RATING_LABELS[source] || '';
  }

  // U-3: prototype.htmlのCOUNTRY_FLAGS（12ヶ国）をこちらに一本化。
  // 二重管理を避けるため、prototype.html側は本ファイルのFLAGSを参照する。
  const FLAGS = {
    'フランス':'🇫🇷', 'イタリア':'🇮🇹', 'スペイン':'🇪🇸', 'ドイツ':'🇩🇪',
    'アメリカ':'🇺🇸', '日本':'🇯🇵', 'チリ':'🇨🇱', 'オーストラリア':'🇦🇺',
    'ポルトガル':'🇵🇹', 'アルゼンチン':'🇦🇷', 'ニュージーランド':'🇳🇿', '南アフリカ':'🇿🇦',
  };
  function flagOf(kuni){
    return FLAGS[kuni] || '';
  }

  // rating=null（称号なし）は何も描画しない。「収集中」等の文言も出さない
  // （称号は付くか付かないかだけ。低評価でも集計中でもないため）
  function starsHtml(rating, opts){
    opts = opts || {};
    if (rating == null) return '';
    const size = opts.size || 14;
    const gap = Math.round(size * 0.12);
    const gold = 'var(--foil, #C9973A)';
    // 称号は整数1〜5のみ（半星なし）。空スロット（未獲得の星）も描画しない
    const numStars = Math.max(0, Math.min(5, Math.round(rating)));
    let stars = '';
    for (let i = 0; i < numStars; i++) {
      stars += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="flex-shrink:0;">
        <path d="M12 2.5l2.9 6.5 7.1.6-5.4 4.7 1.7 7-6.3-4-6.3 4 1.7-7L2 9.6l7.1-.6z" fill="${gold}"/>
      </svg>`;
    }
    const labelText = opts.showLabel ? ratingLabel(opts.source) : '';
    const label = labelText ? `<span style="font-size:${Math.round(size*0.72)}px;color:var(--text-sub,#999);margin-left:4px;">${labelText}</span>` : '';
    return `<span style="display:inline-flex;align-items:center;gap:${gap}px;">${stars}${label}</span>`;
  }

  /* ═══════════════════════════════════════════════════════════
     表示体系第4版（2026-07-16 オーナー承認・正本=表示体系第4版_設計_2026-07-16.md）
     「味は数字、おすすめは星」。
       - 味スコア: tasteScore100（50-100点・ワイン誌の100点方式）＝味の絶対評価
       - ソムスター: somStar（★1-5）＝この価格ならどれくらいおすすめか（コスパ込み）
       - somStar null = 星なしが正常（母集団外・SP足切り）。旧starsHtmlと同じく
         空スロットも「収集中」も出さない。
       - 100点到達はtasteScoreInternalでランク分け:
           ≥120 レジェンド / ≥110 ゴールド / ≥100 シルバー
     アプリ側で計算は一切しない（DB計算値の表示のみ）。

     【この3つの数字を「SPの値」と読み違えないこと】
     100/110/120は内部スコアの閾値であって、SPそのものではない。SP→内部スコアの
     換算はDB側(scoring_config)が持つ。2026-07-28のv1.5.0で100点の到達点が
     SP8.0→8.5に上がったが、換算式も一緒に動いた（内部スコア=100+20×(SP-8.5)）ため、
     ここは変更不要のまま シルバーSP8.5〜/ゴールドSP9.0〜/レジェンドSP9.5〜 になる。
     採点方法は今後も変わる[[sommelin-scoring-method-volatile]]。SPの数字を見て
     ここを「直す」と、かえって二重管理になり表示がDBとずれる。
     該当銘柄数もここには書かない（DBを更新するたび古くなるため）。
     ═══════════════════════════════════════════════════════════ */

  function rankOf(tasteScoreInternal){
    if (tasteScoreInternal == null) return null;
    const v = Number(tasteScoreInternal);
    if (v >= 120) return 'legend';
    if (v >= 110) return 'gold';
    if (v >= 100) return 'silver';
    return null;
  }

  // 100点ランクの意匠。基本チップは落ち着いたバーガンディ淡色、
  // 100点だけ箔（銀/金/黒金）で「特別」を静かに主張する。
  const RANK_STYLES = {
    silver: {
      bg: 'linear-gradient(135deg,#f5f6f8 0%,#dfe2e8 55%,#c9cdd6 100%)',
      border: '#b9bec9', color: '#3a3f4a', label: 'SILVER',
    },
    gold: {
      bg: 'linear-gradient(135deg,#fdf6dd 0%,#f3d98b 55%,#e0b455 100%)',
      border: '#C9973A', color: '#6b4a00', label: 'GOLD',
    },
    legend: {
      bg: 'linear-gradient(135deg,#40102a 0%,#2a0a1c 60%,#170510 100%)',
      border: '#C9973A', color: '#F3D98B', label: '✦ LEGEND',
    },
  };

  // 味スコアチップ＋ソムスターのワンセット描画。
  //   wine: { tasteScore100, tasteScoreInternal, somStar, somPct, somPctNote } を含む任意オブジェクト
  //   opts: { size=13, lang='ja', showPct=false }
  //     showPct: somPctがあれば「同価格帯で上位X%」の小さな補足行を付ける（詳細画面向け）
  // どちらも無ければ空文字（何も出さない＝no-lie）。
  function scoreBlock(wine, opts){
    opts = opts || {};
    if (!wine) return '';
    const size = opts.size || 13;
    const lang = opts.lang === 'en' ? 'en' : 'ja';
    const t100 = wine.tasteScore100 != null ? Math.round(Number(wine.tasteScore100)) : null;
    const star = wine.somStar != null ? Number(wine.somStar) : null;
    if (t100 == null && star == null) return '';

    let chip = '';
    if (t100 != null) {
      const rank = rankOf(wine.tasteScoreInternal);
      const rs = rank && RANK_STYLES[rank];
      const label = lang === 'en' ? 'Taste' : '味';
      const base = `display:inline-flex;align-items:baseline;gap:${Math.round(size*0.3)}px;`
        + `padding:${Math.round(size*0.18)}px ${Math.round(size*0.55)}px;`
        + `border-radius:${Math.round(size*0.55)}px;line-height:1.25;flex-shrink:0;`;
      const look = rs
        ? `background:${rs.bg};border:1px solid ${rs.border};color:${rs.color};`
        : `background:var(--burgundy-pale,#f9f0f3);border:1px solid rgba(155,27,75,.18);color:var(--burgundy,#9B1B4B);`;
      const rankTag = rs
        ? `<span style="font-size:${Math.round(size*0.62)}px;font-weight:800;letter-spacing:.08em;margin-left:${Math.round(size*0.25)}px;">${rs.label}</span>`
        : '';
      chip = `<span style="${base}${look}">`
        + `<span style="font-size:${Math.round(size*0.78)}px;font-weight:700;opacity:.85;">${label}</span>`
        + `<span style="font-size:${Math.round(size*1.15)}px;font-weight:900;">${t100}</span>`
        + rankTag
        + `</span>`;
    }
    const stars = star != null ? starsHtml(star, { size: Math.max(11, Math.round(size*0.95)) }) : '';

    let pctLine = '';
    if (opts.showPct) {
      let note = wine.somPctNote || null;
      if (!note && wine.somPct != null && star != null) {
        const topPct = 100 - Number(wine.somPct);
        note = (lang === 'en')
          ? (topPct < 1 ? 'Top <1% in its price range' : `Top ${Math.ceil(topPct)}% in its price range`)
          : (topPct < 1 ? '同価格帯で上位1%未満' : `同価格帯で上位${Math.ceil(topPct)}%`);
      }
      if (note) pctLine = `<div style="font-size:${Math.round(size*0.78)}px;color:var(--text-sub,#8a7a7d);margin-top:2px;">${note}</div>`;
    }

    const row = `<span style="display:inline-flex;align-items:center;gap:${Math.round(size*0.5)}px;flex-wrap:wrap;">${chip}${stars}</span>`;
    return pctLine ? `<span style="display:inline-block;">${row}${pctLine}</span>` : row;
  }

  window.WineDisplay = { starsHtml, flagOf, ratingLabel, scoreBlock, rankOf };
})();

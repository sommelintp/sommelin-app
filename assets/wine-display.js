/* ═════════════════════════════════════════════════════════════
   Sommelin 評価・国旗の共有表示ヘルパー（2026-07-11 U節実装／2026-07-12 称号仕様確定）
   oshi-card.js/bottle-svg.jsと同じ方式。グローバル変数を参照せず、
   すべて引数から読む。
   「ソムリン星」は称号（食べログのゴールド/シルバー/ブロンズ相当）で
   あり、おすすめ度の数値スコアではない。整数1〜5のみ・半星なし。
   星なし(null)は基本状態（全体の約70%）で、称号なしなだけ＝低評価でも
   集計中でもない。空スロットも「収集中」文言も出さない（DBさん合意）。
   公開API: window.WineDisplay = { starsHtml, flagOf, ratingLabel, scoreBlock, rankOf, wineHref }
   【重要】このファイルを変更したら、読み込み側6ページ（scouter/wine_search/
   producer/prototype/restaurant_admin/wine）の <script src="assets/wine-display.js?v=日付">
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
       - 100点到達の称号はサーバーが返すランク名 tasteRank（Silver/Gold/Legend）
         で演出を分ける（2026-07-30: 内部スコアの閾値判定をフロントから撤去）。
     アプリ側で計算は一切しない（DB計算値の表示のみ）。ランクの判定・SP換算は
     DB/サーバー側が持ち、閾値の数値をここに書かない。採点方法は今後も変わる
     [[sommelin-scoring-method-volatile]]ため、フロントはランク名を読むだけ。
     ═══════════════════════════════════════════════════════════ */

  function rankOf(tasteRank){
    if (tasteRank == null) return null;
    const key = String(tasteRank).toLowerCase();
    return RANK_STYLES[key] ? key : null;
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
  //   wine: { tasteScore100, tasteRank, somStar, somPct, somPctNote } を含む任意オブジェクト
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
      const rank = rankOf(wine.tasteRank);
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

  // ─────────────────────────────────────────────
  // 2026-08-18: ワイン名タップ → 同一銘柄の全ヴィンテージ一覧（wine.html）
  //   オーナー決定「各ワインをクリックしたらいろんなヴィンテージの評価が
  //   出てくるべきである」。1VT=1代表値で並ぶので、同じ年を何度試飲していても
  //   見せる数字は1つ。
  //   URLの組み立てはここに集約する（各ページで組むとパラメータ名がずれる）。
  //   【重要】APIは producer_ja / name_ja の完全一致で引く。英語UIでも
  //   表示名(nameEn/producerEn)ではなく日本語名を渡すこと。
  //   値が無ければ null を返す＝リンクにしない（「銘柄が指定されていません」の
  //   壊れたページに飛ばさない）。
  // ─────────────────────────────────────────────
  function wineHref(wine){
    if (!wine) return null;
    const producer = wine.producer || wine.producerJa || null;
    const name     = wine.name     || wine.nameJa     || null;
    if (!producer || !name) return null;
    return 'wine.html?producer=' + encodeURIComponent(producer)
         + '&name=' + encodeURIComponent(name);
  }

  window.WineDisplay = { starsHtml, flagOf, ratingLabel, scoreBlock, rankOf, wineHref };
})();

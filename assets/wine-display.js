/* ═════════════════════════════════════════════════════════════
   Sommelin 評価・国旗の共有表示ヘルパー（2026-07-11 U節実装／2026-07-12 称号仕様確定）
   oshi-card.js/bottle-svg.jsと同じ方式。グローバル変数を参照せず、
   すべて引数から読む。
   「ソムリン星」は称号（食べログのゴールド/シルバー/ブロンズ相当）で
   あり、おすすめ度の数値スコアではない。整数1〜5のみ・半星なし。
   星なし(null)は基本状態（全体の約70%）で、称号なしなだけ＝低評価でも
   集計中でもない。空スロットも「収集中」文言も出さない（DBさん合意）。
   公開API: window.WineDisplay = { starsHtml, flagOf, ratingLabel }
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

  window.WineDisplay = { starsHtml, flagOf, ratingLabel };
})();

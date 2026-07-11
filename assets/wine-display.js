/* ═════════════════════════════════════════════════════════════
   Sommelin 評価・国旗の共有表示ヘルパー（2026-07-11 U節実装）
   oshi-card.js/bottle-svg.jsと同じ方式。グローバル変数を参照せず、
   すべて引数から読む。
   公開API: window.WineDisplay = { starsHtml, flagOf, ratingLabel }
   ═════════════════════════════════════════════════════════════ */
(function(){
  const RATING_LABELS = { sommelin_v1: 'ソムリン評価' };
  function ratingLabel(source){
    return RATING_LABELS[source] || '評価';
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

  // rating=null（データ不足）は偽の星を出さず「評価データ収集中」を返す（no-lie原則）
  function starsHtml(rating, opts){
    opts = opts || {};
    const size = opts.size || 14;
    const gap = Math.round(size * 0.12);
    if (rating == null) {
      return `<span style="font-size:${Math.round(size*0.78)}px;color:var(--text-sub,#999);">評価データ収集中</span>`;
    }
    const gold = 'var(--foil, #C9973A)';
    const empty = '#e2dcd6';
    let stars = '';
    for (let i = 0; i < 5; i++) {
      const fill = Math.max(0, Math.min(1, rating - i)); // 0, 0.5, 1
      const id = 'wdStar' + Math.random().toString(36).slice(2, 8) + i;
      stars += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="flex-shrink:0;">
        <defs><clipPath id="${id}"><rect x="0" y="0" width="${24*fill}" height="24"/></clipPath></defs>
        <path d="M12 2.5l2.9 6.5 7.1.6-5.4 4.7 1.7 7-6.3-4-6.3 4 1.7-7L2 9.6l7.1-.6z" fill="${empty}"/>
        <path d="M12 2.5l2.9 6.5 7.1.6-5.4 4.7 1.7 7-6.3-4-6.3 4 1.7-7L2 9.6l7.1-.6z" fill="${gold}" clip-path="url(#${id})"/>
      </svg>`;
    }
    const label = opts.showLabel ? `<span style="font-size:${Math.round(size*0.72)}px;color:var(--text-sub,#999);margin-left:4px;">${ratingLabel(opts.source)}</span>` : '';
    return `<span style="display:inline-flex;align-items:center;gap:${gap}px;">${stars}${label}</span>`;
  }

  window.WineDisplay = { starsHtml, flagOf, ratingLabel };
})();

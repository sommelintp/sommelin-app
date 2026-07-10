/* ═════════════════════════════════════════════════════════════
   Sommelin パラメトリックSVGボトル（2026-07-11 S-1実装）
   写真がまだ無いワインにも「らしい」ボトル影を出すための代替表現。
   精度より雰囲気（iro/kuni/chiiki/grapeの手がかりのみで推定。
   type_ja非公開のため泡・酒精強化はシャンパーニュ/著名産地名の代理判定）。
   公開API: window.BottleSvg.render(wine, heightPx) → SVGマークアップ文字列
   ═════════════════════════════════════════════════════════════ */
(function(){
  const VB_W = 50, VB_H = 140; // viewBox基準（縦横比固定、高さ指定に追従）

  // ── 形の決定（上から順に最初にマッチしたもの） ──
  const FORTIFIED_CHIIKI = ['シェリー','ヘレス','ポルト','ポート','マデイラ','マデイラ島'];
  const BURGUNDY_HINT = ['ブルゴーニュ','ローヌ','コート・ド・ニュイ','コート・ド・ボーヌ','シャブリ'];
  const BURGUNDY_GRAPE = ['ピノ・ノワール','ピノノワール','シャルドネ'];
  const FLUTE_HINT = ['アルザス','モーゼル','ラインガウ','ファルツ'];
  const FLUTE_GRAPE = ['リースリング'];

  function includesAny(s, list){
    if (!s) return false;
    return list.some(v => s.indexOf(v) !== -1);
  }
  function grapeHasAny(grape, list){
    if (!Array.isArray(grape)) return false;
    return grape.some(g => list.indexOf(g) !== -1);
  }

  function shapeOf(wine){
    const chiiki = wine.chiiki || '';
    const kuni = wine.kuni || '';
    const grape = wine.grape || [];
    if (chiiki === 'シャンパーニュ') return 'champagne';
    if (FORTIFIED_CHIIKI.some(v => chiiki.indexOf(v) !== -1)) return 'dumpy';
    if (includesAny(chiiki, BURGUNDY_HINT) || grapeHasAny(grape, BURGUNDY_GRAPE)) return 'burgundy';
    if (kuni === 'ドイツ' || includesAny(chiiki, FLUTE_HINT) || grapeHasAny(grape, FLUTE_GRAPE)) return 'flute';
    return 'bordeaux';
  }

  // ── 色の決定（iro→ガラス色＋中身色） ──
  const COLOR_MAP = {
    '赤':     { glass: '#2d4a2e', wine: '#5a0f1e' },
    '白':     { glass: '#b7c9a0', wine: '#d9c46a' },
    'ロゼ':   { glass: '#e8e2d8', wine: '#e8a2a8' },
    'オレンジ': { glass: '#e8e2d8', wine: '#c97f2a' },
  };
  function colorOf(iro){
    return COLOR_MAP[iro] || { glass: '#2d4a2e', wine: '#5a0f1e' };
  }

  // ── 形状ごとの寸法パラメータ（40〜60pxでも判別できるよう肩の変化域を広めに取る） ──
  const SHAPE_PARAMS = {
    bordeaux:  { neckW: 11, neckH: 40, shoulderH: 12, shoulderStyle: 'high',  bodyW: 30, bodyTop: 52 },
    burgundy:  { neckW: 11, neckH: 24, shoulderH: 32, shoulderStyle: 'slope', bodyW: 36, bodyTop: 56 },
    flute:     { neckW: 9,  neckH: 66, shoulderH: 8,  shoulderStyle: 'high',  bodyW: 18, bodyTop: 74 },
    dumpy:     { neckW: 9,  neckH: 10, shoulderH: 26, shoulderStyle: 'round', bodyW: 34, bodyTop: 36 },
    champagne: { neckW: 12, neckH: 22, shoulderH: 24, shoulderStyle: 'round', bodyW: 38, bodyTop: 46 },
  };

  function buildPath(p){
    const cx = VB_W / 2;
    const neckL = cx - p.neckW / 2, neckR = cx + p.neckW / 2;
    const bodyL = cx - p.bodyW / 2, bodyR = cx + p.bodyW / 2;
    const capY = 4;
    const shoulderY = p.neckH + capY;
    const bodyY = p.bodyTop;
    const bottomY = VB_H - 4;
    const puntY = bottomY - 5;

    let shoulderLeft, shoulderRight;
    if (p.shoulderStyle === 'high') {
      // 首から垂直に落ちてから水平に張り出す、角の立った肩（ボルドー/フルート型）
      shoulderLeft = `L ${neckL} ${bodyY} L ${bodyL} ${bodyY}`;
      shoulderRight = `L ${bodyR} ${bodyY} L ${neckR} ${bodyY}`;
    } else if (p.shoulderStyle === 'slope') {
      // 直線的な斜め肩（ブルゴーニュ型のなで肩）
      shoulderLeft = `L ${bodyL} ${bodyY}`;
      shoulderRight = `L ${bodyR} ${bodyY} L ${neckR} ${shoulderY}`;
    } else {
      // 丸みのある肩（酒精強化・シャンパーニュ型）
      shoulderLeft = `Q ${neckL} ${bodyY}, ${bodyL} ${bodyY}`;
      shoulderRight = `L ${bodyR} ${bodyY} Q ${neckR} ${bodyY}, ${neckR} ${shoulderY}`;
    }

    return `M ${neckL} ${shoulderY} ${shoulderLeft}
      L ${bodyL} ${puntY} C ${bodyL} ${bottomY}, ${bodyR} ${bottomY}, ${bodyR} ${puntY}
      ${shoulderRight} Z`;
  }

  function render(wine, heightPx){
    wine = wine || {};
    heightPx = heightPx || 56;
    const shape = shapeOf(wine);
    const p = SHAPE_PARAMS[shape];
    const col = colorOf(wine.iro);
    const isTop = wine.cospaLevel === 'top';
    const foil = isTop ? '#C9973A' : '#5a1626';
    const cx = VB_W / 2;
    const neckL = cx - p.neckW / 2, neckR = cx + p.neckW / 2;
    const bodyPath = buildPath(p);
    const capY = 4;
    const vintage = (wine.vintage && wine.vintage !== 'NV') ? String(wine.vintage) : '';

    return `<svg viewBox="0 0 ${VB_W} ${VB_H}" width="${Math.round(heightPx * VB_W / VB_H)}" height="${heightPx}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ワインボトルのイメージ">
      <path d="${bodyPath}" fill="${col.glass}"/>
      <rect x="${neckL}" y="${capY}" width="${p.neckW}" height="${p.neckH * 0.42}" rx="1" fill="${foil}"/>
      ${shape === 'champagne' ? `<ellipse cx="${cx}" cy="${capY + 1}" rx="${p.neckW*0.62}" ry="2.4" fill="${foil}"/>` : ''}
      <rect x="${cx - p.bodyW*0.32}" y="${p.bodyTop + 10}" width="${p.bodyW*0.64}" height="${vintage ? 16 : 11}" rx="1.5" fill="#faf6ee" opacity="0.94"/>
      ${vintage ? `<text x="${cx}" y="${p.bodyTop + 22}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="6" font-weight="700" text-anchor="middle" fill="#5a4a30">${vintage}</text>` : ''}
    </svg>`;
  }

  window.BottleSvg = { render };
})();

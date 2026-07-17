/* ═════════════════════════════════════════════════════════════
   Sommelin パラメトリックSVGボトル（2026-07-11 S-1 / 2026-07-11 T-5改良）
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

  // ── 形状ごとの寸法パラメータ（実物の比率に寄せる。bodyBottomWで裾の張り出しを表現） ──
  const SHAPE_PARAMS = {
    // ボルドー型: いかり肩・長めの首・胴は円筒（裾張り無し）
    bordeaux:  { neckW: 10, neckH: 44, bodyW: 28, bodyBottomW: 28, bodyTop: 56, foilRatio: 0.36 },
    // ブルゴーニュ型: 首から胴まで一続きのなで肩カーブ・裾がやや広がる
    burgundy:  { neckW: 10, neckH: 20, bodyW: 34, bodyBottomW: 38, bodyTop: 62, foilRatio: 0.4 },
    // シャンパーニュ型: ブルゴーニュに近いが太い胴・首の下半分までフォイル
    champagne: { neckW: 13, neckH: 16, bodyW: 40, bodyBottomW: 43, bodyTop: 58, foilRatio: 0.82 },
    // アルザス/フルート型: 肩がほぼ無く首から胴まで一続きの緩いテーパー
    flute:     { neckW: 9,  neckH: 50, bodyW: 16, bodyBottomW: 17, bodyTop: 58, foilRatio: 0.3 },
    // ずんぐり型（酒精強化）: 首の付け根が丸く膨らみ、胴は裾に向けてわずかに絞る
    dumpy:     { neckW: 9,  neckH: 10, bodyW: 34, bodyBottomW: 31, bodyTop: 30, foilRatio: 0.5 },
  };

  function buildPath(shape, p){
    const cx = VB_W / 2;
    const neckL = cx - p.neckW / 2, neckR = cx + p.neckW / 2;
    const bodyL = cx - p.bodyW / 2, bodyR = cx + p.bodyW / 2;
    const botL = cx - p.bodyBottomW / 2, botR = cx + p.bodyBottomW / 2;
    const capY = 4;
    const shoulderY = p.neckH + capY;
    const bodyY = p.bodyTop;
    const span = bodyY - shoulderY;
    const bottomY = VB_H - 4;
    const puntY = bottomY - 5;

    let left, right;
    if (shape === 'bordeaux') {
      // 首から短く力強いカーブでいかり肩へ
      left  = `Q ${neckL} ${shoulderY + span * 0.62}, ${bodyL} ${bodyY}`;
      right = `L ${bodyR} ${bodyY} Q ${neckR} ${shoulderY + span * 0.62}, ${neckR} ${shoulderY}`;
    } else if (shape === 'burgundy' || shape === 'champagne') {
      // 首の付け根はすぼまり、胴側でなだらかに開く1本の凹カーブ（なで肩）
      left  = `C ${neckL} ${shoulderY + span * 0.18}, ${bodyL} ${bodyY - span * 0.78}, ${bodyL} ${bodyY}`;
      right = `L ${bodyR} ${bodyY} C ${bodyR} ${bodyY - span * 0.78}, ${neckR} ${shoulderY + span * 0.18}, ${neckR} ${shoulderY}`;
    } else if (shape === 'flute') {
      // 肩と呼べる区間がほぼ無い緩いテーパー
      left  = `L ${bodyL} ${bodyY}`;
      right = `L ${bodyR} ${bodyY} L ${neckR} ${shoulderY}`;
    } else {
      // dumpy: 首の付け根がふっくら丸く張り出す
      left  = `Q ${bodyL - 3} ${shoulderY + span * 0.45}, ${bodyL} ${bodyY}`;
      right = `L ${bodyR} ${bodyY} Q ${bodyR + 3} ${shoulderY + span * 0.45}, ${neckR} ${shoulderY}`;
    }

    return `M ${neckL} ${shoulderY} ${left}
      L ${botL} ${puntY} C ${botL} ${bottomY}, ${botR} ${bottomY}, ${botR} ${puntY}
      ${right} Z`;
  }

  function render(wine, heightPx){
    wine = wine || {};
    heightPx = heightPx || 56;
    const shape = shapeOf(wine);
    const p = SHAPE_PARAMS[shape];
    const col = colorOf(wine.iro);
    const isTop = (wine.somStar != null ? Number(wine.somStar) === 5 : wine.cospaLevel === 'top'); // 第4版: ★5=金箔
    const foil = isTop ? '#C9973A' : '#5a1626';
    const cx = VB_W / 2;
    const neckL = cx - p.neckW / 2, neckR = cx + p.neckW / 2;
    const bodyPath = buildPath(shape, p);
    const capY = 4;
    const vintage = (wine.vintage && wine.vintage !== 'NV') ? String(wine.vintage) : '';
    const labelW = Math.max(p.bodyW, p.bodyBottomW) * 0.62;
    const labelY = p.bodyTop + (VB_H - 4 - p.bodyTop) * 0.22;

    return `<svg viewBox="0 0 ${VB_W} ${VB_H}" width="${Math.round(heightPx * VB_W / VB_H)}" height="${heightPx}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ワインボトルのイメージ">
      <path d="${bodyPath}" fill="${col.glass}"/>
      <rect x="${cx - p.bodyW*0.5 + 1.6}" y="${p.bodyTop + 3}" width="${p.bodyW*0.14}" height="${(VB_H-4-p.bodyTop)*0.62}" rx="1.2" fill="#fff" opacity="0.14"/>
      <rect x="${neckL}" y="${capY}" width="${p.neckW}" height="${p.neckH * p.foilRatio}" rx="1" fill="${foil}"/>
      ${shape === 'champagne' ? `<ellipse cx="${cx}" cy="${capY + 2}" rx="${p.neckW*0.68}" ry="3" fill="${foil}"/>` : ''}
      <rect x="${cx - labelW/2}" y="${labelY}" width="${labelW}" height="${vintage ? 16 : 11}" rx="1.5" fill="#faf6ee" opacity="0.94"/>
      ${vintage ? `<text x="${cx}" y="${labelY + 12}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="6" font-weight="700" text-anchor="middle" fill="#5a4a30">${vintage}</text>` : ''}
    </svg>`;
  }

  window.BottleSvg = { render };
})();

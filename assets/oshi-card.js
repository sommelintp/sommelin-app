/* ═════════════════════════════════════════════════════════════
   Sommelin 推しカード描画エンジン（2026-07-10 D-2切り出し）
   scouter.html（fan）と restaurant_admin.html（store/reviewer）が共用する。
   グローバル変数を一切参照せず、すべて draw(opts) の引数から読む。
   公開API: window.OshiCard.draw(opts) → Promise<Blob>（1080×1920 PNG）
   ═════════════════════════════════════════════════════════════ */
(function(){
  const W=1080, H=1920;
  const FONT='-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif';

  function loadImg(src){
    return new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=src; });
  }
  function trunc(s,n){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }
  // 語境界（スペース）で折り返す。単語単体がmaxWを超える場合だけ文字単位に落ちる
  // （2026-07-24: 横文字ワイン名が単語の途中で切れて読みにくかった不具合の修正）。
  // 日本語・カタカナはスペースを含まないため全体が1語扱いになり、従来通り文字単位で折れる
  // （CJKは文字間で改行するのが正しい組版であり、単語境界を強制する必要がない）。
  function wrap(ctx,text,maxW,maxLines){
    maxLines=maxLines||3;
    const fits=s=>ctx.measureText(s).width<=maxW;
    const words=String(text).split(/\s+/).filter(Boolean);
    const out=[]; let line='';
    for(const word of words){
      const trial=line?line+' '+word:word;
      if(fits(trial)){ line=trial; continue; }
      if(line){ out.push(line); line=''; }
      if(fits(word)){ line=word; continue; }
      let sub='';
      for(const ch of word){
        if(sub && !fits(sub+ch)){ out.push(sub); sub=ch; } else sub+=ch;
      }
      line=sub;
    }
    if(line) out.push(line);
    return out.slice(0,maxLines);
  }

  // ロゴ内部（顔・口ヒゲ・蝶ネクタイ）は透過＝背景が透ける。台紙や写真の上ではここを白で塗る
  // （2026-07-24 オーナー指示「ソムリンの中は透過しないで白にして」）。バーガンディの円環より
  // わずかに小さい白ディスクを先に敷き、その上にロゴを重ねる＝環が白ディスクの縁を隠す。
  // 円の中心・半径は実PNG(456×444)の不透明バウンディングボックス実測から: cx=0.4912w cy=0.5h r=0.4539w。
  function drawLogo(ctx,logo,x,y,lw){
    const lh=lw*(logo.naturalHeight/logo.naturalWidth);
    const cx=x+lw*0.4912, cy=y+lh*0.5, r=lw*0.4539*0.95;
    ctx.save(); ctx.fillStyle='#FFFFFF';
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill(); ctx.restore();
    ctx.drawImage(logo,x,y,lw,lh);
    return lh;
  }

  // ── v2共通（2026-07-24 額装エディトリアル装丁。2026-07-30 store/reviewerへ展開） ──
  // 設計原則（オーナーFB 2026-07-24）:
  //  ①写真は「撮ったまま全体」を見せる。cover/クロップ/ズームは一切しない（構図は撮った本人のもの）
  //  ②生産者に届くカード＝横文字ワイン名が主役。セリフ体で品格を出す（iOS=Didot/Bodoni 72、他=Georgia/明朝）
  //  ③写真の上に文字を重ねない（旧scrim廃止）。アイボリー台紙＋白マット額装＝縦横どんな構図でも絵になる
  const SERIF='"Didot","Bodoni 72","Playfair Display",Georgia,"Hiragino Mincho ProN","Yu Mincho",serif';
  // 色は sommelin-ui.css のトークンと手動同期（CSS変数はCanvasに届かない。UI色を変えたらここも追従）:
  // IVORY=--paper-warm / INK=--wine-ink / BURG=--wine / DEEP=--wine-deep
  // GOLD=--foil / GOLDL=--foil-pale / FAINT=--text-sub（SUBのみトークン外＝台紙上の準本文色）
  const IVORY='#F4ECE0', INK='#2A161B', BURG='#7A1F3D', DEEP='#4A1220',
        GOLD='#B8923D', GOLDL='#E8C97A', SUB='#6B5147', FAINT='#8A7A6E';

  // 台紙＋天地の飾り罫（ワインキャップのフォイル風）
  function drawMat(ctx){
    ctx.fillStyle=IVORY; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=BURG; ctx.fillRect(0,0,W,10);   ctx.fillStyle=GOLD; ctx.fillRect(0,10,W,3);
    ctx.fillStyle=BURG; ctx.fillRect(0,H-10,W,10); ctx.fillStyle=GOLD; ctx.fillRect(0,H-13,W,3);
  }
  // レターヘッド（ロゴ＋ワードマーク）。以降は中央揃えになり、本文を書き始められる y を返す
  function drawLetterhead(ctx,logo,color){
    let y=72;
    if(logo){ const lw=84; const lh=drawLogo(ctx,logo,(W-lw)/2,y,lw); y+=lh+14; }
    ctx.textAlign='center';
    ctx.font=`800 25px ${FONT}`; ctx.fillStyle=color; ctx.letterSpacing='9px';
    ctx.fillText('SOMMELIN',W/2,y+22); ctx.letterSpacing='0px';
    return y+52;
  }
  // 金の罫＋中央ダイヤの飾り（items用）
  function ruleDiamondItem(ctx){
    return {h:52, draw:t=>{ const cy=t+26;
      ctx.strokeStyle=GOLD; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(W/2-110,cy); ctx.lineTo(W/2-22,cy); ctx.moveTo(W/2+22,cy); ctx.lineTo(W/2+110,cy); ctx.stroke();
      ctx.save(); ctx.translate(W/2,cy); ctx.rotate(Math.PI/4); ctx.fillStyle=GOLD; ctx.fillRect(-6,-6,12,12); ctx.restore(); }};
  }
  // セリフ体の銘柄名＋生産者・年の副行（fanNamePlanの結果をitemsへ積む）
  function pushNamePlanItems(ctx,items,plan,inkColor,subColor){
    const lh=Math.round(plan.nameSize*1.22);
    items.push({h:lh*plan.nameLines.length+12, draw:t=>{ ctx.font=`700 ${plan.nameSize}px ${SERIF}`; ctx.fillStyle=inkColor;
      plan.nameLines.forEach((ln,i)=>ctx.fillText(ln,W/2,t+lh*(i+1)-Math.round(plan.nameSize*0.18))); }});
    if(plan.subLine) items.push({h:54, draw:t=>{ ctx.font=`600 36px ${FONT}`; ctx.fillStyle=subColor; ctx.fillText(plan.subLine,W/2,t+40); }});
  }
  // MY RATING（100点満点・1点刻み。内部ratingは0〜10のまま×10で整数化）
  function scoreItem(ctx,rating,labelColor,numColor,unitColor){
    const score100=Math.round(Number(rating)*10);
    return {h:160, draw:t=>{
      ctx.font=`800 26px ${FONT}`; ctx.fillStyle=labelColor; ctx.letterSpacing='6px'; ctx.fillText('MY RATING',W/2,t+30); ctx.letterSpacing='0px';
      ctx.font=`700 104px ${SERIF}`; const nw=ctx.measureText(String(score100)).width;
      ctx.font=`600 32px ${FONT}`;  const sw=ctx.measureText(' /100').width;
      const x0=W/2-(nw+sw)/2;
      ctx.textAlign='left';
      ctx.font=`700 104px ${SERIF}`; ctx.fillStyle=numColor; ctx.fillText(String(score100),x0,t+140);
      ctx.font=`600 32px ${FONT}`; ctx.fillStyle=unitColor; ctx.fillText(' /100',x0+nw,t+140);
      ctx.textAlign='center'; }};
  }
  // 本人コメント（「」括り・語境界折り返し）
  function commentItem(ctx,comment,color){
    ctx.font=`600 40px ${FONT}`;
    const clines=wrap(ctx,`「${comment}」`,880,4);
    return {h:clines.length*58+18, draw:t=>{ ctx.font=`600 40px ${FONT}`; ctx.fillStyle=color;
      clines.forEach((ln,i)=>ctx.fillText(ln,W/2,t+58*(i+1)-14)); }};
  }
  // ★列（部分星はclipで塗り分け。数字は出さない）
  function drawStarRow(ctx,n5,ssize,sy){
    const sgap=ssize*1.3, sx0=W/2-sgap*2;
    ctx.font=`${ssize}px ${FONT}`; ctx.fillStyle=GOLD;
    for(let i=0;i<5;i++){
      const sx=sx0+sgap*i, fill=Math.max(0,Math.min(1,n5-i));
      ctx.fillText('☆',sx,sy);
      if(fill>=0.75){ ctx.fillText('★',sx,sy); }
      else if(fill>=0.25){
        const sw=ctx.measureText('★').width;
        ctx.save(); ctx.beginPath(); ctx.rect(sx-sw/2,sy-ssize,sw/2,ssize*1.4); ctx.clip();
        ctx.fillText('★',sx,sy); ctx.restore();
      }
    }
  }
  // 白地＋金罫のピル（額装様式の共通あしらい）
  function pillItem(ctx,txt,fontPx,ph,spacing){
    return {h:ph+20, draw:t=>{
      ctx.font=`700 ${fontPx}px ${FONT}`; if(spacing) ctx.letterSpacing=spacing;
      const tw=ctx.measureText(txt).width, pw=tw+96, px=(W-pw)/2;
      ctx.fillStyle='#FFFFFF'; ctx.strokeStyle=GOLD; ctx.lineWidth=3;
      ctx.beginPath(); ctx.roundRect(px,t+8,pw,ph,ph/2); ctx.fill(); ctx.stroke();
      ctx.fillStyle=BURG; ctx.fillText(txt,W/2,t+8+ph/2+Math.round(fontPx*0.36)); ctx.letterSpacing='0px'; }};
  }
  // items を縦に積んで描く
  function drawItems(ctx,items,top){ let t=top; for(const it of items){ it.draw(t); t+=it.h; } }
  // フッター（#Sommelin＋アプリURL）
  function drawFooterLine(ctx,opts,color){
    ctx.font=`600 24px ${FONT}`; ctx.fillStyle=color;
    ctx.fillText('#Sommelin　'+String(opts.appUrl||'').replace('https://','').replace(/\/$/,''),W/2,H-52);
  }

  // 額装型・写真全面型で共有する文字組みの下ごしらえ（重複除去・自動縮小・語境界改行＝単一ソース）
  function fanNamePlan(ctx,opts){
    // 表示名の整理: 銘柄名が生産者名で始まる場合は重複を落とす（生産者は専用行に出る＝ラベルの流儀）
    let name=String(opts.name||'').trim();
    const producer=String(opts.producer||'').trim();
    if(producer && name.toLowerCase().startsWith(producer.toLowerCase())){
      const rest=name.slice(producer.length).replace(/^[\s,，·・:：-]+/,'');
      if(rest.length>=4) name=rest;
    }
    const vintage=(opts.vintage&&opts.vintage!=='NV')?String(opts.vintage):'';
    // 銘柄名: 長さに応じて段階縮小（3行に収まる最大サイズを選ぶ。wrapは語境界折り返し）
    let nameSize=76, nameLines=[name];
    for(const s of [76,66,58,50,44]){
      ctx.font=`700 ${s}px ${SERIF}`;
      const ls=wrap(ctx,name,900,4);
      nameSize=s; nameLines=ls.slice(0,3);
      if(ls.length<=3) break;
    }
    return { producer, vintage, nameSize, nameLines,
      subLine: [producer?trunc(producer,30):null, vintage||null].filter(Boolean).join('   ·   ') };
  }

  // ── fan: 額装型（v2既定。写真なしでも同じ装丁で成立＝旧classic廃止 2026-07-30 の受け皿） ──
  async function drawFanPhoto(ctx,opts,logo){
    const plan=fanNamePlan(ctx,opts);
    drawMat(ctx);
    const y=drawLetterhead(ctx,logo,GOLD);

    // 「このワイン、美味しかった！」の煽り文はオーナー指示で廃止（2026-07-24）＝銘柄名から始める
    const items=[];
    pushNamePlanItems(ctx,items,plan,INK,SUB);
    if(opts.storeName) items.push({h:44, draw:t=>{ ctx.font=`600 30px ${FONT}`; ctx.fillStyle=FAINT; ctx.fillText('at '+trunc(opts.storeName,26),W/2,t+32); }});
    items.push(ruleDiamondItem(ctx));
    if(opts.showScore) items.push(scoreItem(ctx,opts.rating,GOLD,INK,SUB));
    if(opts.producerHandle){
      items.push(pillItem(ctx,`@${opts.producerHandle}`,36,84,'2px'));
      items.push({h:42, draw:t=>{ ctx.font=`italic 600 26px Georgia,serif`; ctx.fillStyle=FAINT; ctx.fillText('Cheers from Japan 🍷',W/2,t+30); }});
    }else{
      items.push({h:58, draw:t=>{ ctx.font=`700 34px ${FONT}`; ctx.fillStyle=INK; ctx.fillText('ごちそうさまでした 🙏',W/2,t+40); }});
    }
    const blockH=items.reduce((a,b)=>a+b.h,0);

    // ── 写真: 残り空間へ「全体」を表示（contain）。白マット＋金罫の額装 ──
    const footerTop=H-104;
    const photo=opts.photoDataUrl?await loadImg(opts.photoDataUrl):null;
    let textTop;
    if(photo){
      const availH=Math.max(300, footerTop-y-blockH-72);
      const maxW2=W-150, maxH2=Math.min(availH, Math.round(H*0.50));
      const s=Math.min(maxW2/photo.naturalWidth, maxH2/photo.naturalHeight);
      const dw=Math.round(photo.naturalWidth*s), dh=Math.round(photo.naturalHeight*s);
      // 余白は上30%・写真と文字の間42%・文字の下28%に分散（横長写真で中間が間延びしない）
      const extra=Math.max(0, footerTop-y-(dh+32)-blockH);
      const px=(W-dw)/2, py=y+16+Math.round(extra*0.30);
      ctx.fillStyle='#FFFFFF'; ctx.fillRect(px-16,py-16,dw+32,dh+32);
      ctx.strokeStyle=GOLD; ctx.lineWidth=2.5; ctx.strokeRect(px-16,py-16,dw+32,dh+32);
      ctx.drawImage(photo,px,py,dw,dh);
      const photoBottom=py+dh+16;
      textTop=photoBottom+Math.max(28,Math.round(extra*0.42));
    }else{
      textTop=y+Math.max(40,(footerTop-y-blockH)/2);
    }
    drawItems(ctx,items,textTop);
    drawFooterLine(ctx,opts,FAINT);
  }

  // ── fan: 写真全面（オーバーレイ）型（2026-07-24 パターン第2案・オーナー要望「写真を全体に
  //    配置して文字をオーバーラップさせるのもあり。パターンは選ばせられたらいい」）──
  // 写真をカード全面に敷く（cover）。全面化に伴う端の切れはユーザーが選んだ時だけ許される
  // （既定は額装型＝ノートリミング）。文字組みの体系（fanNamePlan・自動縮小・語境界改行・
  // 罫とダイヤ・スコア・ピル）は額装型と同一＝2パターンで印象だけが変わる。
  async function drawFanOverlay(ctx,opts,logo){
    const WHT='#FFFFFF';
    const plan=fanNamePlan(ctx,opts);

    const photo=await loadImg(opts.photoDataUrl);
    if(photo){
      const s=Math.max(W/photo.naturalWidth,H/photo.naturalHeight);
      const dw=photo.naturalWidth*s, dh=photo.naturalHeight*s;
      ctx.drawImage(photo,(W-dw)/2,(H-dh)/2,dw,dh);
    }else{ ctx.fillStyle='#2a0713'; ctx.fillRect(0,0,W,H); }

    // 上: レターヘッドを支える浅いグラデ
    const gt=ctx.createLinearGradient(0,0,0,320);
    gt.addColorStop(0,'rgba(12,3,7,.74)'); gt.addColorStop(1,'rgba(12,3,7,0)');
    ctx.fillStyle=gt; ctx.fillRect(0,0,W,320);
    drawLetterhead(ctx,logo,GOLDL);

    // ── 下部の文字ブロック（額装型と同じ構成・配色だけ夜仕様） ──
    // 「このワイン、美味しかった！」の煽り文はオーナー指示で廃止（2026-07-24）＝銘柄名から始める
    const items=[];
    pushNamePlanItems(ctx,items,plan,WHT,'rgba(255,255,255,.88)');
    if(opts.storeName) items.push({h:44, draw:t=>{ ctx.font=`600 30px ${FONT}`; ctx.fillStyle='rgba(255,255,255,.66)'; ctx.fillText('at '+trunc(opts.storeName,26),W/2,t+32); }});
    items.push(ruleDiamondItem(ctx));
    if(opts.showScore) items.push(scoreItem(ctx,opts.rating,GOLDL,WHT,'rgba(255,255,255,.66)'));
    if(opts.producerHandle){
      const txt=`@${opts.producerHandle}`;
      items.push({h:104, draw:t=>{
        ctx.font=`700 36px ${FONT}`; ctx.letterSpacing='2px';
        const tw=ctx.measureText(txt).width, pw=tw+96, ph=84, px=(W-pw)/2;
        ctx.fillStyle=GOLD;
        ctx.beginPath(); ctx.roundRect(px,t+8,pw,ph,42); ctx.fill();
        ctx.fillStyle=DEEP; ctx.fillText(txt,W/2,t+63); ctx.letterSpacing='0px'; }});
      items.push({h:42, draw:t=>{ ctx.font=`italic 600 26px Georgia,serif`; ctx.fillStyle='rgba(255,255,255,.78)'; ctx.fillText('Cheers from Japan 🍷',W/2,t+30); }});
    }else{
      items.push({h:58, draw:t=>{ ctx.font=`700 34px ${FONT}`; ctx.fillStyle='rgba(255,255,255,.92)'; ctx.fillText('ごちそうさまでした 🙏',W/2,t+40); }});
    }
    const blockH=items.reduce((a,b)=>a+b.h,0);
    const footerTop=H-104;
    const textTop=footerTop-blockH-24;

    // 文字ブロックの背丈に合わせた深いスクリム（読みやすさは写真次第にしない）
    const scrimTop=Math.max(H*0.42, textTop-170);
    const sc=ctx.createLinearGradient(0,scrimTop,0,H);
    sc.addColorStop(0,'rgba(14,3,8,0)'); sc.addColorStop(0.38,'rgba(14,3,8,.66)'); sc.addColorStop(1,'rgba(14,3,8,.96)');
    ctx.fillStyle=sc; ctx.fillRect(0,scrimTop,W,H-scrimTop);

    drawItems(ctx,items,textTop);
    drawFooterLine(ctx,opts,'rgba(255,255,255,.62)');
  }

  // ── store: 店の推しカード（当店のおすすめ。SP/total等の評価数値は載せない。2026-07-30 v2額装様式へ統一） ──
  function drawStore(ctx,opts,logo){
    const plan=fanNamePlan(ctx,opts);
    drawMat(ctx);
    const y=drawLetterhead(ctx,logo,GOLD);

    const items=[];
    items.push({h:64, draw:t=>{ ctx.font=`800 30px ${FONT}`; ctx.fillStyle=BURG; ctx.letterSpacing='8px';
      ctx.fillText('当店のおすすめ',W/2,t+34); ctx.letterSpacing='0px'; }});
    pushNamePlanItems(ctx,items,plan,INK,SUB);
    items.push(ruleDiamondItem(ctx));
    if(opts.comment) items.push(commentItem(ctx,opts.comment,INK));
    if(opts.priceMode && opts.priceMode!=='none'){
      const pills=[];
      if((opts.priceMode==='glass'||opts.priceMode==='both') && opts.priceGlass) pills.push(`グラス ¥${Number(opts.priceGlass).toLocaleString('ja-JP')}`);
      if((opts.priceMode==='bottle'||opts.priceMode==='both') && opts.priceBottle) pills.push(`ボトル ¥${Number(opts.priceBottle).toLocaleString('ja-JP')}`);
      if(pills.length){
        items.push({h:100, draw:t=>{
          ctx.font=`700 34px ${FONT}`;
          const gap=24, ph=76;
          const widths=pills.map(p=>ctx.measureText(p).width+64);
          const totalW=widths.reduce((a,b)=>a+b,0)+gap*(pills.length-1);
          let px=(W-totalW)/2;
          for(let i=0;i<pills.length;i++){
            const pw=widths[i];
            ctx.fillStyle='#FFFFFF'; ctx.strokeStyle=GOLD; ctx.lineWidth=2.5;
            ctx.beginPath(); ctx.roundRect(px,t+12,pw,ph,38); ctx.fill(); ctx.stroke();
            ctx.fillStyle=BURG; ctx.fillText(pills[i],px+pw/2,t+62);
            px+=pw+gap;
          }
        }});
      }
    }
    items.push({h:84, draw:t=>{ ctx.font=`700 46px ${FONT}`; ctx.fillStyle=INK; ctx.fillText(trunc(opts.storeName||'',22),W/2,t+60); }});
    if(opts.storeHandle) items.push(pillItem(ctx,`@${opts.storeHandle}`,34,76,'2px'));
    const blockH=items.reduce((a,b)=>a+b.h,0);
    const footerTop=H-104;
    drawItems(ctx,items,y+Math.max(40,(footerTop-y-blockH)/2));
    drawFooterLine(ctx,opts,FAINT);
  }

  // ── reviewer: レビュアー発信カード（私の推しワイン。本人の言葉と★のみ。SP/total/参考価格は載せない。2026-07-30 v2額装様式へ統一） ──
  function drawReviewer(ctx,opts,logo){
    const plan=fanNamePlan(ctx,opts);
    drawMat(ctx);
    const y=drawLetterhead(ctx,logo,GOLD);

    const items=[];
    items.push({h:64, draw:t=>{ ctx.font=`800 30px ${FONT}`; ctx.fillStyle=BURG; ctx.letterSpacing='8px';
      ctx.fillText('私の推しワイン',W/2,t+34); ctx.letterSpacing='0px'; }});
    pushNamePlanItems(ctx,items,plan,INK,SUB);
    items.push(ruleDiamondItem(ctx));
    if(opts.comment) items.push(commentItem(ctx,opts.comment,INK));
    // 本人の★評価（1〜5・数字は出さない。ソムリンおすすめ度と混同させないため）
    if(opts.showRating && opts.rating){
      const n=Math.max(0,Math.min(5,Number(opts.rating)));
      items.push({h:96, draw:t=>drawStarRow(ctx,n,48,t+62)});
    }
    items.push({h:84, draw:t=>{ ctx.font=`700 46px ${FONT}`; ctx.fillStyle=INK; ctx.fillText(trunc(opts.reviewerName||'',22),W/2,t+60); }});
    if(opts.tierLabel) items.push(pillItem(ctx,`${opts.tierIcon||''} ${opts.tierLabel}`.trim(),32,68,''));
    if(opts.reviewerIg) items.push({h:48, draw:t=>{ ctx.font=`600 28px ${FONT}`; ctx.fillStyle=FAINT; ctx.fillText('@'+opts.reviewerIg,W/2,t+34); }});
    const blockH=items.reduce((a,b)=>a+b.h,0);
    const footerTop=H-104;
    drawItems(ctx,items,y+Math.max(40,(footerTop-y-blockH)/2));
    drawFooterLine(ctx,opts,FAINT);
  }

  async function draw(opts){
    opts=opts||{};
    const assetBase=opts.assetBase||'assets/sommelin/';
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');
    const logo=await loadImg(assetBase+'sommelin-logo.png');

    if(opts.template==='store'){
      drawStore(ctx,opts,logo);
    }else if(opts.template==='reviewer'){
      drawReviewer(ctx,opts,logo);
    }else if(opts.photoStyle==='overlay' && opts.photoDataUrl){
      // photoStyle: 'framed'(既定・額装=ノートリミング) | 'overlay'(写真全面=ユーザー選択時のみ)
      await drawFanOverlay(ctx,opts,logo);
    }else{
      // 写真なしでも額装型がそのまま成立するため旧classic（バーガンディ全面）は廃止（2026-07-30）
      await drawFanPhoto(ctx,opts,logo);
    }

    return new Promise(res=>cv.toBlob(res,'image/png'));
  }

  window.OshiCard = { draw };
})();

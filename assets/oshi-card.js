/* ═════════════════════════════════════════════════════════════
   Sommelin 推しカード描画エンジン（2026-07-10 D-2切り出し）
   scouter.html（fan）と restaurant_admin.html（store）が共用する。
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
  function wrap(ctx,text,maxW,maxLines){
    maxLines=maxLines||3;
    const out=[]; let line='';
    for(const ch of String(text)){
      if(ctx.measureText(line+ch).width>maxW && line){ out.push(line); line=ch; } else line+=ch;
    }
    if(line) out.push(line);
    return out.slice(0,maxLines);
  }

  // ── fan: 写真ありカード（実写全面＋下部スクリムに文言集約） ──
  async function drawFanPhoto(ctx,opts,logo){
    const photo=await loadImg(opts.photoDataUrl);
    if(photo){
      const scale=Math.max(W/photo.naturalWidth,H/photo.naturalHeight);
      const dw=photo.naturalWidth*scale, dh=photo.naturalHeight*scale;
      ctx.drawImage(photo,(W-dw)/2,(H-dh)/2,dw,dh);
    }else{
      ctx.fillStyle='#3d0a1d'; ctx.fillRect(0,0,W,H);
    }

    const scrimY=H*0.56;
    const scrim=ctx.createLinearGradient(0,scrimY,0,H);
    scrim.addColorStop(0,'rgba(20,4,10,0)'); scrim.addColorStop(0.4,'rgba(20,4,10,.78)'); scrim.addColorStop(1,'rgba(20,4,10,.95)');
    ctx.fillStyle=scrim; ctx.fillRect(0,scrimY,W,H-scrimY);

    if(logo){ const lw=110,lh=lw*(logo.naturalHeight/logo.naturalWidth); ctx.drawImage(logo,50,50,lw,lh); }

    if(opts.showScore){
      const br=68, bx=W-56-br*2, by=56;
      ctx.fillStyle='rgba(20,4,10,.55)';
      ctx.beginPath(); ctx.arc(bx+br,by+br,br,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(232,201,122,.6)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(bx+br,by+br,br,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.textAlign='center';
      ctx.font=`800 50px ${FONT}`; ctx.fillText(Number(opts.rating).toFixed(1),bx+br,by+br+18);
    }

    ctx.textAlign='center';
    let y=H*0.68;
    ctx.font=`800 30px ${FONT}`; ctx.fillStyle='#E8C97A'; ctx.letterSpacing='4px';
    ctx.fillText('このワイン、美味しかった！',W/2,y); ctx.letterSpacing='0px';
    y+=78;
    ctx.font=`800 64px ${FONT}`; ctx.fillStyle='#fff';
    const lines=wrap(ctx,opts.name,940,3);
    for(const ln of lines){ ctx.fillText(ln,W/2,y); y+=78; }
    if(opts.producer){
      ctx.font=`700 38px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.fillText(trunc(opts.producer,26),W/2,y+8); y+=66;
    }
    if(opts.storeName){
      ctx.font=`600 30px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.65)';
      ctx.fillText('at '+trunc(opts.storeName,24),W/2,y+4); y+=44;
    }
    y+=16;
    if(opts.producerHandle){
      const txt=`📸 @${opts.producerHandle}`;
      ctx.font=`800 40px ${FONT}`;
      const tw=ctx.measureText(txt).width, pw=tw+70, ph=78, px=(W-pw)/2;
      ctx.fillStyle='#C9973A';
      ctx.beginPath(); ctx.roundRect(px,y,pw,ph,39); ctx.fill();
      ctx.fillStyle='#3d0a1d'; ctx.fillText(txt,W/2,y+53);
      y+=ph;
    }else{
      ctx.font=`700 36px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.fillText('ごちそうさまでした 🙏',W/2,y+16);
      y+=50;
    }

    ctx.textAlign='center';
    ctx.font=`600 28px ${FONT}`; ctx.fillStyle='rgba(255,255,255,.65)';
    ctx.fillText('#Sommelin　'+String(opts.appUrl||'').replace('https://',''),W/2,H-56);
  }

  // ── fan: 写真なしカード（従来のバーガンディ基調。MY RATINGはONの時だけ縮小表示） ──
  function drawFanClassic(ctx,opts,logo,chara){
    const g=ctx.createLinearGradient(0,0,W*0.6,H);
    g.addColorStop(0,'#3d0a1d'); g.addColorStop(0.5,'#5C0E2A'); g.addColorStop(1,'#9B1B4B');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,0.045)';
    ctx.beginPath(); ctx.arc(W*0.92,H*0.10,300,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(W*0.05,H*0.85,260,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(201,151,58,0.10)';
    ctx.beginPath(); ctx.arc(W*0.85,H*0.78,200,0,Math.PI*2); ctx.fill();

    if(logo){ const lw=170,lh=lw*(logo.naturalHeight/logo.naturalWidth); ctx.drawImage(logo,(W-lw)/2,90,lw,lh); }
    ctx.fillStyle='#E8C97A'; ctx.textAlign='center';
    ctx.font=`800 34px ${FONT}`; ctx.letterSpacing='10px';
    ctx.fillText('SOMMELIN',W/2,320); ctx.letterSpacing='0px';

    ctx.font=`800 58px ${FONT}`; ctx.fillStyle='#E8C97A';
    ctx.fillText('このワイン、美味しかった！',W/2,470);

    ctx.font=`800 82px ${FONT}`; ctx.fillStyle='#fff';
    const lines=wrap(ctx,opts.name,920,3);
    let y=610;
    for(const ln of lines){ ctx.fillText(ln,W/2,y); y+=100; }
    ctx.font=`700 46px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.85)';
    const sub=[opts.producer,(opts.vintage&&opts.vintage!=='NV')?opts.vintage:''].filter(Boolean).join('　');
    if(sub){ ctx.fillText(trunc(sub,26),W/2,y+16); y+=76; }
    if(opts.storeName){
      ctx.font=`600 32px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.fillText('at '+trunc(opts.storeName,24),W/2,y+8); y+=48;
    }

    ctx.strokeStyle='#C9973A'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(W/2-110,y+30); ctx.lineTo(W/2+110,y+30); ctx.stroke();
    y+=80;

    if(opts.showScore){
      ctx.font=`800 26px ${FONT}`; ctx.fillStyle='#E8C97A'; ctx.letterSpacing='7px';
      ctx.fillText('MY RATING',W/2,y+40); ctx.letterSpacing='0px';
      ctx.font=`800 88px ${FONT}`; ctx.fillStyle='#fff';
      ctx.fillText(Number(opts.rating).toFixed(1),W/2,y+150);
      ctx.font=`700 30px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.fillText('/ 10',W/2,y+188);
      const n5=opts.rating/2, ssize=40, sgap=ssize*1.35, sx0=W/2-sgap*2, sy=y+250;
      ctx.font=`${ssize}px ${FONT}`; ctx.fillStyle='#C9973A';
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
      y+=310;
    }else{
      y+=50;
    }

    if(opts.producerHandle){
      const txt=`📸 @${opts.producerHandle}`;
      ctx.font=`800 46px ${FONT}`;
      const tw=ctx.measureText(txt).width, pw=tw+90, ph=92, px=(W-pw)/2, py=y;
      ctx.fillStyle='#C9973A';
      ctx.beginPath(); ctx.roundRect(px,py,pw,ph,46); ctx.fill();
      ctx.fillStyle='#3d0a1d'; ctx.fillText(txt,W/2,py+62);
      ctx.font=`600 32px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.75)';
      ctx.fillText('ごちそうさまでした 🙏',W/2,py+160);
    }else{
      ctx.font=`700 42px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.fillText('ごちそうさまでした 🙏',W/2,y+50);
    }

    if(chara){ const chH=300,chW=chH*(chara.naturalWidth/chara.naturalHeight);
      ctx.drawImage(chara,W-chW-30,H-chH-90,chW,chH); }

    ctx.textAlign='left';
    ctx.font=`700 34px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.fillText('#Sommelin',70,H-190);
    if(opts.officialIg){ ctx.fillText('@'+opts.officialIg,70,H-140); }
    ctx.font=`600 30px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.55)';
    ctx.fillText(String(opts.appUrl||'').replace('https://',''),70,H-90);
  }

  // ── store: 店の推しカード（当店のおすすめ。SP/total等の評価数値は載せない） ──
  function drawStore(ctx,opts){
    const g=ctx.createLinearGradient(0,0,W*0.6,H);
    g.addColorStop(0,'#3d0a1d'); g.addColorStop(0.5,'#5C0E2A'); g.addColorStop(1,'#9B1B4B');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,0.045)';
    ctx.beginPath(); ctx.arc(W*0.92,H*0.10,300,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(W*0.05,H*0.85,260,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(201,151,58,0.10)';
    ctx.beginPath(); ctx.arc(W*0.85,H*0.78,200,0,Math.PI*2); ctx.fill();

    ctx.textAlign='center';
    ctx.fillStyle='#E8C97A';
    ctx.font=`800 32px ${FONT}`; ctx.letterSpacing='8px';
    ctx.fillText('当店のおすすめ',W/2,300); ctx.letterSpacing='0px';

    ctx.font=`800 78px ${FONT}`; ctx.fillStyle='#fff';
    const lines=wrap(ctx,opts.name,920,3);
    let y=430;
    for(const ln of lines){ ctx.fillText(ln,W/2,y); y+=96; }
    ctx.font=`700 44px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.85)';
    const sub=[opts.producer,(opts.vintage&&opts.vintage!=='NV')?opts.vintage:''].filter(Boolean).join('　');
    if(sub){ ctx.fillText(trunc(sub,26),W/2,y+14); y+=70; }

    ctx.strokeStyle='#C9973A'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(W/2-110,y+30); ctx.lineTo(W/2+110,y+30); ctx.stroke();
    y+=90;

    if(opts.comment){
      ctx.font=`700 44px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.92)';
      const clines=wrap(ctx,`「${opts.comment}」`,900,4);
      for(const ln of clines){ ctx.fillText(ln,W/2,y); y+=62; }
      y+=30;
    }else{
      y+=20;
    }

    if(opts.priceMode && opts.priceMode!=='none'){
      const pills=[];
      if((opts.priceMode==='glass'||opts.priceMode==='both') && opts.priceGlass) pills.push(`グラス ¥${Number(opts.priceGlass).toLocaleString('ja-JP')}`);
      if((opts.priceMode==='bottle'||opts.priceMode==='both') && opts.priceBottle) pills.push(`ボトル ¥${Number(opts.priceBottle).toLocaleString('ja-JP')}`);
      if(pills.length){
        ctx.font=`800 36px ${FONT}`;
        const gap=24, phH=76;
        const widths=pills.map(p=>ctx.measureText(p).width+56);
        const totalW=widths.reduce((a,b)=>a+b,0)+gap*(pills.length-1);
        let px=(W-totalW)/2;
        for(let i=0;i<pills.length;i++){
          const pw=widths[i];
          ctx.strokeStyle='#C9973A'; ctx.lineWidth=2.5;
          ctx.beginPath(); ctx.roundRect(px,y,pw,phH,38); ctx.stroke();
          ctx.fillStyle='#E8C97A'; ctx.fillText(pills[i],px+pw/2,y+50);
          px+=pw+gap;
        }
        y+=phH+40;
      }
    }

    y+=20;
    ctx.font=`800 46px ${FONT}`; ctx.fillStyle='#fff';
    ctx.fillText(trunc(opts.storeName||'',22),W/2,y);
    y+=60;
    if(opts.storeHandle){
      const txt=`@${opts.storeHandle}`;
      ctx.font=`700 34px ${FONT}`;
      const tw=ctx.measureText(txt).width, pw=tw+56, ph=64, px=(W-pw)/2;
      ctx.fillStyle='rgba(201,151,58,0.18)'; ctx.strokeStyle='#C9973A'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.roundRect(px,y,pw,ph,32); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#E8C97A'; ctx.fillText(txt,W/2,y+44);
    }

    ctx.textAlign='left';
    ctx.font=`700 34px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.fillText('#Sommelin',70,H-140);
    ctx.font=`600 30px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.55)';
    ctx.fillText(String(opts.appUrl||'').replace('https://',''),70,H-90);
  }

  async function draw(opts){
    opts=opts||{};
    const assetBase=opts.assetBase||'assets/sommelin/';
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');

    if(opts.template==='store'){
      drawStore(ctx,opts);
    }else{
      const [logo,chara]=await Promise.all([
        loadImg(assetBase+'sommelin-logo.png'),
        loadImg(assetBase+'sommelin-delighted.png')]);
      if(opts.photoDataUrl){
        await drawFanPhoto(ctx,opts,logo);
      }else{
        drawFanClassic(ctx,opts,logo,chara);
      }
    }

    return new Promise(res=>cv.toBlob(res,'image/png'));
  }

  window.OshiCard = { draw };
})();

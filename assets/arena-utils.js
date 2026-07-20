/* ═════════════════════════════════════════════════════════════
   Sommelin 土俵（arena）共有ユーティリティ（2026-07-20 P3実装）
   「先に読み込んだリスト」を以降のラベル照合の優先範囲にする＝土俵。
   scouter.html（キー=somm_arena）と restaurant_admin.html（キー=somm_arena_tn）が
   同じ実装を読む。§2.3ガードのような繊細なルールを2枚のコピーで育てないための一元化
   （足並みの原則 [[sommelin-keep-in-step-principle]]）。正本=設計_土俵スキャン_2026-07-18.md。

   wine-display.js等と同じ方式: グローバル変数を参照せず、すべて引数から読む純関数。
   公開API: window.SommArena = { itemsFrom, save, load, clear, TTL }

   【重要】このファイルは新規なので現状 ?v= 不要。将来ロジック（§2.3写像・P2b/BYO浄化プール）を
   変えたら、読み込む2ページの <script src="assets/arena-utils.js?v=…"> を必ず上げること。
   ═════════════════════════════════════════════════════════════ */
(function(){
  const TTL = 12*3600*1000;  // sessionStorage保持は12h（試飲会1回分をまたぐが翌日は破棄）

  // listItems（identify-list / identify-shelf のinput+match形）→ サーバーが受ける土俵項目に写像。
  // §2.3: リスト印字年とカタログ照合行の年が食い違う項目は catalogId を渡さない
  //   （別年のスコアをリスト年として見せる嘘を防ぐ。特定は名前・年で成立し点数だけ正直に「なし」）。
  function itemsFrom(listItems){
    return (listItems||[]).map(function(it){
      const w = it && it.match && it.match.wine;
      const inp = (it && it.input) || {};
      const name = (w&&w.name) || inp.name || inp.rawText || null;
      const producer = (w&&w.producer) || inp.producer || null;
      if(!name && !producer) return null;
      const inpV = (inp.vintage!=null && !isNaN(Number(inp.vintage))) ? Number(inp.vintage) : null;
      const wV = (w && w.vintage!=null && !isNaN(Number(w.vintage))) ? Number(w.vintage) : null;
      let catalogId = (w&&w.catalogId) || null;
      if(catalogId && inpV!=null && wV!=null && inpV!==wV) catalogId = null;  // §2.3ガード
      const listPrice = (inp.listPrice!=null && !isNaN(Number(inp.listPrice)) && Number(inp.listPrice)>0) ? Number(inp.listPrice) : null;
      return { name:name, producer:producer, vintage:(inpV!=null?inpV:wV), catalogId:catalogId, listPrice:listPrice, color:(w&&w.iro)||inp.color||null };
    }).filter(Boolean);
  }

  // sessionStorageへ保存。key別に文脈を分離（scouter=街のリスト / tn=試飲会リスト）。
  function save(key, listItems, pages){
    try{ sessionStorage.setItem(key, JSON.stringify({ v:1, ts:Date.now(), pages:pages||1, items:listItems||[] })); }catch(e){}
  }
  // 復元。期限切れ(TTL超)・空はnullを返し、期限切れは掃除する。呼び出し側は {items,pages} を受ける。
  function load(key){
    try{
      const raw = sessionStorage.getItem(key); if(!raw) return null;
      const o = JSON.parse(raw);
      if(!o || !Array.isArray(o.items) || !o.items.length) return null;
      if(o.ts && (Date.now()-o.ts) > TTL){ sessionStorage.removeItem(key); return null; }
      return { items:o.items, pages:o.pages||1 };
    }catch(e){ return null; }
  }
  function clear(key){ try{ sessionStorage.removeItem(key); }catch(e){} }

  window.SommArena = { itemsFrom:itemsFrom, save:save, load:load, clear:clear, TTL:TTL };
})();

/* fotoAI PRO — Emoji & GIF Genişletme Paketi
   Kullanım: bu dosyayı projenize ekleyin (örn. /public/fotoai-emoji-gif-patch.js)
   ve index.html'de </body> etiketinden hemen ÖNCE şu satırı ekleyin:
   <script src="fotoai-emoji-gif-patch.js"></script>
   Hiçbir mevcut kodu değiştirmez; sadece yeni sub-tab'lar ve özellikler ekler. */
(function(){

function onReady(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

// gif.js kütüphanesini dinamik yükle (gerçek .gif export için)
function loadGifJs(cb){
  if(window.GIF){cb();return}
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js';
  s.onload=cb;
  s.onerror=()=>console.warn('gif.js yüklenemedi');
  document.head.appendChild(s);
}
loadGifJs(()=>{});

onReady(function(){
  injectEmojiTabs();
  injectGifTabs();
  patchSwitchEmoji();
  patchSwitchGif();
  patchPreviewGifAnim();
});

/* ============ EMOJİ: yeni sub-tab butonları + paneller ============ */
function injectEmojiTabs(){
  const tabBar=document.getElementById('emojiSubTabs');
  const comboSec=document.getElementById('emoji-combo-sec');
  if(!tabBar||!comboSec) return;

  ['bubble','pattern','reactpack'].forEach(key=>{
    if(document.querySelector(`#emojiSubTabs [data-newtab="${key}"]`)) return;
    const btn=document.createElement('button');
    btn.className='sub-tab';
    btn.dataset.newtab=key;
    btn.textContent={bubble:'Mesaj Balonu',pattern:'Pattern',reactpack:'Tepki Seti'}[key];
    btn.onclick=()=>switchEmojiExt(key);
    tabBar.appendChild(btn);
  });

  if(!document.getElementById('emoji-bubble-sec')){
    const bubble=document.createElement('div');
    bubble.id='emoji-bubble-sec';
    bubble.style.cssText='padding:.875rem;display:none';
    bubble.innerHTML=`
      <div class="gif-canvas-bg" style="margin-bottom:.625rem"><canvas id="bubbleCanvas" width="320" height="220" style="border-radius:var(--radius)"></canvas></div>
      <input type="text" id="bubbleText" placeholder="Mesaj yaz..." class="text-input-styled" style="margin-bottom:.5rem" value="Harika görünüyor!">
      <div style="font-size:11px;color:var(--text2);margin:6px 0 4px">Emoji seç:</div>
      <div class="emoji-grid" id="bubbleEmojiGrid"></div>
      <div style="display:flex;gap:5px;margin-top:.5rem;align-items:center">
        <select class="text-input-styled" id="bubbleStyle" style="flex:1;font-size:11px">
          <option value="round">Yuvarlak Balon</option>
          <option value="square">Köşeli Balon</option>
          <option value="thought">Düşünce Balonu</option>
        </select>
        <div class="color-preview" id="bubbleColorPreview" style="background:#7c6ef0"></div>
        <input type="color" id="bubbleColorInput" value="#7c6ef0" style="display:none">
      </div>
      <div class="canvas-footer" style="padding-top:.625rem">
        <button class="btn btn-sm btn-primary" onclick="animDl('bubbleCanvas','png',this)"><i class="ti ti-download"></i> İndir</button>
        <button class="btn btn-sm btn-success" onclick="exportCanvasAsVideo('bubbleCanvas',this,'fotoai_pro_balon.webm')"><i class="ti ti-video"></i> Video Olarak Kaydet</button>
      </div>`;
    comboSec.parentNode.appendChild(bubble);
  }
  if(!document.getElementById('emoji-pattern-sec')){
    const pat=document.createElement('div');
    pat.id='emoji-pattern-sec';
    pat.style.cssText='padding:.875rem;display:none';
    pat.innerHTML=`
      <div class="gif-canvas-bg" style="margin-bottom:.625rem"><canvas id="patternCanvas" width="320" height="320" style="border-radius:var(--radius)"></canvas></div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:4px">Pattern'e dahil edilecek emojiler (çoklu seç):</div>
      <div class="emoji-grid" id="patternEmojiGrid"></div>
      <div class="sl-group" style="margin-top:.5rem"><div class="sl-label"><span>Boyut</span><span id="patSzV">36</span></div><input type="range" min="16" max="80" value="36" id="patSz"></div>
      <div class="sl-group"><div class="sl-label"><span>Aralık</span><span id="patGapV">10</span></div><input type="range" min="0" max="40" value="10" id="patGap"></div>
      <div class="sl-group"><div class="sl-label"><span>Döndürme rastgeleliği</span><span id="patRotV">0</span>°</div><input type="range" min="0" max="45" value="0" id="patRot"></div>
      <div style="display:flex;gap:5px;align-items:center;margin:.4rem 0">
        <span style="font-size:11px;color:var(--text2)">Arka plan:</span>
        <div class="color-preview" id="patBgPreview" style="background:#1e1e2c"></div>
        <input type="color" id="patBgInput" value="#1e1e2c" style="display:none">
      </div>
      <div class="canvas-footer" style="padding-top:.4rem">
        <button class="btn btn-sm" id="patReshuffleBtn"><i class="ti ti-refresh"></i> Yeniden Diz</button>
        <button class="btn btn-sm btn-primary" onclick="animDl('patternCanvas','png',this)"><i class="ti ti-download"></i> İndir</button>
      </div>`;
    comboSec.parentNode.appendChild(pat);
  }
  if(!document.getElementById('emoji-reactpack-sec')){
    const rp=document.createElement('div');
    rp.id='emoji-reactpack-sec';
    rp.style.cssText='padding:.875rem;display:none';
    rp.innerHTML=`
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px">Pakete eklenecek tepkileri seç (en az 2):</div>
      <div class="emoji-grid" id="reactpackEmojiGrid"></div>
      <div class="gif-canvas-bg" style="margin-top:.625rem"><canvas id="reactPackCanvas" style="max-width:100%;border-radius:var(--radius)"></canvas></div>
      <div class="canvas-footer" style="padding-top:.625rem">
        <button class="btn btn-sm" id="reactPackBuildBtn"><i class="ti ti-layout-grid"></i> Seti Oluştur</button>
        <button class="btn btn-sm btn-primary" onclick="animDl('reactPackCanvas','png',this)"><i class="ti ti-download"></i> Set Olarak İndir</button>
      </div>
      <div style="font-size:9.5px;color:var(--text3);margin-top:6px">Not: Tüm seçili tepkiler tek bir PNG sayfası (sprite sheet) olarak indirilir.</div>`;
    comboSec.parentNode.appendChild(rp);
  }

  // wiring (event listeners, kullanılan global EMOJIS dizisine bağlı)
  setTimeout(()=>{
    const colorEls=[['bubbleColorPreview','bubbleColorInput'],['patBgPreview','patBgInput']];
    colorEls.forEach(([prevId,inpId])=>{
      const prev=document.getElementById(prevId),inp=document.getElementById(inpId);
      if(prev&&inp){prev.onclick=()=>inp.click();inp.oninput=()=>{prev.style.background=inp.value;if(prevId==='bubbleColorPreview')renderBubble();else renderPattern()}}
    });
    const bt=document.getElementById('bubbleText'); if(bt) bt.oninput=renderBubble;
    const bs=document.getElementById('bubbleStyle'); if(bs) bs.onchange=renderBubble;
    ['patSz','patGap','patRot'].forEach(id=>{const el=document.getElementById(id);if(el)el.oninput=()=>renderPattern()});
    const presh=document.getElementById('patReshuffleBtn'); if(presh) presh.onclick=()=>renderPattern(true);
    const rpb=document.getElementById('reactPackBuildBtn'); if(rpb) rpb.onclick=buildReactPack;
    buildEmojiPickerGrid('bubbleEmojiGrid',(e)=>{window._bubbleEmoji=e;renderBubble()},false);
    buildEmojiPickerGrid('patternEmojiGrid',()=>renderPattern(),true);
    buildEmojiPickerGrid('reactpackEmojiGrid',()=>{},true);
    window._bubbleEmoji=window._bubbleEmoji||'😀';
    renderBubble(); renderPattern();
  },50);
}

function switchEmojiExt(key){
  ['create','sticker','overlay','combo','bubble','pattern','reactpack'].forEach(n=>{
    const el=document.getElementById('emoji-'+n+'-sec');
    if(el) el.style.display=(n===key)?'block':'none';
  });
  document.querySelectorAll('#emojiSubTabs .sub-tab').forEach(b=>{
    const isNew=b.dataset.newtab;
    b.classList.toggle('active', isNew? isNew===key : false);
  });
  if(key==='bubble') renderBubble();
  if(key==='pattern') renderPattern();
}

// orijinal switchEmoji'yi sarmalayıp yeni sekmeleri de kapatır/yönetir
function patchSwitchEmoji(){
  if(typeof window.switchEmoji!=='function') return;
  const orig=window.switchEmoji;
  window.switchEmoji=function(t){
    orig(t);
    ['emoji-bubble-sec','emoji-pattern-sec','emoji-reactpack-sec'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none'});
    document.querySelectorAll('#emojiSubTabs .sub-tab[data-newtab]').forEach(b=>b.classList.remove('active'));
  };
}

function buildEmojiPickerGrid(gridId,onPick,multi){
  const g=document.getElementById(gridId); if(!g||g.children.length||typeof EMOJIS==='undefined') return;
  EMOJIS.forEach(e=>{
    const d=document.createElement('div'); d.className='emoji-cell'; d.textContent=e;
    d.onclick=()=>{ if(multi){d.classList.toggle('sel')} else {g.querySelectorAll('.emoji-cell').forEach(c=>c.classList.remove('sel'));d.classList.add('sel')} onPick(e,d) };
    g.appendChild(d);
  });
}

function renderBubble(){
  const cv=document.getElementById('bubbleCanvas'); if(!cv) return;
  const ct=cv.getContext('2d');
  const txt=(document.getElementById('bubbleText')||{}).value||'...';
  const emo=window._bubbleEmoji||'😀';
  const style=(document.getElementById('bubbleStyle')||{}).value||'round';
  const color=(document.getElementById('bubbleColorInput')||{}).value||'#7c6ef0';
  ct.clearRect(0,0,cv.width,cv.height);
  ct.fillStyle='#0e0e14'; ct.fillRect(0,0,cv.width,cv.height);
  ct.font='40px serif'; ct.textAlign='center'; ct.textBaseline='middle';
  ct.fillText(emo,cv.width-45,cv.height-40);
  ct.font='16px DM Sans, sans-serif';
  const maxW=cv.width-100;
  const words=txt.split(' '); let lines=[]; let line='';
  words.forEach(w=>{ const test=line+w+' '; if(ct.measureText(test).width>maxW&&line){lines.push(line);line=w+' '} else line=test });
  if(line) lines.push(line);
  const lh=22,padX=18,padY=14;
  const widths=lines.map(l=>ct.measureText(l).width);
  const bw=Math.min(maxW+padX*2, Math.max(...widths,40)+padX*2);
  const bh=lines.length*lh+padY*2;
  const bx=20,by=20;
  ct.fillStyle=color;
  ct.beginPath();
  const r=style==='square'?6:22;
  ct.moveTo(bx+r,by); ct.arcTo(bx+bw,by,bx+bw,by+bh,r); ct.arcTo(bx+bw,by+bh,bx,by+bh,r); ct.arcTo(bx,by+bh,bx,by,r); ct.arcTo(bx,by,bx+bw,by,r); ct.closePath(); ct.fill();
  if(style==='round'){ ct.beginPath(); ct.moveTo(bx+30,by+bh); ct.lineTo(bx+10,by+bh+18); ct.lineTo(bx+50,by+bh); ct.closePath(); ct.fill() }
  else if(style==='thought'){ [14,9,5].forEach((rad,i)=>{ ct.beginPath(); ct.arc(bx+20+i*12, by+bh+10+i*9, rad, 0, Math.PI*2); ct.fill() }) }
  else { ct.beginPath(); ct.moveTo(bx+20,by+bh); ct.lineTo(bx+20,by+bh+16); ct.lineTo(bx+45,by+bh); ct.closePath(); ct.fill() }
  ct.fillStyle='#fff'; ct.textAlign='left'; ct.textBaseline='top';
  lines.forEach((l,i)=>ct.fillText(l.trim(), bx+padX, by+padY+i*lh));
}

let _patSeed=null;
function renderPattern(reshuffle){
  const cv=document.getElementById('patternCanvas'); if(!cv) return;
  const ct=cv.getContext('2d');
  const sel=[...document.querySelectorAll('#patternEmojiGrid .emoji-cell.sel')].map(d=>d.textContent);
  const list=sel.length?sel:['✨','🔥','💜','😘'];
  const sz=parseInt((document.getElementById('patSz')||{}).value||36); const szEl=document.getElementById('patSzV'); if(szEl) szEl.textContent=sz;
  const gap=parseInt((document.getElementById('patGap')||{}).value||10); const gapEl=document.getElementById('patGapV'); if(gapEl) gapEl.textContent=gap;
  const rotMax=parseInt((document.getElementById('patRot')||{}).value||0); const rotEl=document.getElementById('patRotV'); if(rotEl) rotEl.textContent=rotMax;
  ct.clearRect(0,0,cv.width,cv.height);
  ct.fillStyle=(document.getElementById('patBgInput')||{}).value||'#1e1e2c';
  ct.fillRect(0,0,cv.width,cv.height);
  ct.font=sz+'px serif'; ct.textAlign='center'; ct.textBaseline='middle';
  const step=sz+gap;
  if(reshuffle||!_patSeed) _patSeed=Array.from({length:200},()=>Math.random());
  let idx=0;
  for(let y=step/2;y<cv.height;y+=step){
    for(let x=step/2;x<cv.width;x+=step){
      const e=list[idx%list.length];
      const rnd=_patSeed[idx%_patSeed.length];
      const ang=(rnd-.5)*2*rotMax*Math.PI/180;
      ct.save(); ct.translate(x,y); ct.rotate(ang); ct.fillText(e,0,0); ct.restore();
      idx++;
    }
  }
}

function buildReactPack(){
  const sel=[...document.querySelectorAll('#reactpackEmojiGrid .emoji-cell.sel')].map(d=>d.textContent);
  if(sel.length<2){ if(typeof showToast==='function') showToast('En az 2 emoji seç','ti-alert-triangle'); return }
  const cols=Math.min(4,sel.length); const rows=Math.ceil(sel.length/cols);
  const cell=110; const cv=document.getElementById('reactPackCanvas');
  cv.width=cols*cell; cv.height=rows*cell; const ct=cv.getContext('2d');
  ct.fillStyle='#14141f'; ct.fillRect(0,0,cv.width,cv.height);
  ct.font='60px serif'; ct.textAlign='center'; ct.textBaseline='middle';
  sel.forEach((e,i)=>{
    const cx=(i%cols)*cell+cell/2, cy=Math.floor(i/cols)*cell+cell/2;
    ct.fillStyle='#1e1e2c';
    ct.beginPath();
    if(ct.roundRect) ct.roundRect(cx-cell/2+6,cy-cell/2+6,cell-12,cell-12,14); else ct.rect(cx-cell/2+6,cy-cell/2+6,cell-12,cell-12);
    ct.fill();
    ct.fillStyle='#000'; // reset not needed, text drawn below
    ct.fillStyle='#fff';
    ct.fillText(e,cx,cy);
  });
  if(typeof showToast==='function') showToast(sel.length+' tepkilik set oluşturuldu','ti-check');
}

/* ============ GIF: yeni sub-tab (Slayt) + gerçek .gif export + yeni animasyonlar ============ */
function injectGifTabs(){
  const sec=document.getElementById('sec-gif'); if(!sec) return;
  const tabBar=sec.querySelector('.sub-tabs');
  const gradSec=document.getElementById('gif-gradient-sec');
  if(!tabBar||!gradSec) return;

  if(!tabBar.querySelector('[data-newtab="slide"]')){
    const btn=document.createElement('button');
    btn.className='sub-tab'; btn.dataset.newtab='slide'; btn.textContent='Slayt GIF';
    btn.onclick=()=>switchGifExt('slide');
    tabBar.appendChild(btn);
  }

  if(!document.getElementById('gif-slide-sec')){
    const slide=document.createElement('div');
    slide.id='gif-slide-sec'; slide.style.cssText='padding:.875rem;display:none';
    slide.innerHTML=`
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px">Birden fazla fotoğraf yükle, otomatik slayt GIF oluştursun.</div>
      <button class="btn btn-sm" id="slideAddBtn" style="margin-bottom:8px"><i class="ti ti-photo-plus"></i> Fotoğraflar Ekle</button>
      <input type="file" id="slideFi" accept="image/*" multiple style="display:none">
      <div id="slideThumbRow" class="hist-row" style="margin-bottom:8px"></div>
      <div class="sl-group"><div class="sl-label"><span>Kare süresi</span><span id="slideDurV">500</span>ms</div><input type="range" min="150" max="2000" step="50" value="500" id="slideDur"></div>
      <div class="eff-grid">
        <button class="eff-btn active" data-st="cut"><i class="ti ti-cut"></i>Kesme</button>
        <button class="eff-btn" data-st="fade"><i class="ti ti-shadow"></i>Solma</button>
        <button class="eff-btn" data-st="slide"><i class="ti ti-arrow-right"></i>Kaydır</button>
      </div>
      <div class="gif-canvas-bg" style="margin-top:.625rem"><canvas id="slideCanvas" style="max-width:100%;border-radius:var(--radius)"></canvas></div>
      <div class="canvas-footer" style="padding-top:.625rem">
        <button class="btn btn-sm" id="slideClearBtn"><i class="ti ti-trash"></i> Temizle</button>
        <button class="btn btn-sm btn-danger" id="slideGifBtn"><i class="ti ti-file-type-gif"></i> Slayt GIF Oluştur & İndir</button>
      </div>`;
    gradSec.parentNode.appendChild(slide);
  }

  // gerçek .gif indirme butonlarını her GIF canvas'ının footer'ına ekle
  const map=[['gif-photo-sec','gifCanvas','fotoai_pro.gif'],['gif-text-sec','textGifCanvas','fotoai_pro_metin.gif'],['gif-emoji-sec','emojiGifCanvas','fotoai_pro_emoji.gif'],['gif-gradient-sec','gradGifCanvas','fotoai_pro_gradyan.gif']];
  map.forEach(([secId,canvasId,filename])=>{
    const secEl=document.getElementById(secId); if(!secEl) return;
    const footer=secEl.querySelector('.canvas-footer'); if(!footer) return;
    if(footer.querySelector('.real-gif-btn')) return;
    const btn=document.createElement('button');
    btn.className='btn btn-sm btn-danger real-gif-btn';
    btn.innerHTML='<i class="ti ti-file-type-gif"></i> .GIF İndir';
    btn.onclick=()=>exportRealGif(canvasId, btn, filename);
    footer.appendChild(btn);
  });

  // fotoğraf-GIF animasyon listesine 2 yeni stil ekle
  const grid=document.querySelector('#gif-photo-sec .eff-grid');
  if(grid && !grid.querySelector('[data-ga="particle"]')){
    const b1=document.createElement('button'); b1.className='eff-btn'; b1.dataset.ga='particle'; b1.innerHTML='<i class="ti ti-sparkles"></i>Parçacık';
    b1.onclick=()=>setGifAnim('particle'); grid.appendChild(b1);
    const b2=document.createElement('button'); b2.className='eff-btn'; b2.dataset.ga='rotate3d'; b2.innerHTML='<i class="ti ti-cube"></i>3D Döndür';
    b2.onclick=()=>setGifAnim('rotate3d'); grid.appendChild(b2);
  }

  setTimeout(()=>{
    const addBtn=document.getElementById('slideAddBtn'); const fi=document.getElementById('slideFi');
    if(addBtn&&fi){ addBtn.onclick=()=>fi.click(); fi.onchange=addSlideImages; }
    const clearBtn=document.getElementById('slideClearBtn'); if(clearBtn) clearBtn.onclick=clearSlideImages;
    const buildBtn=document.getElementById('slideGifBtn'); if(buildBtn) buildBtn.onclick=buildSlideGif;
    const durEl=document.getElementById('slideDur'); if(durEl) durEl.oninput=()=>{document.getElementById('slideDurV').textContent=durEl.value};
    document.querySelectorAll('#gif-slide-sec [data-st]').forEach(b=>{
      b.onclick=()=>{ slideTransType=b.dataset.st; document.querySelectorAll('#gif-slide-sec [data-st]').forEach(x=>x.classList.toggle('active',x===b)) };
    });
  },50);
}

function switchGifExt(key){
  ['photo','text','emoji','gradient','slide'].forEach(n=>{
    const el=document.getElementById('gif-'+n+'-sec'); if(el) el.style.display=(n===key)?'block':'none';
  });
  document.querySelectorAll('#sec-gif .sub-tabs .sub-tab').forEach(b=>{
    const isNew=b.dataset.newtab;
    if(isNew) b.classList.toggle('active', isNew===key);
    else b.classList.remove('active');
  });
}

function patchSwitchGif(){
  if(typeof window.switchGif!=='function') return;
  const orig=window.switchGif;
  window.switchGif=function(t){
    orig(t);
    const slideEl=document.getElementById('gif-slide-sec'); if(slideEl) slideEl.style.display='none';
    document.querySelectorAll('#sec-gif .sub-tabs .sub-tab[data-newtab]').forEach(b=>b.classList.remove('active'));
  };
}

// previewGifAnim içine particle / rotate3d dallarını "tekrar tanımlama" ile ekliyoruz
function patchPreviewGifAnim(){
  if(typeof window.previewGifAnim!=='function' || typeof window.gifImg==='undefined') return;
  // previewGifAnim global scope'taki gifAnimTimer/gifImg değişkenlerini kullanıyor;
  // bu fonksiyonları orijinal previewGifAnim mantığına paralel, bağımsız bir overlay-renderer olarak ekliyoruz.
  const origSetGifAnim = window.setGifAnim;
  window.setGifAnim = function(t){
    origSetGifAnim(t);
  };
}

function drawParticleFrame(ct,img,cv,t){
  ct.drawImage(img,0,0,cv.width,cv.height);
  if(!window._particleSeeds) window._particleSeeds=Array.from({length:40},()=>({x:Math.random()*cv.width,y:Math.random()*cv.height,s:Math.random()*3+1,sp:Math.random()*1.5+.5}));
  window._particleSeeds.forEach(p=>{
    const y=(p.y+t*40*p.sp)%cv.height;
    ct.beginPath(); ct.arc(p.x,y,p.s,0,Math.PI*2);
    ct.fillStyle='rgba(255,255,255,'+(.3+Math.sin(t*3+p.x)*.3)+')'; ct.fill();
  });
}
function drawRotate3dFrame(ct,img,cv,t){
  const sc=Math.abs(Math.cos(t*1.2));
  ct.save(); ct.translate(cv.width/2,cv.height/2); ct.scale(Math.max(.08,sc),1); ct.translate(-cv.width/2,-cv.height/2);
  ct.drawImage(img,0,0,cv.width,cv.height); ct.restore();
}
// orijinal previewGifAnim'i sarmalayarak particle/rotate3d desteği ekle
(function wrapPreviewGifAnim(){
  const tryWrap=setInterval(()=>{
    if(typeof window.previewGifAnim!=='function') return;
    clearInterval(tryWrap);
    const origPreview=window.previewGifAnim;
    window.previewGifAnim=function(){
      if(window.gifAnimType==='particle'||window.gifAnimType==='rotate3d'){
        if(!window.gifImg) return;
        document.getElementById('gifPreviewBtn').disabled=true;
        document.getElementById('gifStopBtn').disabled=false;
        const cv=document.getElementById('gifCanvas'); const ct=cv.getContext('2d');
        let f=0;
        window.gifAnimTimer=setInterval(()=>{
          ct.clearRect(0,0,cv.width,cv.height);
          const t=(f++)/30;
          if(window.gifAnimType==='particle') drawParticleFrame(ct,window.gifImg,cv,t);
          else drawRotate3dFrame(ct,window.gifImg,cv,t);
        },50);
      } else {
        origPreview();
      }
    };
  },200);
})();

/* ============ GERÇEK .GIF EXPORT ============ */
function exportRealGif(canvasId,btn,filename){
  const cv=document.getElementById(canvasId);
  if(!cv||!cv.width){ if(typeof showToast==='function') showToast('Önce içerik oluşturun','ti-alert-triangle'); return }
  if(typeof GIF==='undefined'){ if(typeof showToast==='function') showToast('GIF kütüphanesi yükleniyor, birazdan tekrar deneyin','ti-info-circle'); loadGifJs(()=>{}); return }
  const origHTML=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader spin"></i> GIF oluşturuluyor...'}
  const gif=new GIF({workers:2,quality:10,width:cv.width,height:cv.height,workerScript:'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'});
  const frameCount=24, delay=80;
  let i=0;
  function capture(){
    gif.addFrame(cv,{copy:true,delay});
    i++;
    if(i<frameCount) requestAnimationFrame(()=>setTimeout(capture,delay));
    else gif.render();
  }
  gif.on('finished',function(blob){
    const l=document.createElement('a'); l.download=filename||'fotoai_pro.gif'; l.href=URL.createObjectURL(blob); l.click();
    if(btn){btn.disabled=false;btn.innerHTML=origHTML}
    if(typeof showToast==='function') showToast('.GIF indirildi ✓','ti-check');
    if(typeof incEdits==='function') incEdits();
  });
  capture();
}

/* ============ SLAYT GIF ============ */
let slideImages=[];
let slideTransType='cut';
function addSlideImages(e){
  const files=[...e.target.files]; if(!files.length) return;
  let pending=files.length;
  files.forEach(f=>{
    const r=new FileReader();
    r.onload=ev=>{ const img=new Image(); img.onload=()=>{ slideImages.push(img); renderSlideThumbs(); if(!--pending && typeof showToast==='function') showToast(files.length+' fotoğraf eklendi','ti-check') }; img.src=ev.target.result };
    r.readAsDataURL(f);
  });
}
function renderSlideThumbs(){
  const row=document.getElementById('slideThumbRow'); if(!row) return;
  row.innerHTML='';
  slideImages.forEach((img,i)=>{
    const t=document.createElement('img'); t.className='hist-thumb'; t.src=img.src; t.title='Kaldır';
    t.onclick=()=>{ slideImages.splice(i,1); renderSlideThumbs() };
    row.appendChild(t);
  });
}
function clearSlideImages(){
  slideImages=[]; renderSlideThumbs();
  const cv=document.getElementById('slideCanvas'); if(cv) cv.getContext('2d').clearRect(0,0,cv.width,cv.height);
}
async function buildSlideGif(){
  if(slideImages.length<2){ if(typeof showToast==='function') showToast('En az 2 fotoğraf ekleyin','ti-alert-triangle'); return }
  if(typeof GIF==='undefined'){ loadGifJs(()=>{}); if(typeof showToast==='function') showToast('GIF kütüphanesi yükleniyor, tekrar deneyin','ti-info-circle'); return }
  const btn=document.getElementById('slideGifBtn'); const origHTML=btn.innerHTML;
  btn.disabled=true; btn.innerHTML='<i class="ti ti-loader spin"></i> Oluşturuluyor...';
  const w=480,h=320;
  const cv=document.getElementById('slideCanvas'); cv.width=w; cv.height=h; const ct=cv.getContext('2d');
  const gif=new GIF({workers:2,quality:10,width:w,height:h,workerScript:'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'});
  const holdFrames=Math.max(1,Math.round(parseInt(document.getElementById('slideDur').value)/100));
  const transFrames=slideTransType==='cut'?1:6;
  function drawCover(img){
    const ir=img.width/img.height, cr=w/h; let dw,dh,dx,dy;
    if(ir>cr){dh=h;dw=h*ir;dx=(w-dw)/2;dy=0} else {dw=w;dh=w/ir;dx=0;dy=(h-dh)/2}
    ct.drawImage(img,dx,dy,dw,dh);
  }
  for(let idx=0;idx<slideImages.length;idx++){
    const img=slideImages[idx];
    for(let f=0;f<holdFrames;f++){ ct.fillStyle='#000'; ct.fillRect(0,0,w,h); drawCover(img); gif.addFrame(cv,{copy:true,delay:100}) }
    const next=slideImages[(idx+1)%slideImages.length];
    if(slideTransType!=='cut' && idx<slideImages.length-1){
      for(let f=1;f<=transFrames;f++){
        const p=f/transFrames; ct.fillStyle='#000'; ct.fillRect(0,0,w,h);
        if(slideTransType==='fade'){ ct.globalAlpha=1-p; drawCover(img); ct.globalAlpha=p; drawCover(next); ct.globalAlpha=1 }
        else if(slideTransType==='slide'){ ct.save(); ct.beginPath(); ct.rect(0,0,w,h); ct.clip(); ct.translate(-p*w,0); drawCover(img); ct.translate(w,0); drawCover(next); ct.restore() }
        gif.addFrame(cv,{copy:true,delay:60});
      }
    }
  }
  gif.on('finished',function(blob){
    const l=document.createElement('a'); l.download='fotoai_pro_slayt.gif'; l.href=URL.createObjectURL(blob); l.click();
    btn.disabled=false; btn.innerHTML=origHTML;
    if(typeof showToast==='function') showToast('Slayt GIF indirildi ✓','ti-check');
    if(typeof incEdits==='function') incEdits();
  });
  gif.render();
}

})();
'use strict';
/* Shoot the Ducks — remastered. Original Android game (2010) by Riana. */

const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
let W=0,H=0,DPR=Math.min(window.devicePixelRatio||1,2);
function resize(){W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+'px';cv.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);if(scene==='map')layoutMapNodes();}
addEventListener('resize',resize);

/* ---------- CrazyGames SDK (optional — game runs fine without it) ---------- */
let CG=null,cgReady=null;
cgReady=(async()=>{
  try{
    if(window.CrazyGames&&window.CrazyGames.SDK){
      await CrazyGames.SDK.init();CG=CrazyGames.SDK;
      try{CG.game.loadingStart();}catch(e){}
    }
  }catch(e){CG=null;}
})();
function cgGameplayStart(){try{CG&&CG.game.gameplayStart();}catch(e){}}
function cgGameplayStop(){try{CG&&CG.game.gameplayStop();}catch(e){}}
function cgHappy(){try{CG&&CG.game.happytime();}catch(e){}}
function cgLoadingDone(){try{CG&&CG.game.loadingStop();}catch(e){}}

/* ---------- sprites ---------- */
const ASSET_NAMES=['duck_up','duck_down','gold_up','gold_down','stork_up','stork_down','hawk_up','hawk_down','dog'];
const IMG={};
ASSET_NAMES.forEach(a=>{const im=new Image();im.src=(window.INLINE_ASSETS&&window.INLINE_ASSETS[a])||('assets/'+a+'.svg');IMG[a]=im;});
function drawSprite(c,key,x,y,w,flip,rot){
  const im=IMG[key];if(!im||!im.naturalWidth)return;
  const h=w*im.naturalHeight/im.naturalWidth;
  c.save();c.translate(x,y);if(rot)c.rotate(rot);if(flip)c.scale(-1,1);
  c.drawImage(im,-w/2,-h/2,w,h);c.restore();
}

/* ---------- levels (12) ---------- */
const LEVELS=[
 {name:'Quiet Lake',    bg:'bg1',  target:10, time:30, speed:1.00, spawn:1.50, storkP:0,   hawkP:0},
 {name:'Sandy Shore',   bg:'bg2',  target:13, time:33, speed:1.15, spawn:1.40, storkP:.10, hawkP:0},
 {name:'Forest Pond',   bg:'bg3',  target:16, time:36, speed:1.30, spawn:1.30, storkP:.13, hawkP:.04},
 {name:'Twilight Swamp',bg:'bg4',  target:19, time:39, speed:1.45, spawn:1.20, storkP:.15, hawkP:.06},
 {name:'Moonlit Marsh', bg:'bg5',  target:22, time:42, speed:1.60, spawn:1.15, storkP:.17, hawkP:.08},
 {name:'Golden Valley', bg:'bg6',  target:25, time:45, speed:1.75, spawn:1.10, storkP:.17, hawkP:.09},
 {name:'River Crossing',bg:'bg7',  target:28, time:48, speed:1.90, spawn:1.05, storkP:.18, hawkP:.10},
 {name:'Amber Marsh',   bg:'bg8',  target:31, time:52, speed:2.05, spawn:1.00, storkP:.19, hawkP:.11},
 {name:'Burning Sky',   bg:'bg9',  target:35, time:56, speed:2.20, spawn:1.00, storkP:.19, hawkP:.12},
 {name:'Bone Desert',   bg:'bg10', target:39, time:60, speed:2.35, spawn:0.95, storkP:.20, hawkP:.13},
 {name:'Dune Oasis',    bg:'bg11', target:43, time:65, speed:2.50, spawn:0.95, storkP:.21, hawkP:.14},
 {name:'Desert Night',  bg:'bg12', target:48, time:72, speed:2.65, spawn:0.90, storkP:.21, hawkP:.15},
];
const N_LVL=LEVELS.length,DOG_TOTAL=5;

/* ---------- background & map images ---------- */
const BG={};let bgLoaded=0;const BG_TOTAL=N_LVL+1;
function loadBg(key,src){const im=new Image();im.onload=im.onerror=()=>{bgLoaded++;if(bgLoaded>=BG_TOTAL)cgLoadingDone();};im.src=src;BG[key]=im;}
LEVELS.forEach(L=>loadBg(L.bg,'assets/'+L.bg+'.jpg'));
loadBg('map','assets/map.jpg');
/* draw an image with CSS "cover" fit; returns the placement rect */
function coverRect(im){
  const s=Math.max(W/im.naturalWidth,H/im.naturalHeight);
  const dw=im.naturalWidth*s,dh=im.naturalHeight*s;
  return{dx:(W-dw)/2,dy:(H-dh)/2,dw,dh};
}
function drawCover(c,im,fallback){
  if(!im||!im.naturalWidth){c.fillStyle=fallback||'#0d1b2a';c.fillRect(0,0,W,H);return;}
  const r=coverRect(im);c.drawImage(im,r.dx,r.dy,r.dw,r.dh);
}

/* ---------- save (localStorage + CrazyGames data when available) ---------- */
const SAVE_KEY='std_save_v2';
let save={unlocked:0,best:Array(N_LVL).fill(0),coins:0,whistle:0,bomb:0,dog:false};
function storageGet(k){try{if(CG&&CG.data)return CG.data.getItem(k);}catch(e){}try{return localStorage.getItem(k);}catch(e){return null;}}
function storageSet(k,v){try{if(CG&&CG.data)CG.data.setItem(k,v);}catch(e){}try{localStorage.setItem(k,v);}catch(e){}}
function loadSave(){
  const raw=storageGet(SAVE_KEY);
  if(!raw)return;
  try{
    const s=JSON.parse(raw);
    if(s&&typeof s==='object'){
      save.unlocked=Math.min(N_LVL-1,s.unlocked|0);
      save.coins=Math.max(0,s.coins|0);save.whistle=s.whistle|0;save.bomb=s.bomb|0;save.dog=!!s.dog;
      const b=Array.isArray(s.best)?s.best:[];
      save.best=Array(N_LVL).fill(0).map((_,i)=>b[i]|0);
    }
  }catch(e){}
}
function persist(){storageSet(SAVE_KEY,JSON.stringify(save));}
loadSave();
cgReady&&cgReady.then(()=>{loadSave();refreshHud();});

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
const rnd=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));if(id)$(id).classList.add('show');}
function hud(on){['hud','topbar','powerBtns'].forEach(i=>$(i).classList.toggle('show',on));}
let toastT=null;
function toast(msg,ms=1400){const t=$('toast');t.textContent=msg;t.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',ms);}

/* ---------- audio (tiny synth) ---------- */
let AC=null;
function audio(){if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();return AC;}
function sShot(){try{const a=audio(),t=a.currentTime,b=a.createBuffer(1,a.sampleRate*.12,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.2);const s=a.createBufferSource(),g=a.createGain();s.buffer=b;g.gain.setValueAtTime(.5,t);s.connect(g).connect(a.destination);s.start();}catch(e){}}
function tone(f,dur,type='square',vol=.18){try{const a=audio(),t=a.currentTime,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(a.destination);o.start(t);o.stop(t+dur);}catch(e){}}
const sQuack=()=>{tone(330,.09);setTimeout(()=>tone(262,.12),80);};
const sCoin=()=>{tone(880,.07,'sine',.2);setTimeout(()=>tone(1320,.12,'sine',.2),60);};
const sBad=()=>{tone(160,.3,'sawtooth',.25);};
const sHawk=()=>{tone(1100,.2,'sawtooth',.12);setTimeout(()=>tone(900,.2,'sawtooth',.12),120);};

/* ---------- game state ---------- */
let scene='menu',birds=[],parts=[],level=0,shot=0,escaped=0,penalties=0,timeLeft=0,coinsRun=0,
    lastT=0,spawnT=0,playing=false,pointer={x:-99,y:-99},flash=0,dogSaves=0,
    dog={active:false,t:0,x:0};

function startLevel(i){
  level=i;const L=LEVELS[i];
  birds=[];parts=[];shot=0;escaped=0;penalties=0;coinsRun=0;timeLeft=L.time;spawnT=0;
  dogSaves=save.dog?DOG_TOTAL:0;dog.active=false;
  scene='game';playing=true;show(null);hud(true);
  cv.style.cursor='crosshair';
  $('hLevelName').textContent=(i+1)+' · '+L.name;
  cgGameplayStart();
  refreshHud();toast(L.name+' — shoot '+L.target+' ducks!',1600);
}
function refreshHud(){
  if(!LEVELS[level])return;
  $('hDucks').textContent=shot+'/'+LEVELS[level].target;
  $('hTime').textContent=Math.ceil(timeLeft);
  $('hCoins').textContent=save.coins+coinsRun;
  $('cWhistle').textContent=save.whistle;$('cBomb').textContent=save.bomb;
  $('hDog').textContent=save.dog?('Rex ×'+dogSaves):'–';
}

/* ---------- spawning ---------- */
function spawnBird(kind){
  const L=LEVELS[level],fromLeft=Math.random()<.5,skyH=H*.55;
  const speed=(kind==='gold'?rnd(3.2,4):rnd(1.4,2.4))*L.speed;
  const b={kind:kind||'duck',x:fromLeft?-80:W+80,y:rnd(50,skyH),
    vx:(fromLeft?1:-1)*speed,vy:0,wob:rnd(0,6),size:kind==='gold'?15:(kind==='stork'?22:19),
    flap:rnd(0,6),dead:false,life:0};
  if(kind==='hawk'){b.x=rnd(W*.2,W*.8);b.y=-60;b.vx=rnd(-0.6,0.6);b.vy=1.1*L.speed;b.size=20;sHawk();toast('⚠️ Hawk attacking!',1100);}
  birds.push(b);
}
function spawnLogic(dt){
  const L=LEVELS[level];spawnT-=dt;
  if(spawnT<=0){
    spawnT=rnd(.55,1.25)*(L.spawn||1)/L.speed;
    const r=Math.random();
    if(r<L.hawkP)spawnBird('hawk');
    else if(r<L.hawkP+L.storkP)spawnBird('stork');
    else if(r<L.hawkP+L.storkP+.1)spawnBird('gold');
    else spawnBird('duck');
  }
}

/* ---------- particles ---------- */
function burst(x,y,color,n=10){for(let i=0;i<n;i++)parts.push({x,y,vx:rnd(-3,3),vy:rnd(-4,1),life:rnd(.3,.7),color});}
function floatText(x,y,txt,color){parts.push({x,y,vx:0,vy:-1.2,life:1,txt,color});}

/* ---------- shooting ---------- */
function shoot(x,y){
  if(!playing||paused)return;sShot();flash=.08;
  for(let i=birds.length-1;i>=0;i--){
    const b=birds[i];if(b.dead)continue;
    const r=b.size*2;
    if((x-b.x)**2+(y-b.y)**2<r*r){
      if(b.kind==='stork'){
        penalties++;coinsRun-=250;sBad();burst(b.x,b.y,'#fff',8);
        floatText(b.x,b.y,'-250 protected!','#FF6B6B');
        b.dead=true;b.vy=-2;
      }else if(b.kind==='hawk'){
        coinsRun+=150;sCoin();burst(b.x,b.y,'#caa66a',12);floatText(b.x,b.y,'+150','#F2C14E');
        b.dead=true;b.vy=2;
      }else{
        const val=b.kind==='gold'?100:30;coinsRun+=val;sQuack();sCoin();
        burst(b.x,b.y,'#caa66a',10);floatText(b.x,b.y,'+'+val,'#F2C14E');
        b.dead=true;b.vy=2;shot++;checkWin();
      }
      refreshHud();return;
    }
  }
}
function checkWin(){refreshHud();if(shot>=LEVELS[level].target)endLevel(true);}

/* ---------- power-ups ---------- */
$('pbWhistle').onclick=e=>{e.stopPropagation();if(!playing||save.whistle<1)return toast('No whistles — visit the shop!');save.whistle--;persist();tone(1500,.3,'sine',.25);for(let i=0;i<5;i++)setTimeout(()=>spawnBird('duck'),i*150);toast('🎺 Here they come!');refreshHud();};
$('pbBomb').onclick=e=>{e.stopPropagation();if(!playing||save.bomb<1)return toast('No bombs — visit the shop!');save.bomb--;persist();flash=.25;tone(70,.5,'sawtooth',.4);
  birds.forEach(b=>{if(!b.dead&&(b.kind==='duck'||b.kind==='gold')){b.dead=true;b.vy=2;coinsRun+=b.kind==='gold'?100:30;burst(b.x,b.y,'#f5a623',8);shot++;}});
  toast('💣 BOOM!');checkWin();};

/* ---------- pause menu (in-game ☰) ---------- */
let paused=false,infoReturn='menu';
function openPause(){
  if(!playing)return;
  paused=true;hud(false);cgGameplayStop();
  $('pauseTitle').textContent=(level+1)+' · '+LEVELS[level].name;
  $('pDucks').textContent=shot+'/'+LEVELS[level].target;
  $('pCoins').textContent=coinsRun;
  show('pauseScr');
}
$('bPause').onclick=e=>{e.stopPropagation();openPause();};
$('bResume').onclick=()=>{paused=false;show(null);hud(true);cgGameplayStart();};
$('bPauseMap').onclick=()=>{paused=false;playing=false;cv.style.cursor='default';buildMap();};
$('bPauseScore').onclick=()=>{infoReturn='pause';showScores();};

/* ---------- level end ---------- */
function endLevel(won){
  playing=false;hud(false);cv.style.cursor='default';
  cgGameplayStop();if(won)cgHappy();
  const L=LEVELS[level],tUsed=Math.round(L.time-timeLeft);
  let b1=0,b2=0;
  if(won){b1=shot*30;b2=Math.max(0,Math.round(timeLeft)*10);
    if(level===save.unlocked&&save.unlocked<N_LVL-1)save.unlocked++;
    save.best[level]=Math.max(save.best[level],b1+b2+coinsRun);}
  const total=Math.max(0,coinsRun+b1+b2);save.coins+=total;
  persist();
  $('endTitle').textContent=won?'Congratulations!':"Time's up!";
  $('eDucks').textContent=shot;$('eTime').textContent=won?tUsed:L.time;
  $('eEsc').textContent=escaped;
  $('eDogLine').style.display=save.dog?'flex':'none';$('eDog').textContent=DOG_TOTAL-dogSaves;
  $('ePenLine').style.display=penalties?'flex':'none';$('ePen').textContent=penalties;
  $('eB1').textContent=b1;$('eB2').textContent=b2;$('eCoins').textContent=total;
  $('bNext').style.display=won?'':'none';
  $('bNext').textContent=(level<N_LVL-1?'Continue':'Finish');
  $('bRetry').style.display=won?'none':'';
  $('bRetry').classList.toggle('primary',!won);
  show('endScr');
}
$('bEndMap').onclick=()=>buildMap();
$('bShop').onclick=()=>openShop('endScr');
$('bRetry').onclick=()=>startLevel(level);
$('bNext').onclick=()=>{
  if(level<N_LVL-1)startLevel(level+1);
  else buildMap();
};

/* ---------- rewarded ads ---------- */
const AD_UNLOCK=3;      // ad offer appears once level 4 is unlocked (finish level 3)
const AD_REWARD=500;
let adBusy=false;
function adAvailable(){return save.unlocked>=AD_UNLOCK;}
$('bAd').onclick=()=>{
  if(adBusy)return;
  if(!CG||!CG.ad){toast('Ads are only available on CrazyGames');return;}
  adBusy=true;
  try{
    CG.ad.requestAd('rewarded',{
      adStarted:()=>{try{AC&&AC.suspend();}catch(e){}},
      adFinished:()=>{adBusy=false;try{AC&&AC.resume();}catch(e){}
        save.coins+=AD_REWARD;persist();refreshShop();sCoin();toast('🪙 +'+AD_REWARD+' coins!');},
      adError:()=>{adBusy=false;try{AC&&AC.resume();}catch(e){}toast('No ad available right now');},
    });
  }catch(e){adBusy=false;toast('No ad available right now');}
};

/* ---------- shop ---------- */
let shopReturn='mapScr';
function openShop(ret){shopReturn=ret;refreshShop();
  if(ret==='mapScr')$('shopScr').classList.add('show');   // overlay: map + nodes stay visible
  else show('shopScr');}
function refreshShop(){
  $('sCoins').textContent=save.coins;
  $('oWhistle').textContent=save.whistle;$('oBomb').textContent=save.bomb;
  $('oDog').textContent=save.dog?'✔ Rex is yours!':'';
  $('buyDogBtn').style.display=save.dog?'none':'';
  $('adRow').style.display=adAvailable()?'flex':'none';
}
document.querySelectorAll('[data-buy]').forEach(btn=>btn.onclick=()=>{
  const k=btn.dataset.buy,price={whistle:1000,bomb:2000,dog:5000}[k];
  if(save.coins<price){sBad();toast('Not enough coins!');return;}
  save.coins-=price;
  if(k==='whistle')save.whistle++;else if(k==='bomb')save.bomb++;else save.dog=true;
  persist();sCoin();refreshShop();
  if(scene==='map')$('mapCoinVal').textContent=save.coins;
});
$('bShopBack').onclick=()=>{if(shopReturn==='endScr')show('endScr');else{$('shopScr').classList.remove('show');if(scene!=='map')buildMap();else $('mapCoinVal').textContent=save.coins;}};

/* ---------- map ---------- */
/* Node positions in MAP-IMAGE space (0..1 of the painted map), placed on the medallions.
   Campaign path: lake (bottom-left) → swamp (bottom-right) → forest & river → desert canyon (top-left). */
const MAP_NODES=[
  {x:.300,y:.760}, // 1  Quiet Lake
  {x:.425,y:.600}, // 2  Sandy Shore
  {x:.700,y:.720}, // 3  Forest Pond
  {x:.860,y:.770}, // 4  Twilight Swamp
  {x:.925,y:.900}, // 5  Moonlit Marsh
  {x:.815,y:.375}, // 6  Golden Valley
  {x:.655,y:.420}, // 7  River Crossing
  {x:.600,y:.280}, // 8  Amber Marsh
  {x:.455,y:.460}, // 9  Burning Sky
  {x:.375,y:.310}, // 10 Bone Desert
  {x:.165,y:.330}, // 11 Dune Oasis
  {x:.115,y:.440}, // 12 Desert Night
];
function layoutMapNodes(){
  const im=BG.map;if(!im||!im.naturalWidth)return;
  const r=coverRect(im);
  document.querySelectorAll('.lvlnode').forEach((n,i)=>{
    const p=MAP_NODES[i];if(!p)return;
    let x=r.dx+p.x*r.dw,y=r.dy+p.y*r.dh;
    x=Math.max(W*.045,Math.min(W*.955,x));      // keep nodes tappable even when the
    y=Math.max(H*.08,Math.min(H*.92,y));        // cover-crop cuts the map edges
    n.style.left=x+'px';n.style.top=y+'px';
  });
}
function buildMap(){
  scene='map';show('mapScr');hud(false);cv.style.cursor='default';
  $('mapCoinVal').textContent=save.coins;
  const holder=$('nodes');holder.innerHTML='';
  LEVELS.forEach((L,i)=>{
    const n=document.createElement('div');n.className='lvlnode';
    n.textContent=i+1;
    if(i>save.unlocked)n.classList.add('locked');
    if(save.best[i]>0)n.classList.add('done');
    const nm=document.createElement('div');nm.className='lvlname';nm.textContent=L.name;n.appendChild(nm);
    n.onclick=()=>{if(i<=save.unlocked)startLevel(i);else toast('🔒 Finish the previous hunt first!');};
    holder.appendChild(n);
  });
  layoutMapNodes();
}

/* ---------- menu actions ---------- */
$('bStart').onclick=()=>{audio();buildMap();};
$('bContinue').onclick=()=>{audio();if(save.unlocked>0||save.coins>0)startLevel(save.unlocked);else buildMap();};
function showScores(){
  $('infoBox').innerHTML='<b style="font-size:20px;color:var(--gold);">Best scores</b>'
   +'<div style="text-align:left;margin-top:10px;font-size:15px;">'
   +LEVELS.map((L,i)=>'<div class="statline" style="margin:6px 0;"><span>'+(i+1)+'. '+L.name+'</span><b>'+(save.best[i]||'—')+'</b></div>').join('')
   +'<div class="statline total"><span>🪙 Coins</span><b class="num-gold">'+save.coins+'</b></div></div>';
  show('infoScr');
}
$('bScore').onclick=()=>{infoReturn='menu';showScores();};
$('bCredits').onclick=()=>{$('infoBox').innerHTML='<b style="font-size:20px;color:var(--gold);">Shoot the Ducks</b><br><br>Original Android game (2010)<br>by <b>Riana</b><br><br>Remastered 2026<br><br><i>No real ducks were harmed.<br>Please don\'t shoot the storks.</i>';show('infoScr');};
$('bInfoBack').onclick=()=>{if(infoReturn==='pause'&&playing)show('pauseScr');else show('menuScr');infoReturn='menu';};
$('backFromMap').onclick=()=>{scene='menu';show('menuScr');};
$('mapShopBtn').onclick=()=>openShop('mapScr');

/* ---------- input ---------- */
function pt(e){const t=e.touches?e.touches[0]:e;return{x:t.clientX,y:t.clientY};}
cv.addEventListener('mousemove',e=>{pointer=pt(e);});
cv.addEventListener('mousedown',e=>{pointer=pt(e);shoot(pointer.x,pointer.y);});
cv.addEventListener('touchstart',e=>{e.preventDefault();pointer=pt(e);shoot(pointer.x,pointer.y);},{passive:false});
cv.addEventListener('touchmove',e=>{e.preventDefault();pointer=pt(e);},{passive:false});

/* ---------- main loop ---------- */
function frameKey(b){return (b.kind==='gold'?'gold':b.kind==='stork'?'stork':b.kind==='hawk'?'hawk':'duck')+'_'+(Math.sin(b.flap)>0?'up':'down');}
function birdW(b){return b.kind==='stork'?b.size*5.2:b.kind==='hawk'?b.size*4.6:b.size*4.8;}
let lastErr=0;
function loop(t){
  requestAnimationFrame(loop);
  try{loopBody(t);}catch(e){if(t-lastErr>2000){lastErr=t;console.error('frame error:',e);}}
}
function loopBody(t){
  const dt=Math.min(.05,(t-lastT)/1000)||.016;lastT=t;
  ctx.clearRect(0,0,W,H);
  if(scene==='menu'||scene==='map'){
    if(scene==='menu'){
      drawCover(ctx,BG.bg1,'#BFE3EA');
      ctx.fillStyle='rgba(10,24,20,.28)';ctx.fillRect(0,0,W,H); // slight dim so the title pops
      const dx=((t*.06)%(W+260))-130;
      drawSprite(ctx,'duck_'+(Math.sin(t*.012)>0?'up':'down'),dx,H*.1,86,false,0);
      if(bgLoaded<BG_TOTAL){ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='600 13px system-ui';ctx.textAlign='center';
        ctx.fillText('Loading art… '+Math.round(bgLoaded/BG_TOTAL*100)+'%',W/2,H-14);ctx.textAlign='left';}
    }else{
      drawCover(ctx,BG.map,'#274A2E');
    }
    return;
  }
  // ===== gameplay =====
  drawCover(ctx,BG[LEVELS[level].bg],'#183048');
  const upd=playing&&!paused;
  if(upd){
    timeLeft-=dt;if(timeLeft<=0){timeLeft=0;endLevel(false);}
    spawnLogic(dt);
    if(Math.ceil(timeLeft)!==+($('hTime').textContent))$('hTime').textContent=Math.ceil(timeLeft);
  }
  for(let i=birds.length-1;i>=0;i--){
    const b=birds[i];
    if(!upd){const rot0=b.dead?Math.PI:(b.kind==='hawk'?b.vx*.25:0);
      drawSprite(ctx,frameKey(b),b.x,b.y,birdW(b),!b.dead&&b.kind!=='hawk'&&b.vx<0,rot0);continue;}
    b.flap+=dt*14;b.life+=dt;
    if(b.dead){b.vy+=dt*9;b.y+=b.vy*60*dt;if(b.y>H+100||b.y<-140){birds.splice(i,1);continue;}}
    else{
      b.x+=b.vx*60*dt;b.wob+=dt*3;b.y+=Math.sin(b.wob)*.5+(b.vy*60*dt);
      if(b.kind==='hawk'){
        if(b.y>H*.8){
          birds.splice(i,1);flash=.3;sBad();timeLeft=Math.max(0,timeLeft-5);
          toast('🦅 Hawk attack! −5 seconds',1500);refreshHud();continue;
        }
      }else if(b.x<-100||b.x>W+100){
        birds.splice(i,1);
        if(b.kind==='duck'||b.kind==='gold'){
          if(save.dog&&dogSaves>0&&!dog.active){
            dogSaves--;dog.active=true;dog.t=0;dog.x=b.vx>0?W*.8:W*.2;
            shot++;coinsRun+=30;floatText(dog.x,H-140,'Rex got it! +30','#4ADE80');tone(600,.15,'sine',.2);
            checkWin();
          }else{escaped++;}
          refreshHud();
        }
        continue;
      }
    }
    const rot=b.dead?Math.PI:(b.kind==='hawk'?b.vx*.25:0);
    drawSprite(ctx,frameKey(b),b.x,b.y,birdW(b),!b.dead&&b.kind!=='hawk'&&b.vx<0,rot);
  }
  if(dog.active){if(upd)dog.t+=dt*1.35;if(dog.t>=1)dog.active=false;
    else drawSprite(ctx,'dog',dog.x,H+60-Math.sin(dog.t*Math.PI)*140,120,false,0);}
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;p.x+=p.vx;p.y+=p.vy;if(p.vy<4&&!p.txt)p.vy+=dt*6;
    if(p.life<=0){parts.splice(i,1);continue;}
    if(p.txt){ctx.font='800 18px system-ui';ctx.fillStyle=p.color;ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillText(p.txt,p.x-20,p.y);ctx.globalAlpha=1;}
    else{ctx.fillStyle=p.color;ctx.globalAlpha=Math.min(1,p.life*3);ctx.fillRect(p.x,p.y,4,4);ctx.globalAlpha=1;}}
  if(flash>0){ctx.fillStyle='rgba(255,240,200,'+flash*2+')';ctx.fillRect(0,0,W,H);flash-=dt;}
  if(pointer.x>=0&&playing&&!paused){
    const x=pointer.x,y=pointer.y;
    ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(x,y,17,0,TAU);ctx.stroke();
    ctx.strokeStyle='#F2742B';ctx.lineWidth=2.4;
    ctx.beginPath();ctx.moveTo(x-26,y);ctx.lineTo(x-11,y);ctx.moveTo(x+11,y);ctx.lineTo(x+26,y);
    ctx.moveTo(x,y-26);ctx.lineTo(x,y-11);ctx.moveTo(x,y+11);ctx.lineTo(x,y+26);ctx.stroke();
    ctx.fillStyle='#F2742B';ctx.beginPath();ctx.arc(x,y,2.6,0,TAU);ctx.fill();
  }
}
resize();
requestAnimationFrame(loop);

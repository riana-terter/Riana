"use strict";
/* ============================================================
   CIEL CLAIR — main game.
   Depends on: sdk.js (CG), i18n.js (T), levels.js (LEVELS,
   AD_AFTER_LEVELS, TEST_LEVEL_SECONDS)
   ============================================================ */

let lang = "en", lastRank = "";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- audio ---------- */
let actx = null, soundOn = true;
function audio(){ if(!actx){ try{ actx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return actx; }
function beep(freq,dur,type,vol,slide){
  if(!soundOn) return; const a = audio(); if(!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type||"square"; o.frequency.setValueAtTime(freq, a.currentTime);
  if(slide) o.frequency.exponentialRampToValueAtTime(slide, a.currentTime+dur);
  g.gain.setValueAtTime(vol||.05, a.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001, a.currentTime+dur);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime+dur);
}
const sfx = {
  fire:()=>beep(920,.07,"square",.04,500),
  hit:()=>{beep(180,.18,"sawtooth",.07,50);beep(620,.1,"square",.03,200);},
  ff:()=>beep(140,.4,"sawtooth",.09,90),
  alarm:()=>{beep(330,.16,"square",.07);setTimeout(()=>beep(262,.22,"square",.07),140);},
  hunter:()=>beep(500,.5,"sawtooth",.05,120),
  lvl:()=>{beep(523,.12,"triangle",.06,659);setTimeout(()=>beep(659,.14,"triangle",.06,784),130);},
  win:()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.18,"triangle",.06),i*150));}
};
document.addEventListener("touchend", () => {
  if (actx && actx.state === "suspended") actx.resume();
});

/* ---------- ambient bed: wind + radar pings, intensity per level ---------- */
const amb=(()=> {
  let src=null,filt=null,gain=null,lfo=null,lfoG=null,pingT=null;
  let level=0,active=false;
  function ensure(){
    const a=audio(); if(!a||src)return;
    const len=a.sampleRate*2, buf=a.createBuffer(1,len,a.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    src=a.createBufferSource();src.buffer=buf;src.loop=true;
    filt=a.createBiquadFilter();filt.type="lowpass";filt.frequency.value=320;
    gain=a.createGain();gain.gain.value=0;
    lfo=a.createOscillator();lfo.frequency.value=.07;
    lfoG=a.createGain();lfoG.gain.value=110;
    lfo.connect(lfoG);lfoG.connect(filt.frequency);
    src.connect(filt);filt.connect(gain);gain.connect(a.destination);
    src.start();lfo.start();
  }
  function vol(){ return (active&&soundOn)?(.016+level*.0014):0; }
  function refresh(){
    const a=audio(); if(!a||!gain)return;
    gain.gain.setTargetAtTime(vol(),a.currentTime,.5);
    if(filt)filt.frequency.setTargetAtTime(300+level*28,a.currentTime,.8);
  }
  function ping(){
    if(active&&soundOn&&state===ST.PLAY&&!paused)
      beep(1150,.09,"sine",.018,880);
  }
  return {
    start(l){ level=l;active=true;ensure();refresh();
      clearInterval(pingT);
      pingT=setInterval(ping,Math.max(2400,4400-l*140)); },
    stop(){ active=false;refresh();clearInterval(pingT);pingT=null; },
    refresh
  };
})();

/* ---------- save (last score, best score, unlocked levels) ---------- */
const SAVE_KEY="cielclair_save_v1";
let save={unlocked:1,last:null,best:null,lv:{}};
function loadSave(){
  try{
    const s=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(s&&typeof s.unlocked==="number")save=s;
  }catch(e){}
  save.unlocked=Math.min(Math.max(save.unlocked,1),LEVELS.length);
  if(!save.lv||typeof save.lv!=="object")save.lv={};
}
function persistSave(){
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}
}
function fmtScore(rec){
  if(!rec)return "—";
  const t=T[lang];
  return rec.score+(rec.rank!=null?" · "+t.ranks[rec.rank]:"");
}
/* which score rows are expanded */
const scOpen={last:false,best:false};
function detailHTML(rec){
  const t=T[lang];
  if(!rec)return '<div class="scdetail-empty">'+t.noRun+'</div>';
  const cell=(lab,val)=>'<div class="stat"><div class="lab">'+lab+'</div><div class="val">'+val+'</div></div>';
  return '<div class="stats">'+
    cell(t.iDronesL,rec.drones!=null?rec.drones:"—")+
    cell(t.iMissilesL,rec.missiles!=null?rec.missiles:"—")+
    cell(t.sAccL,rec.acc!=null?rec.acc+"%":"—")+
    cell(t.sFFL,rec.ff!=null?rec.ff:"—")+
    cell(t.lastLevelL,rec.lvl!=null?rec.lvl+"/"+LEVELS.length:"—")+
  '</div>';
}
function updateScoreboard(){
  document.getElementById("lastV").textContent=fmtScore(save.last);
  document.getElementById("bestV").textContent=fmtScore(save.best);
  for(const k of ["last","best"]){
    const rec=save[k];
    const tog=document.getElementById(k+"Tog");
    const det=document.getElementById(k+"Det");
    if(!tog||!det)continue;
    tog.textContent=scOpen[k]?"−":"+";
    tog.disabled=!rec;
    det.classList.toggle("hidden",!scOpen[k]);
    if(scOpen[k])det.innerHTML=detailHTML(rec);
  }
}

/* ---------- i18n ---------- */
function setT(id,v){document.getElementById(id).textContent=v;}
function setH(id,v){document.getElementById(id).innerHTML=v;}
function applyLang(){
  const t=T[lang];
  document.documentElement.lang=lang;
  setH("hTitle",t.gameTitleHtml);setH("mhTitle",t.gameTitleHtml);
  setT("fLeft",t.gameName+" · Riana G.");
  setT("hSub",t.hSub);setT("lScore",t.lScore);setT("lLevel",t.lLevel);setT("lTime",t.lTime);setT("lCombo",t.lCombo);setT("lCity",t.lCity);
  setT("howtoBtn",t.howto);setT("aboutBtn",t.about);
  setT("scoreBtn",t.scoreW);setT("scStamp",t.scStamp);setT("scTitle",t.scTitle);
  setT("copyScoreBtn",t.copyRes);setT("scShare",t.wShare);
  setT("lastL",t.lastL);setT("bestL",t.bestL);
  setT("iStamp",t.iStamp);setT("nextBtn",t.next);setT("interMenuBtn",t.toMenu);
  setT("fStamp",t.fStamp);setT("fTitle",t.fTitle);setT("retryBtn",t.retry);setT("failMapBtn",t.toMenu);setT("contBtn",t.contAd);
  setT("wStamp",t.wStamp);setT("wTitle",t.wTitle);setT("wRankLab",t.wRankLab);
  setT("sScoreL",t.sScoreL);setT("sKillL",t.sKillL);setT("sDronesL",t.iDronesL);setT("sMissilesL",t.iMissilesL);setT("sAccL",t.sAccL);setT("sFFL",t.sFFL);
  setT("againBtn",t.again);setT("copyResBtn",t.copyRes);setT("wShare",t.wShare);
  setT("aStamp",t.aStamp);setT("aTitle",t.aTitle);
  setH("a1",t.a1);setH("a2",t.a2);
  setH("a3",t.a3.replace("{levels}",LEVELS.length));
  setH("a4",t.a4);setH("a5",t.a5);setH("a6",t.a6);
  setT("abStamp",t.abStamp);setT("abTitle",t.abTitle);setT("abText",t.abText);setT("abDisclaimer",t.abDisclaimer);setT("abWho",t.abWho);
  setT("pStamp",t.pStamp);setT("pTitle",t.pTitle);setT("resumeBtn",t.resume);setT("quitBtn",t.quit);
  setT("menuBtn",t.menuLbl);
  setT("fRight",t.fRight);setT("loadTxt",t.loading);
  document.getElementById("muteBtn").textContent=soundOn?t.sndOn:t.sndOff;
  document.getElementById("frBtn").classList.toggle("on",lang==="fr");
  document.getElementById("enBtn").classList.toggle("on",lang==="en");
  updateScoreboard();
  buildLevelList();
  renderPane();
}
document.getElementById("frBtn").addEventListener("click",()=>{lang="fr";applyLang();});
document.getElementById("enBtn").addEventListener("click",()=>{lang="en";applyLang();});
document.getElementById("muteBtn").addEventListener("click",()=>{
  soundOn=!soundOn;
  document.getElementById("muteBtn").textContent=soundOn?T[lang].sndOn:T[lang].sndOff;
  amb.refresh();
});

/* ---------- canvas ---------- */
const stage=document.getElementById("stage");
const cv=document.getElementById("cv");
const ctx=cv.getContext("2d");
let W=0,H=0,DPR=1;
function resize(){
  const r=stage.getBoundingClientRect();
  DPR=Math.min(window.devicePixelRatio||1,2);
  W=r.width;H=r.height;
  cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize",resize);
resize();

/* ---------- backgrounds (external files) ---------- */
const bgs=LEVELS.map(l=>{const im=new Image();im.src=l.bg;return im;});

/* ---------- game state ---------- */
const ST={LOAD:-1,MENU:0,PLAY:1,INTER:2,FAIL:3,WIN:4,PAUSE:5};
let state=ST.LOAD,paused=false,autoPaused=false;
let curLevel=0,runStart=0,selLevel=0,curPane="levels";
let hostiles=[],friendlies=[],parts=[],floaters=[];
let score=0,shots=0,hits=0,kills=0,killsD=0,killsM=0,killsH=0,ffCount=0,combo=1,shieldsN=5,levelT=0,elapsedL=0;
let snap={score:0,shots:0,hits:0,kills:0,kD:0,kM:0,kH:0,ff:0};
let spawnT=0,friendT=5,huntT=0,shake=0,flash=0,banner=null,usedContinue=false;
let aim={x:-100,y:-100,show:false};

function groundY(){return H*0.74;}

function updateHUD(){
  document.getElementById("vScore").textContent=score;
  document.getElementById("vLevel").textContent=(curLevel+1)+"/"+LEVELS.length;
  const s=Math.max(Math.ceil(levelT),0);
  document.getElementById("vTime").textContent=Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
  document.getElementById("vCombo").textContent="×"+combo;
  let h="";
  for(let i=0;i<5;i++)h+=`<span class="${i<shieldsN?"on":"off"}">▮</span>`;
  document.getElementById("shields").innerHTML=h;
}

/* ---------- entities ---------- */
function L(){return LEVELS[curLevel];}
function spawnHostile(){
  const ramp=1+(elapsedL/L().dur)*.18;
  if(Math.random()<L().mp){
    const x=W*(.2+Math.random()*.8);
    const tx=W*(.08+Math.random()*.84),ty=groundY();
    const ang=Math.atan2(ty+20,tx-x);
    const sp=(135+Math.random()*40)*L().speed*ramp;
    hostiles.push({k:"m",x:x,y:-20,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,r:16,trail:[]});
  }else{
    const y=H*(.10+Math.random()*.30);
    const sp=(52+Math.random()*22)*L().speed*ramp;
    hostiles.push({k:"d",x:W+24,y:y,baseY:y,vx:-sp,vy:(8+curLevel*1.4)*ramp,r:19,ph:Math.random()*6.28,t:0});
  }
}
function spawnHunter(){
  /* enters from a random edge, dives at the operator (screen centre),
     growing as it closes in; must be destroyed before impact */
  const side=Math.floor(Math.random()*3); /* 0 left, 1 top, 2 right */
  let x,y;
  if(side===0){x=-30;y=H*(.1+Math.random()*.4);}
  else if(side===2){x=W+30;y=H*(.1+Math.random()*.4);}
  else{x=W*(.15+Math.random()*.7);y=-30;}
  const tx=W*(.35+Math.random()*.3),ty=H*(.35+Math.random()*.3);
  const life=Math.max(3.2,4.8-curLevel*.12);
  hostiles.push({k:"h",x:x,y:y,tx:tx,ty:ty,life:life,max:life,r:16,s:.55});
  sfx.hunter();
}
function spawnFriendly(){
  const ltr=Math.random()<.5;
  const y=H*(.07+Math.random()*.16);
  friendlies.push({x:ltr?-60:W+60,y:y,vx:(ltr?1:-1)*(80+Math.random()*30),r:30,dir:ltr?1:-1});
}
function boom(x,y,col,n){
  const cnt=reduceMotion?Math.min(n,6):n;
  for(let i=0;i<cnt;i++){
    const a=Math.random()*6.28,s=40+Math.random()*150;
    parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.5+Math.random()*.4,max:.9,col:col,r:2+Math.random()*3});
  }
}
function floatTxt(x,y,txt,col){floaters.push({x:x,y:y,txt:txt,col:col,life:1});}

/* ---------- update ---------- */
function update(dt){
  elapsedL+=dt;
  levelT-=dt;
  if(levelT<=0){levelDone();return;}

  spawnT-=dt;
  if(spawnT<=0){spawnHostile();spawnT=L().spawn*(.7+Math.random()*.6);}
  friendT-=dt;
  if(friendT<=0){spawnFriendly();friendT=L().fr*(0.8+Math.random()*.5);}
  if(L().hunt){
    huntT-=dt;
    if(huntT<=0){spawnHunter();huntT=L().hunt*(.8+Math.random()*.5);}
  }

  for(const h of hostiles){
    if(h.k==="d"){
      h.t+=dt;h.x+=h.vx*dt;h.baseY+=h.vy*dt;
      h.y=h.baseY+Math.sin(h.t*2.4+h.ph)*16;
    }else if(h.k==="m"){
      h.x+=h.vx*dt;h.y+=h.vy*dt;
      h.trail.push({x:h.x,y:h.y,life:.4});
      if(h.trail.length>14)h.trail.shift();
    }else if(h.k==="h"){
      h.life-=dt;
      const p=1-h.life/h.max;           /* 0 → 1 as it closes in */
      h.x+=(h.tx-h.x)*Math.min(1,dt*1.6);
      h.y+=(h.ty-h.y)*Math.min(1,dt*1.6);
      h.s=.55+p*1.45;                    /* grows toward the screen */
      h.r=19*h.s;
    }
  }
  for(const h of hostiles)for(const tr of(h.trail||[]))tr.life-=dt;

  for(let i=hostiles.length-1;i>=0;i--){
    const h=hostiles[i];
    if(h.k==="h"){
      if(h.life<=0){
        hostiles.splice(i,1);
        shieldsN--;updateHUD();
        boom(h.x,h.y,"#C8372D",30);
        flash=.6;shake=reduceMotion?0:.6;
        floatTxt(h.x,h.y-26,T[lang].hunterHit,"#C8372D");
        sfx.alarm();
        if(shieldsN<=0){levelFail();return;}
      }
      continue;
    }
    if(h.y>groundY()){
      hostiles.splice(i,1);
      shieldsN--;updateHUD();
      boom(h.x,groundY()+8,"#C8372D",26);
      flash=.5;shake=reduceMotion?0:.45;
      floatTxt(h.x,groundY()-26,T[lang].cityHit,"#C8372D");
      sfx.alarm();
      if(shieldsN<=0){levelFail();return;}
    }else if(h.x<-60||h.x>W+90){
      hostiles.splice(i,1);
    }
  }
  for(let i=friendlies.length-1;i>=0;i--){
    const f=friendlies[i];f.x+=f.vx*dt;
    if(f.x<-90||f.x>W+90)friendlies.splice(i,1);
  }
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];p.life-=dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;
    if(p.life<=0)parts.splice(i,1);
  }
  for(let i=floaters.length-1;i>=0;i--){
    const f=floaters[i];f.life-=dt;f.y-=34*dt;
    if(f.life<=0)floaters.splice(i,1);
  }
  if(banner){banner.life-=dt;if(banner.life<=0)banner=null;}
  if(shake>0)shake-=dt;
  if(flash>0)flash-=dt;
  updateHUD();
}

/* ---------- shooting ---------- */
function shoot(x,y){
  if(state!==ST.PLAY||paused)return;
  shots++;sfx.fire();
  parts.push({x:x,y:y,vx:0,vy:0,life:.14,max:.14,col:"#FAEFDD",r:11,ring:true});
  const touch=matchMedia("(hover: none)").matches;
  const assist=touch?24:15;

  for(let i=friendlies.length-1;i>=0;i--){
    const f=friendlies[i];
    if(Math.hypot(f.x-x,f.y-y)<f.r+assist){
      score=Math.max(0,score-300);combo=1;ffCount++;
      boom(f.x,f.y,"#3FBFC4",10);
      floatTxt(f.x,f.y-24,T[lang].ff,"#C8372D");
      flash=.4;sfx.ff();
      friendlies.splice(i,1);
      updateHUD();return;
    }
  }
  let best=-1,bd=1e9;
  for(let i=0;i<hostiles.length;i++){
    const h=hostiles[i];
    const d=Math.hypot(h.x-x,h.y-y);
    if(d<h.r+assist&&d<bd){bd=d;best=i;}
  }
  if(best>=0){
    const h=hostiles[best];
    hostiles.splice(best,1);
    hits++;kills++;
    if(h.k==="m")killsM++;else if(h.k==="h")killsH++;else killsD++;
    const base=h.k==="m"?250:(h.k==="h"?400:100);
    const pts=base*combo;
    score+=pts;
    floatTxt(h.x,h.y-18,"+"+pts,h.k==="d"?"#FAEFDD":"#E8862E");
    boom(h.x,h.y,h.k==="d"?"#5A5248":"#E8862E",h.k==="d"?14:22);
    combo=Math.min(combo+1,4);
    sfx.hit();
  }else{
    combo=1;
  }
  updateHUD();
}

/* ---------- drawing ---------- */
function drawDroneBody(){
  ctx.fillStyle="#332E27";ctx.strokeStyle="#332E27";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(-12,-8);ctx.lineTo(12,8);ctx.moveTo(12,-8);ctx.lineTo(-12,8);ctx.stroke();
  ctx.beginPath();ctx.ellipse(0,0,8,5,0,0,6.28);ctx.fill();
  ctx.fillStyle="#4A443B";
  const spin=performance.now()/40;
  for(const [dx,dy] of [[-12,-8],[12,-8],[-12,8],[12,8]]){
    ctx.save();ctx.translate(dx,dy);ctx.rotate(spin);
    ctx.fillRect(-7,-1.4,14,2.8);ctx.restore();
  }
  ctx.fillStyle=(Math.floor(performance.now()/250)%2)?"#C8372D":"#7A2A22";
  ctx.beginPath();ctx.arc(0,-4,2,0,6.28);ctx.fill();
}
function drawDrone(h){
  ctx.save();ctx.translate(h.x,h.y);
  drawDroneBody();
  ctx.restore();
}
function drawHunter(h){
  ctx.save();ctx.translate(h.x,h.y);ctx.scale(h.s,h.s);
  drawDroneBody();
  ctx.restore();
  /* red lock-on ring that tightens as the hunter closes in */
  const p=1-h.life/h.max;
  const rr=h.r+14-(p*10);
  ctx.strokeStyle=`rgba(200,55,45,${.35+p*.55})`;
  ctx.lineWidth=2+p*1.5;
  ctx.setLineDash([6,5]);
  ctx.beginPath();ctx.arc(h.x,h.y,rr,performance.now()/300,performance.now()/300+6.28);ctx.stroke();
  ctx.setLineDash([]);
}
function drawMissile(h){
  for(const tr of h.trail){
    if(tr.life>0){
      ctx.fillStyle=`rgba(250,239,221,${tr.life*.5})`;
      ctx.beginPath();ctx.arc(tr.x,tr.y,3*tr.life+1,0,6.28);ctx.fill();
    }
  }
  ctx.save();ctx.translate(h.x,h.y);ctx.rotate(Math.atan2(h.vy,h.vx));
  ctx.fillStyle="#332E27";
  ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-4.5);ctx.lineTo(-8,4.5);ctx.closePath();ctx.fill();
  ctx.fillStyle="#C8372D";
  ctx.beginPath();ctx.moveTo(-8,-4.5);ctx.lineTo(-13,-7);ctx.lineTo(-13,7);ctx.lineTo(-8,4.5);ctx.closePath();ctx.fill();
  ctx.fillStyle="#E8862E";
  ctx.beginPath();ctx.moveTo(-13,0);ctx.lineTo(-21-Math.random()*5,0);ctx.lineTo(-13,3);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawAirliner(f){
  ctx.save();ctx.translate(f.x,f.y);ctx.scale(f.dir,1);
  ctx.strokeStyle="rgba(250,250,250,.35)";ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(-26,0);ctx.lineTo(-52,1);ctx.stroke();
  ctx.fillStyle="#F4F2EC";
  ctx.beginPath();ctx.ellipse(0,0,24,5.5,0,0,6.28);ctx.fill();
  ctx.fillStyle="#C9C4B8";
  ctx.beginPath();ctx.ellipse(0,2.2,23,3,0,0,3.14);ctx.fill();
  ctx.fillStyle="#C8372D";
  ctx.beginPath();ctx.moveTo(-17,-2);ctx.lineTo(-25,-13);ctx.lineTo(-20,-13);ctx.lineTo(-13,-3);ctx.closePath();ctx.fill();
  ctx.fillStyle="#D9D5CB";
  ctx.beginPath();ctx.moveTo(3,0);ctx.lineTo(-9,11);ctx.lineTo(-3,12);ctx.lineTo(8,2);ctx.closePath();ctx.fill();
  ctx.fillStyle="#8E887C";
  ctx.beginPath();ctx.ellipse(-1,7,4,2.4,0,0,6.28);ctx.fill();
  ctx.fillStyle="#5A6E7E";
  for(let i=-12;i<=14;i+=4){ctx.beginPath();ctx.arc(i,-1.4,1,0,6.28);ctx.fill();}
  ctx.fillStyle="#3FBFC4";
  ctx.beginPath();ctx.ellipse(20,-1.2,3.2,2,0,0,6.28);ctx.fill();
  ctx.restore();
}
function draw(){
  const now=performance.now();
  const lvl=LEVELS[curLevel];
  const inPlay=state===ST.PLAY&&!paused;
  /* helicopter hover: bob the whole view */
  let bobX=0,bobY=0;
  if(lvl.bob&&inPlay&&!reduceMotion){
    bobX=Math.sin(now*.0009)*10*lvl.bob+Math.sin(now*.0021)*2.5*lvl.bob;
    bobY=Math.sin(now*.0013)*13*lvl.bob+Math.sin(now*.0047)*3*lvl.bob;
  }
  ctx.save();
  if(shake>0){
    const m=shake*7;
    ctx.translate((Math.random()-.5)*m,(Math.random()-.5)*m);
  }
  ctx.translate(bobX,bobY);
  const bg=bgs[curLevel];
  if(bg&&bg.complete&&bg.naturalWidth){
    const motion=(lvl.drift||lvl.bob)?1.18:1;
    const ir=bg.naturalWidth/bg.naturalHeight,cr=W/H;
    let dw,dh;
    if(cr>ir){dw=W*motion;dh=dw/ir;}
    else{dh=H*motion;dw=dh*ir;}
    let dx=(W-dw)/2,dy=(H-dh)/2;
    /* camera drift: slow lateral pan within the overscan */
    if(lvl.drift&&!reduceMotion){
      const panX=Math.max(0,(dw-W)/2-2),panY=Math.max(0,(dh-H)/2-2);
      dx+=Math.sin(now*.0002)*panX*lvl.drift;
      dy+=Math.sin(now*.00013)*panY*lvl.drift*.5;
    }
    ctx.drawImage(bg,dx,dy,dw,dh);
  }else{
    ctx.fillStyle="#9BBFD4";ctx.fillRect(0,0,W,H);
  }
  for(const f of friendlies)drawAirliner(f);
  for(const h of hostiles){
    if(h.k==="d")drawDrone(h);
    else if(h.k==="m")drawMissile(h);
    else drawHunter(h);
  }
  for(const p of parts){
    const a=Math.max(p.life/p.max,0);
    if(p.ring){
      ctx.strokeStyle=`rgba(250,239,221,${a})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r*(1+(1-a)*2),0,6.28);ctx.stroke();
    }else{
      ctx.fillStyle=p.col;ctx.globalAlpha=a;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.fill();
      ctx.globalAlpha=1;
    }
  }
  ctx.textAlign="center";
  for(const f of floaters){
    ctx.font="700 15px 'IBM Plex Mono',monospace";
    ctx.fillStyle=f.col;ctx.globalAlpha=Math.max(f.life,0);
    ctx.fillText(f.txt,f.x,f.y);ctx.globalAlpha=1;
  }
  if(banner){
    ctx.font="700 "+Math.min(34,W*.045)+"px 'Chakra Petch',sans-serif";
    ctx.fillStyle=`rgba(250,239,221,${Math.min(banner.life,1)})`;
    ctx.strokeStyle=`rgba(43,39,34,${Math.min(banner.life,1)})`;ctx.lineWidth=5;
    ctx.strokeText(banner.txt,W/2,H*.4);
    ctx.fillText(banner.txt,W/2,H*.4);
  }
  if(aim.show&&inPlay){
    ctx.strokeStyle="rgba(43,39,34,.9)";ctx.lineWidth=1.6;
    ctx.beginPath();ctx.arc(aim.x,aim.y,13,0,6.28);ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(aim.x-19,aim.y);ctx.lineTo(aim.x-7,aim.y);
    ctx.moveTo(aim.x+7,aim.y);ctx.lineTo(aim.x+19,aim.y);
    ctx.moveTo(aim.x,aim.y-19);ctx.lineTo(aim.x,aim.y-7);
    ctx.moveTo(aim.x,aim.y+7);ctx.lineTo(aim.x,aim.y+19);
    ctx.stroke();
    ctx.fillStyle="rgba(200,55,45,.9)";
    ctx.beginPath();ctx.arc(aim.x,aim.y,1.8,0,6.28);ctx.fill();
  }
  ctx.restore();
  if(flash>0){
    ctx.fillStyle=`rgba(200,55,45,${flash*.3})`;
    ctx.fillRect(0,0,W,H);
  }
}

/* ---------- loop ---------- */
let last=performance.now();
function loop(now){
  const dt=Math.min((now-last)/1000,.05);
  last=now;
  if(state===ST.PLAY&&!paused)update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- input ---------- */
function pos(e){
  const r=cv.getBoundingClientRect();
  return {x:e.clientX-r.left,y:e.clientY-r.top};
}
cv.addEventListener("pointermove",e=>{
  const p=pos(e);aim.x=p.x;aim.y=p.y;aim.show=e.pointerType!=="touch";
});
cv.addEventListener("pointerdown",e=>{
  const p=pos(e);
  if(e.pointerType==="touch")aim.show=false;
  shoot(p.x,p.y);
  e.preventDefault();
},{passive:false});
cv.addEventListener("pointerleave",()=>{aim.show=false;});

/* CrazyGames: prevent the embedding page from scrolling on
   spacebar / arrow keys while the game has focus */
window.addEventListener("keydown",e=>{
  if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))
    e.preventDefault();
  if(e.code==="Escape"){
    if(state===ST.PLAY)openPause();
    else if(state===ST.MENU&&curPane!=="levels"){curPane="levels";renderPane();}
  }
});

/* Auto-pause when the tab/iframe loses visibility */
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){
    if(state===ST.PLAY&&!paused){openPause();autoPaused=true;}
  }
});
window.addEventListener("blur",()=>{
  if(state===ST.PLAY&&!paused){openPause();autoPaused=true;}
});

/* ---------- screens ---------- */
const SCREENS=["loading","menu","pause","inter","fail","win"];
function hideAll(){
  for(const id of SCREENS)
    document.getElementById(id).classList.add("hidden");
}
function showScreen(id){
  hideAll();
  if(id)document.getElementById(id).classList.remove("hidden");
}
function showHud(on){
  document.getElementById("hud").classList.toggle("hidden",!on);
}

/* ---------- menu (single modal: content left, buttons right) ---------- */
function buildLevelList(){
  const t=T[lang];
  const list=document.getElementById("lvllist");
  list.innerHTML="";
  for(let i=0;i<LEVELS.length;i++){
    const isDone=i<save.unlocked-1;
    const locked=i>save.unlocked-1;
    const b=document.createElement("button");
    b.type="button";
    b.className="lvl"+(isDone?" done":"")+(locked?" locked":"")+(i===selLevel?" sel":"");
    b.disabled=locked;
    b.title=locked?t.stLocked:(t.lvlNames[i]+" · "+(isDone?t.stDone:t.stOpen));
    b.innerHTML=
      '<span class="th" style="background-image:url(\''+LEVELS[i].bg+'\')">'+(locked?"🔒":(isDone?"✓":""))+'</span>'+
      '<span class="lb">'+t.levelWord+' '+(i+1)+'</span>'+
      (save.lv[i]?'<span class="stars">'+"★".repeat(save.lv[i].st)+'<span class="dim">'+"★".repeat(3-save.lv[i].st)+'</span></span>':'<span class="stars">&nbsp;</span>');
    if(!locked)b.addEventListener("click",()=>{selLevel=i;curPane="levels";buildLevelList();renderPane();});
    list.appendChild(b);
  }
  /* campaign progress */
  const cleared=save.unlocked-1;
  setT("progTxt",t.progressTpl.replace("{done}",cleared).replace("{total}",LEVELS.length));
  document.getElementById("pFill").style.width=(cleared/LEVELS.length*100)+"%";
}
function renderPane(){
  const t=T[lang];
  document.getElementById("paneLevels").classList.toggle("hidden",curPane!=="levels");
  document.getElementById("paneHowto").classList.toggle("hidden",curPane!=="howto");
  document.getElementById("paneAbout").classList.toggle("hidden",curPane!=="about");
  document.getElementById("paneScore").classList.toggle("hidden",curPane!=="score");
  document.getElementById("howtoBtn").classList.toggle("on",curPane==="howto");
  document.getElementById("aboutBtn").classList.toggle("on",curPane==="about");
  document.getElementById("scoreBtn").classList.toggle("on",curPane==="score");
  setT("playBtn",t.play+" · "+t.levelWord+" "+(selLevel+1));
  if(curPane==="score"){updateScoreboard();document.getElementById("copyScoreBtn").disabled=!save.last;}
  if(curPane==="levels"){
    document.getElementById("mBanner").style.backgroundImage="url('"+LEVELS[selLevel].bg+"')";
    setT("mStamp",t.mStamp+" · "+(selLevel+1)+"/"+LEVELS.length);
    setT("mName",t.lvlNames[selLevel]);
    const th=Math.min(4,1+Math.floor(selLevel/4));   /* threat 1-4 across the campaign */
    setH("mThreat",t.threatL+' <b>'+"▲".repeat(th)+'<span style="opacity:.25">'+"▲".repeat(4-th)+"</span></b>");
    const lb=save.lv[selLevel];
    setH("mLvlBest",lb?(t.lvlBestL+' <b>'+lb.s+' · <span class="starstxt">'+"★".repeat(lb.st)+"</span></b>"):"");
    setT("mText",t.missions[selLevel]);
  }
}
function openMenu(){
  state=ST.MENU;showHud(false);
  selLevel=save.unlocked-1;   /* default: last open level */
  curPane="levels";
  updateScoreboard();
  buildLevelList();
  renderPane();
  showScreen("menu");
}
for(const b of document.querySelectorAll(".closepane"))b.addEventListener("click",()=>{curPane="levels";renderPane();});
for(const k of ["last","best"]){
  document.getElementById(k+"Tog").addEventListener("click",()=>{
    scOpen[k]=!scOpen[k];updateScoreboard();
  });
}
document.getElementById("scoreBtn").addEventListener("click",()=>{curPane=(curPane==="score")?"levels":"score";renderPane();});
document.getElementById("howtoBtn").addEventListener("click",()=>{curPane=(curPane==="howto")?"levels":"howto";renderPane();});
document.getElementById("aboutBtn").addEventListener("click",()=>{curPane=(curPane==="about")?"levels":"about";renderPane();});
document.getElementById("playBtn").addEventListener("click",()=>startRun(selLevel));

/* ---------- run lifecycle ---------- */
function startLevel(i){
  curLevel=i;
  snap={score:score,shots:shots,hits:hits,kills:kills,kD:killsD,kM:killsM,kH:killsH,ff:ffCount};
  hostiles=[];friendlies=[];parts=[];floaters=[];
  shieldsN=5;combo=1;
  levelT=(typeof TEST_LEVEL_SECONDS!=="undefined"&&TEST_LEVEL_SECONDS)?TEST_LEVEL_SECONDS:LEVELS[i].dur;
  elapsedL=0;
  spawnT=.9;friendT=4;huntT=LEVELS[i].hunt?LEVELS[i].hunt*.6:0;
  shake=0;flash=0;usedContinue=false;
  const t=T[lang];
  banner={txt:t.lvlBanner.replace("{n}",i+1).replace("{name}",t.lvlNames[i].toUpperCase()),life:2};
  hideAll();
  showHud(true);
  state=ST.PLAY;paused=false;
  last=performance.now();
  sfx.lvl();
  CG.gameplayStart();
  amb.start(i);
  updateHUD();
}
function startRun(i){
  audio();
  runStart=i;
  score=0;shots=0;hits=0;kills=0;killsD=0;killsM=0;killsH=0;ffCount=0;
  startLevel(i);
}
/* Show a midgame ad (muted + frozen while it plays), then run next() */
function adThen(next){
  const prevSound=soundOn;
  CG.midgameAd({
    pause(){ soundOn=false;amb.refresh(); },
    resume(){ soundOn=prevSound;amb.refresh(); next(); }
  });
}
/* a full record of a run: score, rank and the detail stats */
function makeRec(rankIdx){
  return {
    score:score,rank:rankIdx,
    drones:killsD+killsH,missiles:killsM,
    acc:shots?Math.round(hits/shots*100):0,
    ff:ffCount,
    lvl:curLevel+1
  };
}
function recordRun(rankIdx){
  const rec=makeRec(rankIdx);
  save.last=rec;
  if(!save.best||rec.score>save.best.score)save.best=rec;
  persistSave();
}
function recordLevel(){
  /* per-level best score + stars: 1 cleared, +1 accuracy ≥70%, +1 no civilian hits */
  const ls=score-snap.score,lsh=shots-snap.shots,lh=hits-snap.hits,ffL=ffCount-snap.ff;
  const acc=lsh?Math.round(lh/lsh*100):0;
  const stars=1+(acc>=70?1:0)+(ffL===0?1:0);
  const cur=save.lv[curLevel];
  save.lv[curLevel]={s:Math.max(ls,cur?cur.s:0),st:Math.max(stars,cur?cur.st:0)};
  persistSave();
}
function levelDone(){
  CG.gameplayStop();
  amb.stop();
  recordLevel();
  /* unlock the next level permanently */
  if(save.unlocked<curLevel+2&&curLevel+1<LEVELS.length){
    save.unlocked=curLevel+2;persistSave();
  }
  if(curLevel>=LEVELS.length-1){winGame();return;}
  state=ST.INTER;
  const t=T[lang];
  setT("iTitle",t.iTitleTpl.replace("{n}",curLevel+1));
  setT("iNext",t.iNextTpl.replace("{name}",t.lvlNames[curLevel+1]));
  const dots=document.getElementById("iDots");
  dots.innerHTML="";
  for(let i=0;i<LEVELS.length;i++){
    const d=document.createElement("div");
    d.className="dot"+(i<=curLevel?" done":(i===curLevel+1?" cur":""));
    dots.appendChild(d);
  }
  const ls=score-snap.score,lsh=shots-snap.shots,lh=hits-snap.hits;
  const acc2=lsh?Math.round(lh/lsh*100):0;
  document.getElementById("iStats").innerHTML=
    '<div class="stat"><div class="lab">'+t.iScoreL+'</div><div class="val">+'+ls+'</div></div>'+
    '<div class="stat"><div class="lab">'+t.iTotalL+'</div><div class="val">'+score+'</div></div>'+
    '<div class="stat"><div class="lab">'+t.iDronesL+'</div><div class="val">'+(killsD-snap.kD+killsH-snap.kH)+'</div></div>'+
    '<div class="stat"><div class="lab">'+t.iMissilesL+'</div><div class="val">'+(killsM-snap.kM)+'</div></div>'+
    '<div class="stat"><div class="lab">'+t.iAccL+'</div><div class="val">'+acc2+'%</div></div>'+
    '<div class="stat"><div class="lab">'+t.iFFL+'</div><div class="val">'+(ffCount-snap.ff)+'</div></div>';
  showScreen("inter");
  sfx.lvl();
  CG.happytime();
}
function levelFail(){
  state=ST.FAIL;
  CG.gameplayStop();
  amb.stop();
  const t=T[lang];
  setT("fDesc",t.fDescTpl.replace("{n}",curLevel+1).replace("{name}",t.lvlNames[curLevel]));
  document.getElementById("contBtn").classList.toggle("hidden",usedContinue);
  showScreen("fail");
}
/* rewarded continue: +2 shields, same level, same clock */
document.getElementById("contBtn").addEventListener("click",()=>{
  if(state!==ST.FAIL||usedContinue)return;
  const prevSound=soundOn;
  CG.rewardedAd({
    pause(){ soundOn=false;amb.refresh(); },
    rewarded(){
      usedContinue=true;
      shieldsN=2;hostiles=[];parts=[];floaters=[];
      hideAll();showHud(true);
      state=ST.PLAY;paused=false;
      last=performance.now();
      CG.gameplayStart();
      amb.start(curLevel);
      updateHUD();
    },
    resume(){ soundOn=prevSound;amb.refresh(); }
  });
});
function winGame(){
  state=ST.WIN;
  amb.stop();
  const t=T[lang];
  const acc=shots?Math.round(hits/shots*100):0;
  /* rank scales with how many levels the run covered */
  const levelsPlayed=Math.max(1,LEVELS.length-runStart);
  const perLevel=score/levelsPlayed;
  let r=0;
  if(perLevel>=3600)r=3;else if(perLevel>=2000)r=2;else if(perLevel>=800)r=1;
  setT("sScore",score);setT("sKills",kills);setT("sDrones",killsD+killsH);setT("sMissiles",killsM);setT("sAcc",acc+"%");setT("sFF",ffCount);
  setT("wRank",t.ranks[r]);lastRank=t.ranks[r];
  const isRecord=!save.best||score>save.best.score;
  recordRun(r);
  const wb=document.getElementById("wBest");
  wb.textContent=t.newBest;
  wb.classList.toggle("hidden",!isRecord);
  showScreen("win");
  sfx.win();
  CG.happytime();
}
document.getElementById("againBtn").addEventListener("click",()=>adThen(openMenu));
document.getElementById("interMenuBtn").addEventListener("click",()=>{recordRun(null);adThen(openMenu);});
document.getElementById("nextBtn").addEventListener("click",()=>{
  const go=()=>startLevel(curLevel+1);
  if(AD_AFTER_LEVELS.has(curLevel+1))adThen(go);else go();
});
document.getElementById("retryBtn").addEventListener("click",()=>{
  const go=()=>{
    score=snap.score;shots=snap.shots;hits=snap.hits;kills=snap.kills;killsD=snap.kD;killsM=snap.kM;killsH=snap.kH;ffCount=snap.ff;
    startLevel(curLevel);
  };
  adThen(go);
});
document.getElementById("failMapBtn").addEventListener("click",()=>{
  recordRun(null);
  adThen(openMenu);
});

/* ---------- pause ---------- */
function openPause(){
  if(state!==ST.PLAY)return;
  paused=true;state=ST.PAUSE;
  CG.gameplayStop();
  amb.stop();
  showScreen("pause");
}
document.getElementById("menuBtn").addEventListener("click",()=>{
  if(state===ST.PLAY)openPause();
});
document.getElementById("resumeBtn").addEventListener("click",()=>{
  if(state!==ST.PAUSE)return;
  hideAll();
  state=ST.PLAY;paused=false;autoPaused=false;
  last=performance.now();
  CG.gameplayStart();
  amb.start(curLevel);
});
document.getElementById("quitBtn").addEventListener("click",()=>{
  if(state!==ST.PAUSE)return;
  recordRun(null);
  paused=false;
  adThen(openMenu);
});

/* copy result (victory screen) */
function copyResult(btn){
  const t=T[lang];
  const txt=resultText(save.last||makeRec(null));
  const done=()=>{btn.textContent=t.copied;setTimeout(()=>{btn.textContent=t.copyRes;},1600);};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(()=>fbCopy(txt,done));}
  else fbCopy(txt,done);
}
function fbCopy(text,done){
  const ta=document.createElement("textarea");
  ta.value=text;ta.style.position="fixed";ta.style.opacity="0";
  document.body.appendChild(ta);ta.select();
  try{document.execCommand("copy");}catch(e){}
  document.body.removeChild(ta);done();
}
document.getElementById("copyResBtn").addEventListener("click",e=>copyResult(e.currentTarget));

/* copy the last game played — same format as the victory screen */
function resultText(rec){
  const t=T[lang];
  const grade=(rec.rank!=null)?t.ranks[rec.rank]:"\u2014";
  return lang==="fr"
    ? t.gameName+" \u2014 Campagne termin\u00e9e \uD83C\uDFAF\nGrade : "+grade+"\nScore : "+rec.score+" \u00B7 Drones : "+rec.drones+" \u00B7 Missiles : "+rec.missiles+" \u00B7 Pr\u00e9cision : "+rec.acc+"% \u00B7 Tirs sur civils : "+rec.ff
    : t.gameName+" \u2014 Campaign complete \uD83C\uDFAF\nRank: "+grade+"\nScore: "+rec.score+" \u00B7 Drones: "+rec.drones+" \u00B7 Missiles: "+rec.missiles+" \u00B7 Accuracy: "+rec.acc+"% \u00B7 Civilian hits: "+rec.ff;
}
document.getElementById("copyScoreBtn").addEventListener("click",e=>{
  const t=T[lang],btn=e.currentTarget;
  if(!save.last)return;
  const txt=resultText(save.last);
  const done=()=>{btn.textContent=t.copied;setTimeout(()=>{btn.textContent=t.copyRes;},1600);};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(()=>fbCopy(txt,done));}
  else fbCopy(txt,done);
});

/* ---------- boot ---------- */
loadSave();
applyLang();
updateHUD();
(async function boot(){
  CG.loadingStart();
  await CG.init();
  CG.loadingStart(); /* safe to call again after init on real platform */
  /* wait for the first background so the menu shows over real art */
  await new Promise(res=>{
    const b=bgs[0];
    if(b.complete)return res();
    b.onload=res;b.onerror=res;
    setTimeout(res,4000); /* never block the player */
  });
  CG.loadingStop();
  openMenu();
})();

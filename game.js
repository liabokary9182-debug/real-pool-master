(() => {
  'use strict';
  const canvas = document.getElementById('game');
  let ctx = canvas.getContext('2d',{alpha:false,desynchronized:true});
  const $ = id => document.getElementById(id);
  const VIEW_W=1400,VIEW_H=790;
  // Touch devices get a lighter backing buffer and cheaper ball effects. The
  // collision solver still runs at 180 Hz, so rendering gains do not alter play.
  const MOBILE_RENDER=window.matchMedia?.('(pointer:coarse)').matches??false;
  const deviceScale=window.devicePixelRatio||1;
  let PIXEL_RATIO=Math.min(MOBILE_RENDER?1.8:2,Math.max(MOBILE_RENDER?1.35:1.5,deviceScale*.65));
  canvas.width=Math.round(VIEW_W*PIXEL_RATIO);canvas.height=Math.round(VIEW_H*PIXEL_RATIO);
  ctx.setTransform(PIXEL_RATIO,0,0,PIXEL_RATIO,0,0);
  const W = 100, H = 50, HEAD_LINE = W/4, R = 1.125*1.05*1.05, DISPLAY_R = R;
  // The reference is an 82 mm corner mouth. Keep the current playable opening
  // and enlarge all six mouths by the same small amount for this preview.
  const CORNER_MOUTH = 82 * 1.05 * 1.05 * .98 * 1.02 * 1.025 * 1.02 * 1.02 * 1.02 * 1.02 * 1.05 * 1.05 / 25.4, SIDE_MOUTH = CORNER_MOUTH;
  const CUT = CORNER_MOUTH / Math.SQRT2, SIDE_L = W / 2 - SIDE_MOUTH / 2, SIDE_R = W / 2 + SIDE_MOUTH / 2;
  const SCALE = 12.8, OX = 60, OY = 75;
  const STEP = 1 / 180, COLORS = ['#f7f1e5','#f5b928','#1556ae','#c91f37','#623282','#dd742a','#086e5c','#70331e','#11131a'];
  // World distances are inches.  A solid sphere has I = 2/5 mr², so cloth
  // friction changes contact slip 3.5 times as fast as centre velocity.
  const GRAVITY = 386.09, SLIDE_DECEL = .20 * GRAVITY, ROLL_DECEL = .012 * GRAVITY;
  const PALETTE=COLORS.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
  const POCKETS = [
    {x:0,y:0,name:'左上角袋'}, {x:50,y:0,name:'上中袋'}, {x:100,y:0,name:'右上角袋'},
    {x:0,y:50,name:'左下角袋'}, {x:50,y:50,name:'下中袋'}, {x:100,y:50,name:'右下角袋'}
  ];
  // One geometry describes the drawn wells, rubber faces and fall region.
  const POCKET_GEOMETRY=POCKETS.map((p,index)=>{
    const side=p.x===W/2,nx=side?0:(p.x===0?-Math.SQRT1_2:Math.SQRT1_2),ny=side?(p.y===0?-1:1):(p.y===0?-Math.SQRT1_2:Math.SQRT1_2);
    const tx=-ny,ty=nx,mx=side?p.x:p.x===0?CUT/2:W-CUT/2,my=side?p.y:p.y===0?CUT/2:H-CUT/2;
    const radius=(side?SIDE_MOUTH:CORNER_MOUTH)/2,jawRadius=side?.05:.16;
    const well=pocketVisualCenter(index),faces=[-1,1].map(sign=>({
      ax:mx+tx*radius*sign,ay:my+ty*radius*sign,
      bx:mx+nx*.9+tx*(radius-.18)*sign,by:my+ny*.9+ty*(radius-.18)*sign
    }));
    return {index,mx,my,nx,ny,tx,ty,radius,jawRadius,well,faces,fallRadius:radius-R*.45,fallFront:-R*.35};
  });
  const state = {mode:null,opponent:'ai',aiDifficulty:'normal',aiTicket:0,aiThinking:false,phase:'menu',balls:[],pocketAnimations:[],turn:0,groups:[null,null],scores:[0,0],matchScores:[0,0],returnPage:'difficulty',breaking:true,rackSeed:0,ballInHand:false,repositionAllowed:false,aim:-0.02,power:56,guidePowerLock:null,spinX:0,spinY:0,shot:null,stopTime:0,shotTime:0,status:'启动球场，选择对局',winner:null,drag:null};
  // Trial shots use the live collision/cloth functions, with isolated events.
  // Never play sounds, emit pocket flashes, or edit the real shot during trials.
  let physicsContext=null;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const randomSeed = () => (window.crypto?.getRandomValues?.(new Uint32Array(1))[0] ?? (Math.random()*0x100000000)) >>> 0;
  function seededRandom(seed){let s=seed>>>0;return () => {s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^(s>>>15),1|s);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
  function shuffle(values,rng){for(let i=values.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[values[i],values[j]]=[values[j],values[i]];}return values;}
  const worldToScreen = (x,y) => ({x:OX+x*SCALE,y:OY+y*SCALE});
  const screenToWorld = (x,y) => ({x:(x-OX)/SCALE,y:(y-OY)/SCALE});
  const ball = (n,x,y) => {const a=(n*7%9-4)*.025,b=(n*11%9-4)*.025;return {n,x,y,vx:0,vy:0,rollVx:0,rollVy:0,spin:0,english:false,roll:0,rollHeading:0,q:[a,b,0,Math.sqrt(1-a*a-b*b)],sprite:null,spritePixels:null,spriteDirty:true,spriteAngle:0,pocketCandidate:null,pocketed:false};};
  const cue = () => state.balls.find(b => b.n === 0);
  const live = () => state.balls.filter(b => !b.pocketed);
  const activeBalls = () => state.balls.filter(b => !b.pocketed && b.n !== 0);
  const group = n => n >= 1 && n <= 7 ? 'solid' : n >= 9 && n <= 15 ? 'stripe' : null;
  const groupName = g => g === 'solid' ? '全色球' : g === 'stripe' ? '花色球' : '待分组';
  const actor = i => i===1&&state.opponent==='ai'?'电脑':`玩家 ${i+1}`;
  const currentGroup = () => state.groups[state.turn];
  const allGroupGone = g => g && !activeBalls().some(b => group(b.n) === g);
  const lowestNine = () => Math.min(...activeBalls().map(b => b.n));
  const say = text => {state.status=text; $('statusText').textContent=text;};
  const canAdjustStroke=()=>state.phase==='aim'&&!state.ballInHand&&!(state.opponent==='ai'&&state.turn===1);
  const PRACTICE_LAYOUTS={
    pocket:{label:'慢球进中袋',hint:'先试 18% 轻推，再调力度观察袋口；打偏会碰胶边。',balls:[[0,50,12],[1,50,5]],aim:-Math.PI/2,power:18,spinX:0,spinY:0},
    draw:{label:'低杆拉回',hint:'白球正碰目标球后拉回；与高杆使用同一球位和力度。',balls:[[0,40,25],[1,55,25]],aim:0,power:70,spinX:0,spinY:-.85},
    follow:{label:'高杆跟进',hint:'白球正碰后继续向前；可切换低杆对比白球落点。',balls:[[0,40,25],[1,55,25]],aim:0,power:70,spinX:0,spinY:.85},
    english:{label:'加塞碰库',hint:'先试右塞，再把击球点移到左侧，对比碰上库后的方向。',balls:[[0,30,25],[1,80,42]],aim:-Math.PI/3,power:48,spinX:.65,spinY:0}
  };
  function startPractice(key){
    const layout=PRACTICE_LAYOUTS[key];if(!layout)return;
    window.PoolAudio?.stopIntro?.();
    window.PoolAudio?.startGameMusic?.();
    if(!state.practice)state.practiceOpponent=state.opponent;
    state.aiTicket++;state.aiThinking=false;state.aiPlan=null;state.practice=key;state.returnPage='practice';
    state.mode=state.practiceRuleset||'nine';state.opponent='local';state.phase='aim';state.turn=0;state.groups=[null,null];state.scores=[0,0];
    state.breaking=false;state.ballInHand=false;state.repositionAllowed=false;state.shot=null;state.stopTime=0;state.shotTime=0;state.winner=null;
    state.balls=layout.balls.map(([n,x,y])=>ball(n,x,y));state.pocketAnimations=[];state.stroke=null;state.windup=0;
    state.aim=layout.aim;state.power=layout.power;state.spinX=layout.spinX;state.spinY=layout.spinY;
    for(const id of ['startOverlay','menuOverlay','practiceOverlay','resultOverlay'])$(id)?.classList.add('hidden');
    document.body?.setAttribute('data-screen','match');
    $('player2Name').textContent='练习目标';syncPowerUI();moveSpinDot();updateUI();say(`${layout.label}：${layout.hint}`);render();
  }
  function syncPowerUI() {
    $('power').value=String(state.power);
    $('powerReadout').textContent=Number(state.power.toFixed(1))+'%';
    $('cueMeter').setAttribute('aria-valuenow',String(state.power));
    $('cueMeter').style.setProperty('--power-height',`${state.power}%`);
    $('cueMeter').style.setProperty('--power-fraction',String(state.power/100));
  }
  function init(mode,{rematch=false}={}) {
    window.PoolAudio?.stopIntro?.();
    window.PoolAudio?.startGameMusic?.();
    state.practice=null;state.stroke=null;state.windup=0;
    state.aiTicket++;state.aiThinking=false;state.aiPlan=null;
    if(!rematch)state.matchScores=[0,0];
    state.returnPage=state.opponent==='ai'?'difficulty':'rules';
    state.mode=mode; state.phase='aim'; state.turn=0; state.groups=[null,null]; state.scores=[0,0];
    state.breaking=true; state.ballInHand=false; state.repositionAllowed=true; state.aim=0; state.power=56; state.spinX=0; state.spinY=0;
    state.shot=null; state.stopTime=0; state.shotTime=0; state.winner=null;
    state.balls=[ball(0,25,25)];state.pocketAnimations=[];state.rackSeed=randomSeed();
    const rackRng=seededRandom(state.rackSeed);
    if (mode==='eight') rackEight(rackRng); else rackNine(rackRng);
    for(const id of ['startOverlay','menuOverlay','practiceOverlay','resultOverlay'])$(id)?.classList.add('hidden');
    document.body?.setAttribute('data-screen','match');
    $('player2Name').textContent=state.opponent==='ai'?'电脑':'玩家 2';
    syncPowerUI(); moveSpinDot();
    say('开球：可拖动白球在虚线后摆放，瞄准后拉杆出杆。'+(mode==='nine'?'先碰 1 号球。':''));
    updateUI(); render();
  }
  function rackEight(rng) {
    const rackOffsetX=(rng()-.5)*.035,rackOffsetY=(rng()-.5)*.06;
    const solids=shuffle([1,2,3,4,5,6,7],rng),stripes=shuffle([9,10,11,12,13,14,15],rng);
    const rows=[[null],[null,null],[null,8,null],[null,null,null,null],[solids.pop(),null,null,null,stripes.pop()]];
    const remaining=shuffle([...solids,...stripes],rng);
    for(let row=0;row<5;row++) for(let col=0;col<=row;col++) {
      const n=rows[row][col]??remaining.pop();
      state.balls.push(ball(n,74+rackOffsetX+row*(Math.sqrt(3)*R+.01)+(rng()-.5)*.004,25+rackOffsetY+(col-row/2)*(2*R+.01)+(rng()-.5)*.004));
    }
  }
  function rackNine(rng) {
    const rackOffsetX=(rng()-.5)*.035,rackOffsetY=(rng()-.5)*.06;
    const others=shuffle([2,3,4,5,6,7,8],rng);
    const rows=[[1],[others.pop(),others.pop()],[others.pop(),9,others.pop()],[others.pop(),others.pop()],[others.pop()]];
    rows.forEach((numbers,row) => numbers.forEach((n,col) => {
      state.balls.push(ball(n,74+rackOffsetX+row*(Math.sqrt(3)*R+.01)+(rng()-.5)*.004,25+rackOffsetY+(col-(numbers.length-1)/2)*(2*R+.01)+(rng()-.5)*.004));
    }));
  }
  function updateUI() {
    $('modeLabel').textContent=state.mode==='nine'?'九球':'八球';
    $('turnLabel').textContent=state.phase==='gameover'?'本局结束':state.phase==='moving'?'球正在运动':`${actor(state.turn)}的回合`;
    for(let i=0;i<2;i++) {
      $('player'+i).classList.toggle('active',i===state.turn);
      $('group'+i).textContent=state.mode==='nine'?'最小号优先':groupName(state.groups[i]);
      $('score'+i).textContent=state.scores[i];
    }
    $('shootBtn').disabled=state.phase!=='aim'||state.ballInHand||(state.opponent==='ai'&&state.turn===1);
    $('placeCueBtn').hidden=!(state.phase==='aim'&&state.repositionAllowed&&!(state.opponent==='ai'&&state.turn===1));
    $('placeCueBtn').textContent=state.ballInHand?'确认白球位置':state.breaking?'开球摆白球':'重新摆放白球';
    $('tipText').textContent=state.phase==='gameover'?'本局结束，可开启下一场。':state.breaking?'开球白球可在虚线后的区域摆放；下拉球杆，松手出杆。':state.ballInHand?'自由球：拖动白球，满意后确认位置。':'拖动瞄准，拉动球杆出杆。';
    const adjustable=canAdjustStroke();
    $('power').disabled=!adjustable;$('resetSpin').disabled=!adjustable;
    for(const id of ['spinPad','angleRuler','cueMeter'])$(id).setAttribute('aria-disabled',String(!adjustable));
    if($('repeatPractice'))$('repeatPractice').hidden=!state.practice;
    if(state.practice){
      $('modeLabel').textContent='练球';$('turnLabel').textContent=state.phase==='moving'?'观察球路':state.phase==='practice-done'?'本杆结束':'自由击球';
      $('group0').textContent=PRACTICE_LAYOUTS[state.practice].label;$('group1').textContent='随时重摆';
      $('tipText').textContent='调整力度和击球点，击球后点“重摆本球”反复练习。';
    }
    syncAngleUI();
  }
  function syncAngleUI(){
    const degrees=((state.aim*180/Math.PI+180)%360+360)%360-180;
    $('angleReadout').textContent=degrees.toFixed(4)+'°';
    const ruler=$('angleRuler');
    ruler.setAttribute('aria-valuenow',degrees.toFixed(4));
    ruler.style.setProperty('--tick-offset',`${(-degrees*250)%100}px`);
  }
  function aimAt(x,y) {
    const c=cue(); if(!c||state.phase!=='aim'||state.ballInHand||(state.opponent==='ai'&&state.turn===1))return;
    const dx=x-c.x,dy=y-c.y;
    if(Math.hypot(dx,dy)<2)return;
    state.aim=Math.atan2(dy,dx); updateUI(); render();
  }
  function fire(byAI=false,withWindup=false) {
    if(state.phase!=='aim'||state.ballInHand||(state.opponent==='ai'&&state.turn===1&&!byAI))return;
    const c=cue(); if(!c||c.pocketed)return;
    state.guidePowerLock=null;
    // Flush pending aim changes before freezing the exact stroke inputs.
    updateUI();render();
    // A new stroke must never inherit a lingering flash from the last one.
    state.pocketAnimations=[];
    state.shot={shooter:state.turn,breaking:state.breaking,firstHit:null,pocketed:[],railAfterHit:false,breakRails:new Set(),groupAtStart:currentGroup(),eightReady:!!allGroupGone(currentGroup())};
    const breakForce=1;
    // Whole fixed ticks keep animation delay from changing collision timing.
    state.windup=withWindup?(state.power>=42?14*STEP:18*STEP):0;
    state.stroke={x:c.x,y:c.y,aim:state.aim,power:state.power,windup:state.windup,duration:state.power>=42?.18:.22,age:-state.windup};
    launchCue(c,breakForce);
    state.spinX=0;state.spinY=0;moveSpinDot();
    state.phase='moving';state.repositionAllowed=false;state.stopTime=0;state.shotTime=0;
    if(!withWindup)window.PoolAudio?.play('cue',Math.hypot(c.vx,c.vy));
    say(byAI&&state.aiPlan?`电脑：${state.aiPlan.description}`:`${actor(state.turn)}击球中…`);updateUI();render();
  }
  function cueLaunchSpeed(power,breaking=false,force=1){
    // Preserve the original ordinary stroke curve. Only soften the top of
    // the original break curve; cloth, impulses and collision order stay old.
    const boost=1+.4*(Math.max(0,(power-60)/40))**2;
    const light=clamp(power/25,0,1),touch=breaking?1:light*light*(3-2*light);
    const speed=(17+power*.78)*boost*touch*(breaking?2.5+1.65*power/100:1);
    return (breaking?speed/Math.pow(1+Math.pow(speed/260,4),.25):speed)*force;
  }
  function launchCue(c,breakForce=1){
    applyCueImpulse(c,state.power,state.aim,state.spinX,state.spinY,state.breaking,breakForce);
  }
  function applyCueImpulse(c,power,aim,spinX=0,spinY=0,breaking=false,force=1){
    const spinScale=Math.max(1,Math.hypot(spinX,spinY));spinX/=spinScale;spinY/=spinScale;
    const speed=cueLaunchSpeed(power,breaking,force),shotAngle=aim-spinX*.018;
    const strongSpin=clamp((Math.hypot(spinX,spinY)-.55)/.45,0,1);
    const spinGain=Math.min(1.75,1+.55*(power/100)**2+(breaking?0:.3*strongSpin*power/100));
    c.vx=Math.cos(shotAngle)*speed;c.vy=Math.sin(shotAngle)*speed;
    c.rollVx=Math.cos(shotAngle)*speed*spinY*1.05*spinGain;
    c.rollVy=Math.sin(shotAngle)*speed*spinY*1.05*spinGain;
    // In screen coordinates +z rotates clockwise. Right english is the
    // opposite rotation, and must kick right relative to the incoming shot.
    c.spin=-spinX*speed*.42*spinGain;c.english=Math.abs(spinX)>.03;c.rollHeading=shotAngle;
  }
  function pocketVisualCenter(index){
    const p=POCKETS[index];
    if(p.x===W/2)return {x:p.x,y:p.y+(p.y===0?-.55:.55)};
    return {x:p.x===0?CUT/2-.25:W-CUT/2+.25,y:p.y===0?CUT/2-.25:H-CUT/2+.25};
  }
  function markPocket(b,index) {
    if(b.pocketed)return;
    if(!physicsContext&&state.phase==='moving'&&state.balls.includes(b)){
      const impact=Math.hypot(b.vx,b.vy);
      state.pocketAnimations.push(makePocketFall(b,index,impact));
    }
    b.pocketed=true;b.vx=0;b.vy=0;b.rollVx=0;b.rollVy=0;b.spin=0;
    const events=physicsContext||state.shot;
    if(events)events.pocketed.push({n:b.n,pocket:index});
  }
  function pocketFallProfile(p){
    const centerDepth=(p.well.x-p.mx)*p.nx+(p.well.y-p.my)*p.ny;
    return {x:p.well.x,y:p.well.y,radius:p.fallRadius,angle:Math.atan2(p.ny,p.nx),halfAngle:Math.acos(clamp((p.fallFront-centerDepth)/p.fallRadius,-1,1))};
  }
  function pocketFallContains(p,x,y){
    return (x-p.mx)*p.nx+(y-p.my)*p.ny>=p.fallFront&&(x-p.well.x)**2+(y-p.well.y)**2<=p.fallRadius*p.fallRadius;
  }
  function makePocketFall(b,index,impact=Math.hypot(b.vx,b.vy)){
    const pocket=pocketVisualCenter(index);
    return {visual:{...b,q:[...b.q]},entryX:b.x,entryY:b.y,vx:b.vx,vy:b.vy,
      fallX:b.x,fallY:b.y,fallVx:b.vx,fallVy:b.vy,effectX:pocket.x,effectY:pocket.y,
      pocket:index,age:0,impact,duration:Math.sqrt(12*R/GRAVITY),sounded:false};
  }
  function advancePocketFall(a,dt){
    const p=POCKET_GEOMETRY[a.pocket];let remaining=dt;
    // Continuous travel until a lining collision: the very first derivative
    // is exactly the last cloth velocity, with no attraction to the centre.
    for(let bounce=0;bounce<6&&remaining>1e-9;bounce++){
      const dx=a.fallX-p.well.x,dy=a.fallY-p.well.y;
      const speed2=a.fallVx*a.fallVx+a.fallVy*a.fallVy;
      if(speed2<1e-12)break;
      const dot=dx*a.fallVx+dy*a.fallVy;
      const circle=(-dot+Math.sqrt(Math.max(0,dot*dot+speed2*(p.fallRadius*p.fallRadius-dx*dx-dy*dy))))/speed2;
      const outward=a.fallVx*p.nx+a.fallVy*p.ny;
      const depth=(a.fallX-p.mx)*p.nx+(a.fallY-p.my)*p.ny;
      const shelf=outward<0?Math.max(0,(depth-p.fallFront)/-outward):Infinity;
      const hit=Math.max(0,Math.min(circle,shelf)),travel=Math.min(remaining,hit);
      a.fallX+=a.fallVx*travel;a.fallY+=a.fallVy*travel;remaining-=travel;
      if(hit>travel+1e-9)break;
      const nx=shelf<circle?p.nx:(p.well.x-a.fallX)/p.fallRadius;
      const ny=shelf<circle?p.ny:(p.well.y-a.fallY)/p.fallRadius;
      const normal=a.fallVx*nx+a.fallVy*ny;
      a.fallVx=.68*(a.fallVx-normal*nx)-.18*normal*nx;
      a.fallVy=.68*(a.fallVy-normal*ny)-.18*normal*ny;
      a.visual.rollVx*=.6;a.visual.rollVy*=.6;a.visual.spin*=.6;
      // Tiny inward offset prevents roundoff from reporting the same hit twice.
      a.fallX+=nx*1e-8;a.fallY+=ny*1e-8;
    }
    a.age+=dt;
  }
  function pocketCheck(b) {
    b.pocketCandidate=null;
    for(const p of POCKET_GEOMETRY){
      const depth=(b.x-p.mx)*p.nx+(b.y-p.my)*p.ny;
      const distance2=(b.x-p.well.x)**2+(b.y-p.well.y)**2;
      if(distance2<p.radius*p.radius)b.pocketCandidate=p.index;
      // Once the centre passes the shelf edge and most of the footprint is
      // unsupported inside the visible well, gravity takes over. No minimum
      // speed and no invisible extra throat travel or attraction force.
      if(pocketFallContains(p,b.x,b.y)){
        b.pocketCandidate=p.index;return markPocket(b,p.index);
      }
    }
    if(b.x < -6 || b.x > W+6 || b.y < -6 || b.y > H+6){
      const escapedX=b.x<-6||b.x>W+6,escapedY=b.y<-6||b.y>H+6;
      b.x=clamp(b.x,R,W-R);b.y=clamp(b.y,R,H-R);
      if(escapedX)b.vx*=-.45;if(escapedY)b.vy*=-.45;
      b.rollVx=b.vx;b.rollVy=b.vy;b.pocketCandidate=null;
    }
  }
  function railHit(b,nx,ny,jaw=false) {
    const dot=b.vx*nx+b.vy*ny;
    if(dot<0){
      const approach=-dot;
      const tangentX=-ny,tangentY=nx;
      const tangentBefore=b.vx*tangentX+b.vy*tangentY;
      const spinBefore=b.spin;
      const sideEnglish=Math.abs(spinBefore)>.5;
      const restitution=jaw?.52:.79;
      let tangentAfter=tangentBefore*(jaw?.88:.985);
      let spinAfter=spinBefore;
      if(sideEnglish){
        // Solid-sphere rim inertia gives a 3.5 effective tangential mass.
        // Coulomb-limited impulse trades side-spin for tangential travel. Running
        // English can increase translational speed, but never total energy.
        const slip=tangentBefore-spinBefore;
        const impulse=clamp(-slip/3.5,-(1+restitution)*approach*.14,(1+restitution)*approach*.14);
        tangentAfter+=impulse;
        spinAfter-=2.5*impulse;
      }
      let normalAfter=approach*restitution;
      const energyBefore=approach*approach+tangentBefore*tangentBefore+.4*spinBefore*spinBefore;
      const energyAfter=normalAfter*normalAfter+tangentAfter*tangentAfter+.4*spinAfter*spinAfter;
      if(energyAfter>energyBefore*.985){const scale=Math.sqrt(energyBefore*.985/energyAfter);normalAfter*=scale;tangentAfter*=scale;spinAfter*=scale;}
      b.vx=nx*normalAfter+tangentX*tangentAfter;
      b.vy=ny*normalAfter+tangentY*tangentAfter;
      b.spin=spinAfter;
      // The cushion removes most forward roll. The brief skid afterward
      // dissipates more speed without bending a no-English bank's path.
      b.rollVx=b.vx*.25;b.rollVy=b.vy*.25;
      if(!physicsContext&&state.phase==='moving')window.PoolAudio?.play('rail',approach);
      b.hitRail=true;
      const events=physicsContext||state.shot;
      if(events){
        if(events.firstHit!==null)events.railAfterHit=true;if(b.n!==0)events.breakRails.add(b.n);
        (events.cushionHits??=[]).push({n:b.n,jaw,beforeFirstHit:events.firstHit===null,nx,ny,x:b.x,y:b.y});
      }
    }
  }
  function collidePocketFace(b,face,rubberRadius){
    const dx=face.bx-face.ax,dy=face.by-face.ay,length2=dx*dx+dy*dy;
    const t=clamp(((b.x-face.ax)*dx+(b.y-face.ay)*dy)/length2,0,1);
    const x=face.ax+t*dx,y=face.ay+t*dy,bx=b.x-x,by=b.y-y,distance=Math.hypot(bx,by),limit=R+rubberRadius;
    if(distance>=limit)return;
    const nx=distance>1e-8?bx/distance:-dy/Math.sqrt(length2),ny=distance>1e-8?by/distance:dx/Math.sqrt(length2);
    b.x=x+nx*limit;b.y=y+ny*limit;railHit(b,nx,ny,true);
  }
  function pocketFaces(b){
    for(const p of POCKET_GEOMETRY){
      if(Math.hypot(b.x-p.mx,b.y-p.my)>p.radius+R+1.1)continue;
      for(const face of p.faces)collidePocketFace(b,face,p.jawRadius);
    }
  }
  function rails(b) {
    const horiz = x => (x>=CUT&&x<=SIDE_L)||(x>=SIDE_R&&x<=W-CUT);
    if(b.y<R&&horiz(b.x)){b.y=R;railHit(b,0,1);}
    if(b.y>H-R&&horiz(b.x)){b.y=H-R;railHit(b,0,-1);}
    if(b.x<R&&b.y>=CUT&&b.y<=H-CUT){b.x=R;railHit(b,1,0);}
    if(b.x>W-R&&b.y>=CUT&&b.y<=H-CUT){b.x=W-R;railHit(b,-1,0);}
    pocketFaces(b);
  }
  function ballsCollide(a,b) {
    const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy,limit=2*R;
    if(d2>=limit*limit)return false;
    const dist=Math.sqrt(Math.max(d2,1e-9));const nx=dx/dist,ny=dy/dist;
    const overlap=limit-dist;
    a.x-=nx*overlap*.5;b.x+=nx*overlap*.5;a.y-=ny*overlap*.5;b.y+=ny*overlap*.5;
    const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
    if(rel>=0)return false;
    const impulse=-(1+.94)*rel/2;
    a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
    const tx=-ny,ty=nx;
    const tangentSlip=(b.vx-a.vx)*tx+(b.vy-a.vy)*ty-(a.spin+b.spin);
    const tangentImpulse=clamp(-tangentSlip/7,-impulse*.055,impulse*.055);
    a.vx-=tangentImpulse*tx;a.vy-=tangentImpulse*ty;
    b.vx+=tangentImpulse*tx;b.vy+=tangentImpulse*ty;
    a.spin-=2.5*tangentImpulse;b.spin-=2.5*tangentImpulse;
    const events=physicsContext||state.shot;
    if(events?.captureContacts)(events.contacts??=[]).push({a:a.n,b:b.n,afterA:{x:a.x,y:a.y,vx:a.vx,vy:a.vy},afterB:{x:b.x,y:b.y,vx:b.vx,vy:b.vy}});
    if(events && events.firstHit===null && (a.n===0||b.n===0)){
      events.firstHit=a.n===0?b.n:a.n;
    }
    if(!physicsContext&&state.phase==='moving')window.PoolAudio?.play('ball',-rel);
    return true;
  }
  function clothStep(b,dt) {
    const slipX=b.vx-b.rollVx,slipY=b.vy-b.rollVy,slip=Math.hypot(slipX,slipY);
    let rollingTime=dt;
    if(slip>1e-7){
      const slidingTime=Math.min(dt,slip/(3.5*SLIDE_DECEL));
      const delta=SLIDE_DECEL*slidingTime;
      const fx=slipX/slip*delta,fy=slipY/slip*delta;
      b.vx-=fx;b.vy-=fy;b.rollVx+=fx*2.5;b.rollVy+=fy*2.5;
      rollingTime=dt-slidingTime;
      if(rollingTime>0){b.rollVx=b.vx;b.rollVy=b.vy;}
    }else{b.rollVx=b.vx;b.rollVy=b.vy;}
    if(rollingTime>0){
      const speed=Math.hypot(b.vx,b.vy);
      // v(t) = max(0, v0 - µr g t); never reverse a nearly stopped ball.
      if(speed>0){
        const drag=Math.min(speed,ROLL_DECEL*rollingTime);
        b.vx-=b.vx/speed*drag;b.vy-=b.vy/speed*drag;
        b.rollVx=b.vx;b.rollVy=b.vy;
      }
    }
    // Cloth also slows rotation around the vertical axis. Keeping it as a
    // separate, bounded deceleration lets the ball finish its last visible
    // turn before the shot is declared settled.
    const sideSpeed=Math.abs(b.spin);
    if(sideSpeed>.0001){const drag=Math.min(sideSpeed,12*Math.min(1,sideSpeed/1.5)*dt);b.spin-=Math.sign(b.spin)*drag;}
  }
  function advanceBallOrientation(b,dt){
    const wx=-b.rollVy/R,wy=b.rollVx/R,wz=b.spin/R,rate=Math.hypot(wx,wy,wz);
    if(rate<.015)return;
    const half=rate*dt*.5,s=Math.sin(half)/rate,dq=[wx*s,wy*s,wz*s,Math.cos(half)],q=b.q;
    const next=[dq[3]*q[0]+dq[0]*q[3]+dq[1]*q[2]-dq[2]*q[1],dq[3]*q[1]-dq[0]*q[2]+dq[1]*q[3]+dq[2]*q[0],dq[3]*q[2]+dq[0]*q[1]-dq[1]*q[0]+dq[2]*q[3],dq[3]*q[3]-dq[0]*q[0]-dq[1]*q[1]-dq[2]*q[2]];
    const magnitude=Math.hypot(...next);b.q=next.map(v=>v/magnitude);
    // Position still renders every frame. Rebuild the costly sphere texture
    // only after its markings rotate enough to change a visible pixel.
    b.spriteAngle+=rate*dt;
    if(b.spriteAngle>=(MOBILE_RENDER ? .24 : .12)){b.spriteDirty=true;b.spriteAngle=0;}
  }
  function update(dt) {
    if(state.stroke&&(state.stroke.age+=dt)>state.stroke.duration)state.stroke=null;
    state.pocketAnimations=state.pocketAnimations.filter(a=>{
      advancePocketFall(a,dt);
      advanceBallOrientation(a.visual,dt);
      if(!a.sounded&&.5*GRAVITY*a.age*a.age>=2.8*R){
        a.sounded=true;window.PoolAudio?.play('pocket',Math.hypot(a.impact,GRAVITY*a.age));
      }
      return a.age<a.duration;
    });
    if(state.phase!=='moving')return;
    if(state.windup>0){
      const wait=Math.min(dt,state.windup);state.windup-=wait;dt-=wait;
      if(state.windup<1e-8){state.windup=0;window.PoolAudio?.play('cue',Math.hypot(cue().vx,cue().vy));}
      if(dt<1e-8)return;
    }
    state.shotTime+=dt;
    physicsStep(state.balls,dt,true);
    if(live().every(b=>Math.hypot(b.vx,b.vy)<.12&&Math.hypot(b.rollVx,b.rollVy)<.12&&Math.abs(b.spin)<.12))state.stopTime+=dt;else state.stopTime=0;
    if(state.stopTime>.3&&state.pocketAnimations.length===0||state.shotTime>30){for(const b of live()){b.vx=0;b.vy=0;b.rollVx=0;b.rollVy=0;b.spin=0;}endShot();}
  }
  function spotBall(n) {
    const b=state.balls.find(q=>q.n===n);if(!b)return;
    for(let step=0;step<55;step++){
      const x=75-step*2.3,y=25;
      if(x<R||live().some(q=>q!==b&&Math.hypot(q.x-x,q.y-y)<2*R+.1))continue;
      b.x=x;b.y=y;b.pocketed=false;b.vx=b.vy=b.rollVx=b.rollVy=b.spin=0;return;
    }
    b.x=75;b.y=25;b.pocketed=false;
  }
  function resetCueForHand() {
    const c=cue();c.pocketed=false;c.vx=c.vy=c.rollVx=c.rollVy=c.spin=0;
    for(let x=25;x>=6;x-=2.5){if(!activeBalls().some(b=>Math.hypot(b.x-x,b.y-25)<2*R+.2)){c.x=x;c.y=25;break;}}
    state.ballInHand=true;state.repositionAllowed=true;
  }
  function endShot() {
    const s=state.shot; if(!s)return;
    state.shot=null;state.phase='aim';state.breaking=false;
    const nums=s.pocketed.map(p=>p.n),objectPots=nums.filter(n=>n!==0),scratch=nums.includes(0);
    if(state.practice){
      state.phase='practice-done';state.turn=0;state.scores[0]=objectPots.length;
      const c=cue(),landing=scratch?'白球落袋':`白球落点 (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`;
      say(`${objectPots.length?`进球 ${objectPots.join('、')} 号 · `:''}${landing} · 点“重摆本球”再试`);updateUI();render();return;
    }
    const wrongFirst=s.firstHit===null || (state.mode==='nine'?s.firstHit!==Math.min(...state.balls.filter(b=>b.n>0&&(!b.pocketed||nums.includes(b.n))).map(b=>b.n)):s.groupAtStart?(s.eightReady?s.firstHit!==8:group(s.firstHit)!==s.groupAtStart):s.firstHit===8);
    const noRail=s.firstHit!==null&&!s.railAfterHit&&objectPots.length===0;
    const foul=scratch||wrongFirst||noRail;
    const foulReason=scratch?'白球落袋':wrongFirst?'未先碰合法目标球':noRail?'碰球后未碰库或落袋':'';
    // Count the deciding shot before finish() opens the result page. A foul
    // never earns pots; assigned eight-ball groups only credit the own group.
    if(!foul){
      const credited=state.mode==='nine'?objectPots.filter(n=>n!==9||!s.breaking):objectPots.filter(n=>n===8?!s.breaking&&s.eightReady:!s.groupAtStart||group(n)===s.groupAtStart);
      state.scores[s.shooter]+=credited.length;
    }
    if(state.mode==='nine'){
      if(nums.includes(9)){
        if(foul||s.breaking)spotBall(9);
        else return finish(s.shooter,'合法打进 9 号球');
      }
      if(foul){state.turn=1-s.shooter;resetCueForHand();say(`${foulReason}，${actor(state.turn)}自由摆球。`);}
      else if(objectPots.length){state.turn=s.shooter;say(`合法进球！${actor(state.turn)}继续。`);}
      else{state.turn=1-s.shooter;say(`未进球，轮到${actor(state.turn)}。`);}
    } else {
      const eight=s.pocketed.find(p=>p.n===8);
      if(eight){
        if(s.breaking){spotBall(8);say('开球打进 8 号球，8 号球重新摆放。');}
        else if(foul||!s.eightReady)return finish(1-s.shooter, foul?'打进 8 号球时犯规':'提前打进 8 号球');
        else return finish(s.shooter,'合法打进 8 号球');
      }
      const groupPots=objectPots.filter(n=>n!==8);
      if(!foul&&!s.breaking&&!s.groupAtStart&&groupPots.length){
        state.groups[s.shooter]=group(groupPots[0]);state.groups[1-s.shooter]=state.groups[s.shooter]==='solid'?'stripe':'solid';
      }
      if(foul){state.turn=1-s.shooter;resetCueForHand();say(`${foulReason}，${actor(state.turn)}自由摆球。`);}
      else if(s.breaking&&objectPots.length){state.turn=s.shooter;say(`开球进球，${actor(state.turn)}继续。`);}
      else if(s.groupAtStart&&groupPots.some(n=>group(n)===s.groupAtStart)){state.turn=s.shooter;say(`合法进球！${actor(state.turn)}继续。`);}
      else if(!s.groupAtStart&&groupPots.length){state.turn=s.shooter;say(`${actor(state.turn)}继续，已分配${groupName(state.groups[s.shooter])}。`);}
      else{state.turn=1-s.shooter;say(`轮到${actor(state.turn)}。`);}
    }
    if(scratch&&!state.ballInHand)resetCueForHand();
    updateUI();render();queueAI();
  }
  function finish(winner,reason) {
    if(state.phase==='gameover')return;
    state.winner=winner;state.turn=winner;state.phase='gameover';state.ballInHand=false;state.repositionAllowed=false;
    state.aiTicket++;state.aiThinking=false;state.aiPlan=null;state.matchScores[winner]++;
    say(`${actor(winner)}获胜 · ${reason}。`);
    updateUI();render();
    for(const id of ['startOverlay','menuOverlay','practiceOverlay','rulesOverlay'])$(id)?.classList.add('hidden');
    $('resultTitle').textContent=`${actor(winner)}获胜`;
    $('resultReason').textContent=reason;
    $('resultMode').textContent=(state.mode==='nine'?'九球':'八球')+' · '+(state.opponent==='ai'?'人机对战':'双人同屏');
    $('resultRack').textContent=`第 ${state.matchScores[0]+state.matchScores[1]} 局结束`;
    for(let i=0;i<2;i++){
      $('resultName'+i).textContent=actor(i);
      $('resultWins'+i).textContent=state.matchScores[i];
      $('resultPots'+i).textContent=state.scores[i];
      $('resultPlayer'+i).classList.toggle('is-winner',i===winner);
    }
    document.body?.setAttribute('data-screen','result');
    $('resultOverlay').classList.remove('hidden');$('resultReplay').focus?.();
  }
  function lineClear(x1,y1,x2,y2,ignored) {
    return lineClearIn(live(),x1,y1,x2,y2,ignored);
  }
  function lineClearIn(balls,x1,y1,x2,y2,ignored,margin=.25) {
    const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy;
    return balls.every(b=>{
      if(ignored.includes(b.n))return true;
      const t=clamp(((b.x-x1)*dx+(b.y-y1)*dy)/Math.max(len2,.01),0,1);
      return Math.hypot(b.x-x1-t*dx,b.y-y1-t*dy)>2*R+margin;
    });
  }
  const AI_LEVELS={
    easy:{options:4,potRate:.4,angleError:2.6,powerError:.14,escapeAngles:24,maxBanks:1},
    normal:{options:7,potRate:.6,angleError:.55,powerError:.065,escapeAngles:48,maxBanks:2},
    hard:{options:10,potRate:.95,angleError:.12,powerError:.015,escapeAngles:72,maxBanks:3}
  };
  function aiLevel(){return AI_LEVELS[state.aiDifficulty]||AI_LEVELS.normal;}
  function executeAIPlan(plan){
    if(!plan)return null;
    const level=aiLevel(),sign=Math.random()<.5?-1:1;
    // Human-like execution uncertainty is visible in the actual shot inputs.
    // It never changes ball mass, cushion response or pocket acceptance.
    const precision=1;
    const aimError=sign*(.55+Math.random()*.45)*level.angleError*precision*Math.PI/180;
    const powerFactor=1+(Math.random()*2-1)*level.powerError;
    const rounded=(offset=0,factor=1)=>({...plan,aim:Math.round((plan.aim+offset)*180/Math.PI*100)/100*Math.PI/180,power:Math.round(clamp(plan.power*factor,5,100))});
    let actual=rounded(aimError,powerFactor),result=simulateAIShot(actual);
    const attack=['attack','bank','kick'].includes(plan.type);
    const pots=r=>r.safe&&(r.potted||r.winning);
    // Master accepts its real execution error, rather than retrying the exact
    // nominal shot until a nominally possible but fragile pot goes in.
    if(state.aiDifficulty==='hard')return {...actual,executionError:{angleDegrees:(actual.aim-plan.aim)*180/Math.PI,powerPercent:(actual.power/plan.power-1)*100},difficulty:'hard',expectedPot:pots(result),executionVerified:result.safe};
    // Independent execution draws target the long-run rate. There is no
    // per-turn counter, miss quota or forced failure after a pot streak.
    const wantedPot=attack&&Math.random()<level.potRate;
    if(attack){
      if(wantedPot){
        if(!pots(result)||!validTacticalRoute(actual,result)){
          for(const offset of [0,aimError*.25,-aimError*.25]){
            const candidate=rounded(offset),trial=simulateAIShot(candidate);
            if(pots(trial)&&validTacticalRoute(candidate,trial)){actual=candidate;result=trial;break;}
          }
        }
      }else{
        // A miss is an actual changed stroke, never a rejected legal pot.
        // Prefer a legal contact and safe cue ball so lower tiers still play.
        for(const degrees of [.2,.4,.8,1.5,2.5,4,6]){
          let found=false;
          for(const direction of [sign,-sign]){
            const candidate=rounded(direction*degrees*Math.PI/180),trial=simulateAIShot(candidate);
            if(trial.safe&&!trial.potted&&!trial.winning){actual=candidate;result=trial;found=true;break;}
          }
          if(found)break;
        }
      }
    }else if(!result.safe){
      const candidate=rounded(),trial=simulateAIShot(candidate);
      if(trial.safe){actual=candidate;result=trial;}
    }
    return {...actual,executionError:{angleDegrees:(actual.aim-plan.aim)*180/Math.PI,powerPercent:(actual.power/plan.power-1)*100},difficulty:state.aiDifficulty,accuracyTarget:level.potRate,expectedPot:!!(result.potted||result.winning),executionVerified:result.safe};
  }
  function aiTargets(){
    return state.mode==='nine'?activeBalls().filter(b=>b.n===lowestNine()):activeBalls().filter(b=>currentGroup()?(allGroupGone(currentGroup())?b.n===8:group(b.n)===currentGroup()):b.n!==8);
  }
  function pocketAim(index,lateral=0){
    const p=POCKETS[index],side=p.x===W/2;
    const dx=side?0:(p.x===0?-Math.SQRT1_2:Math.SQRT1_2),dy=side?(p.y===0?-1:1):(p.y===0?-Math.SQRT1_2:Math.SQRT1_2);
    return {x:(side?p.x:p.x===0?CUT/2:W-CUT/2)+dx*.3-dy*lateral,y:(side?p.y:p.y===0?CUT/2:H-CUT/2)+dy*.3+dx*lateral};
  }
  function attackRisk(option,target){
    const cos=clamp(option.cos,.01,1),cut=Math.acos(cos)*180/Math.PI;
    const railGap=Math.min(target.x-R,W-R-target.x,target.y-R,H-R-target.y);
    const longCut=Math.max(0,option.cd-30)*Math.max(0,cut-25)/65;
    const travelCut=Math.max(0,option.pd-25)*Math.max(0,cut-30)/55;
    const frozenPenalty=railGap<.6?Math.max(0,cut-25)*(option.cd+option.pd)/100:0;
    const unrealistic=(railGap<.6&&option.cd+option.pd>85&&cut>55)||(option.cd>45&&option.pd>35&&cut>67);
    return {risk:longCut+travelCut+frozenPenalty,unrealistic};
  }
  function aiOptions(targets){
    const c=cue(),options=[];
    for(const target of targets)for(let pocket=0;pocket<6;pocket++)for(const lateral of [0,-.5,.5]){
      const p=pocketAim(pocket,lateral),pd=Math.hypot(p.x-target.x,p.y-target.y);
      if(pd<.1||!lineClear(target.x,target.y,p.x,p.y,[0,target.n]))continue;
      const nx=(p.x-target.x)/pd,ny=(p.y-target.y)/pd,gx=target.x-nx*2*R,gy=target.y-ny*2*R;
      const cd=Math.hypot(gx-c.x,gy-c.y),cos=((gx-c.x)*nx+(gy-c.y)*ny)/Math.max(cd,.01);
      if(gx<R||gx>W-R||gy<R||gy>H-R||cos<.28||!lineClear(c.x,c.y,gx,gy,[0,target.n]))continue;
      // Wide cuts and long object-ball travel are less forgiving than cue travel.
      const option={target:target.n,pocket,aim:Math.atan2(gy-c.y,gx-c.x),cd,pd,cos,score:pd*.8+cd*.35+(1-cos)*70+Math.abs(lateral)*2};
      if(state.aiDifficulty==='hard'){
        const assessment=attackRisk(option,target);if(assessment.unrealistic)continue;
        option.realismRisk=assessment.risk;option.score+=assessment.risk*1.4;
      }
      options.push(option);
    }
    return options.sort((a,b)=>a.score-b.score);
  }
  function simulateAIShot(plan){
    const balls=live().map(b=>({...b,q:[...b.q]})),c=balls.find(b=>b.n===0);
    const allowed=aiTargets().map(b=>b.n),approachTargets=balls.filter(b=>allowed.includes(b.n));
    const events={firstHit:null,pocketed:[],railAfterHit:false,breakRails:new Set()};
    let stopTime=0,settled=false,closestApproach=Infinity,potApproach=Infinity;
    const attackTarget=balls.find(b=>b.n===plan.target);
    const aimPocket=plan.trackPotApproach&&Number.isInteger(plan.pocket)?pocketAim(plan.pocket):null;
    const previous=physicsContext;physicsContext=events;
    try{
      applyCueImpulse(c,plan.power,plan.aim,plan.spinX||0,plan.spinY||0,state.breaking);
      // Use the same 30 s limit and 0.3 s settling interval as a live shot.
      for(let frame=0;frame<5401;frame++){
        physicsStep(balls,STEP);
        if(aimPocket&&attackTarget&&!attackTarget.pocketed&&events.firstHit===plan.target){
          potApproach=Math.min(potApproach,Math.hypot(attackTarget.x-aimPocket.x,attackTarget.y-aimPocket.y));
        }
        if(plan.trackApproach&&events.firstHit===null&&!c.pocketed){
          for(const target of approachTargets)closestApproach=Math.min(closestApproach,(c.x-target.x)**2+(c.y-target.y)**2);
        }
        if(ballsSettled(balls))stopTime+=STEP;else stopTime=0;
        if(stopTime>.3||(frame+1)*STEP>30){settled=true;break;}
      }
    }finally{physicsContext=previous;}
    const legal=allowed.includes(events.firstHit),scratch=events.pocketed.some(b=>b.n===0);
    const earlyEight=state.mode==='eight'&&events.pocketed.some(b=>b.n===8)&&!allowed.includes(8);
    const safe=settled&&legal&&!scratch&&!earlyEight&&(events.railAfterHit||events.pocketed.some(b=>b.n!==0));
    const winning=safe&&events.pocketed.some(b=>b.n===(state.mode==='nine'?9:8));
    return {...events,balls,legal,scratch,settled,closestApproach,potApproach,winning,safe,potted:events.pocketed.some(b=>b.n===plan.target&&b.pocket===plan.pocket)};
  }
  function powerForSpeed(speed){
    let low=0,high=100;
    for(let i=0;i<14;i++){const mid=(low+high)/2;if(cueLaunchSpeed(mid)<speed)low=mid;else high=mid;}
    return Math.round(clamp((low+high)/2,8,100));
  }
  function targetsInLayout(balls,side,assignedGroup=state.groups[side]){
    const objects=balls.filter(b=>!b.pocketed&&b.n!==0);
    if(state.mode==='nine'){
      const lowest=Math.min(...objects.map(b=>b.n));return objects.filter(b=>b.n===lowest);
    }
    if(!assignedGroup)return objects.filter(b=>b.n!==8);
    const own=objects.filter(b=>group(b.n)===assignedGroup);
    return own.length?own:objects.filter(b=>b.n===8);
  }
  function aiPositionScore(result){
    if(result.winning)return -1000;
    const balls=result.balls.filter(b=>!b.pocketed),c=balls.find(b=>b.n===0);
    // On an open eight-ball table, the first legal pot assigns the group.
    const assigned=currentGroup()||group(result.pocketed?.find(p=>p.n!==0&&p.n!==8)?.n);
    const targets=targetsInLayout(balls,state.turn,assigned);
    if(!targets.length)return 0;
    let best=Infinity;
    for(const target of targets)for(let pocket=0;pocket<6;pocket++){
      const p=pocketAim(pocket),pd=Math.hypot(p.x-target.x,p.y-target.y);
      if(pd<.1||!lineClearIn(balls,target.x,target.y,p.x,p.y,[0,target.n]))continue;
      const nx=(p.x-target.x)/pd,ny=(p.y-target.y)/pd,gx=target.x-2*R*nx,gy=target.y-2*R*ny;
      const cd=Math.hypot(gx-c.x,gy-c.y),cos=((gx-c.x)*nx+(gy-c.y)*ny)/Math.max(cd,.01);
      if(gx<R||gx>W-R||gy<R||gy>H-R||cos<.28||!lineClearIn(balls,c.x,c.y,gx,gy,[0,target.n]))continue;
      const risk=attackRisk({pd,cd,cos},target);
      if(state.aiDifficulty==='hard'&&risk.unrealistic)continue;
      best=Math.min(best,pd*.23+cd*.14+(1-cos)*28+(state.aiDifficulty==='hard'?risk.risk*.65:0));
    }
    const distance=Math.min(...targets.map(b=>Math.hypot(b.x-c.x,b.y-c.y)));
    const railDistance=Math.min(c.x,W-c.x,c.y,H-c.y);
    // A nearby but hidden next ball is worse than a clear continuation.
    return (Number.isFinite(best)?best:40+distance*.12)+(railDistance<3?8:0);
  }
  function masterPositionScore(result){
    if(result.winning)return -1000;
    const c=result.balls.find(b=>b.n===0&&!b.pocketed);
    if(!c)return 1000;
    const pocketDistance=Math.min(...POCKETS.map(p=>Math.hypot(c.x-p.x,c.y-p.y)));
    const railDistance=Math.min(c.x,W-c.x,c.y,H-c.y);
    return aiPositionScore(result)*1.6+Math.max(0,6-pocketDistance)*5+Math.max(0,4-railDistance)*2;
  }
  const MASTER_SPINS=[
    [0,0],[0,.45],[0,.95],[0,-.45],[0,-.95],
    [-.3,0],[.3,0],[-.65,0],[.65,0],[-.9,0],[.9,0],
    [-.55,.55],[.55,.55],[-.55,-.55],[.55,-.55],[-.75,.3],[.75,.3],[-.75,-.3],[.75,-.3]
  ];
  function spinVariant(base,spinX,spinY,factor=1){
    return {...base,aim:base.aim+(spinX-(base.spinX||0))*.018,spinX,spinY,power:clamp(Math.round(base.power*factor),8,100)};
  }
  function strokeName(plan){
    return `${plan.spinY<-.1?'低杆拉回':plan.spinY>.1?'高杆跟进':'中杆'}${Math.abs(plan.spinX||0)>.1?` · ${plan.spinX<0?'左':'右'}${Math.abs(plan.spinX)>.6?'强':'轻'}塞`:''}${plan.power>=42?' · 击打':' · 轻推'}`;
  }
  function masterStrokeCost(plan,result){
    // Prefer simpler, controllable strokes when the resulting leave is similar.
    // Strong spin is selected for position, not rewarded for its own sake.
    const spin=Math.hypot(plan.spinX||0,plan.spinY||0);
    // Prefer a positive stroke for comparable leaves, but allow a soft roll
    // for a short straight pot. Position and scratch avoidance still dominate.
    const strokeFloor=clamp(30+((plan.cd||0)+(plan.pd||0))*.15,30,46);
    const softCost=Math.max(0,strokeFloor-plan.power)*.65;
    return masterPositionScore(result)+spin*spin*2.5+softCost+Math.max(0,plan.power-78)*.22;
  }
  async function refineMasterPosition(plans,isCurrent){
    const seen=new Set(),candidates=[];
    for(const plan of plans){const key=plan.target+':'+plan.pocket;if(seen.has(key))continue;seen.add(key);candidates.push(plan);if(candidates.length===4)break;}
    const refined=[];let count=0;
    for(const base of candidates)for(const [spinX,spinY] of MASTER_SPINS){
      if(!isCurrent())return null;
      const plan=spinVariant(base,spinX,spinY,spinY<-.7?1.06:spinY>.7?.94:1);
      const result=simulateAIShot(plan);
      if(result.safe&&(result.potted||result.winning)&&validTacticalRoute(plan,result)){
        const cost=masterStrokeCost(plan,result);refined.push({...plan,score:base.score-(base.positionCost||0)+cost,positionCost:cost,positionPlanned:true});
      }
      if(++count%4===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    // Fine-tune the best strokes at nearby strengths. Keep the same physics
    // and require a real legal pot before accepting a better cue-ball leave.
    const seeds=refined.slice().sort((a,b)=>a.score-b.score).slice(0,3);
    for(const base of seeds)for(const delta of [-4,-2,2,4]){
      if(!isCurrent())return null;
      const plan={...base,power:clamp(base.power+delta,8,100)},result=simulateAIShot(plan);
      if(result.safe&&(result.potted||result.winning)&&validTacticalRoute(plan,result)){
        const cost=masterStrokeCost(plan,result);
        refined.push({...plan,score:base.score-base.positionCost+cost,positionCost:cost});
      }
      if(++count%4===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    // Refine the actual contact point locally, not just the preset spin grid.
    for(const base of seeds.slice(0,2))for(const [dx,dy] of [[-.1,0],[.1,0],[0,-.1],[0,.1]])for(const delta of [-2,0,2]){
      if(!isCurrent())return null;
      const sx=clamp((base.spinX||0)+dx,-.95,.95),sy=clamp((base.spinY||0)+dy,-.95,.95);
      if(Math.hypot(sx,sy)>1)continue;
      const plan={...spinVariant(base,sx,sy),power:clamp(base.power+delta,8,100)},result=simulateAIShot(plan);
      if(result.safe&&(result.potted||result.winning)&&validTacticalRoute(plan,result)){
        const cost=masterStrokeCost(plan,result);refined.push({...plan,score:base.score-base.positionCost+cost,positionCost:cost,positionPlanned:true});
      }
      if(++count%2===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    // Search firmer real strokes with strong English/draw/follow. The extra
    // speed comes from the displayed power, shared with human shots.
    for(const base of candidates.slice(0,2))for(const power of [...new Set([Math.max(42,Math.round(base.power*1.28)),Math.max(52,Math.round(base.power*1.55))].map(p=>clamp(p,8,85)))])for(const [spinX,spinY] of MASTER_SPINS){
      if(!isCurrent())return null;
      const plan={...spinVariant(base,spinX,spinY),power},result=simulateAIShot(plan);
      if(result.safe&&(result.potted||result.winning)&&validTacticalRoute(plan,result)){
        const cost=masterStrokeCost(plan,result);refined.push({...plan,score:base.score-(base.positionCost||0)+cost,positionCost:cost,positionPlanned:true});
      }
      if(++count%4===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return refined.sort((a,b)=>a.score-b.score);
  }
  const AI_WALLS=[{axis:'x',value:R,id:'左库'},{axis:'x',value:W-R,id:'右库'},{axis:'y',value:R,id:'上库'},{axis:'y',value:H-R,id:'下库'}];
  function reflectedLeg(from,to,wall){
    const mirror={...to,[wall.axis]:wall.value+(wall.value-to[wall.axis])*(.985/.79)},dx=mirror.x-from.x,dy=mirror.y-from.y;
    const component=wall.axis==='x'?dx:dy;if(Math.abs(component)<1e-7)return null;
    const fraction=(wall.value-from[wall.axis])/component;
    if(fraction<=.01||fraction>=.99)return null;
    const bounce={x:from.x+dx*fraction,y:from.y+dy*fraction};
    const solid=wall.axis==='x'?bounce.y>CUT+.3&&bounce.y<H-CUT-.3:
      bounce.x>CUT+.3&&bounce.x<SIDE_L-.3||bounce.x>SIDE_R+.3&&bounce.x<W-CUT-.3;
    if(!solid)return null;
    return {bounce,distance:Math.hypot(bounce.x-from.x,bounce.y-from.y)+Math.hypot(to.x-bounce.x,to.y-bounce.y)};
  }
  function masterAttackOptions(targets,kind=null){
    const c=cue(),options=[];
    for(const target of targets)for(let pocket=0;pocket<6;pocket++){
      const p=pocketAim(pocket),direct=Math.hypot(p.x-target.x,p.y-target.y);
      for(const wall of AI_WALLS){
        if(kind!=='kick'){
          const route=reflectedLeg(target,p,wall);
          if(route&&lineClear(target.x,target.y,route.bounce.x,route.bounce.y,[0,target.n])&&lineClear(route.bounce.x,route.bounce.y,p.x,p.y,[0,target.n])){
            const length=Math.hypot(route.bounce.x-target.x,route.bounce.y-target.y),nx=(route.bounce.x-target.x)/length,ny=(route.bounce.y-target.y)/length;
            const gx=target.x-2*R*nx,gy=target.y-2*R*ny,cd=Math.hypot(gx-c.x,gy-c.y),cos=((gx-c.x)*nx+(gy-c.y)*ny)/cd;
            if(gx>R&&gx<W-R&&gy>R&&gy<H-R&&cos>.3&&lineClear(c.x,c.y,gx,gy,[0,target.n]))options.push({target:target.n,pocket,type:'bank',banks:1,rail:wall.id,aim:Math.atan2(gy-c.y,gx-c.x),cd,pd:route.distance,cos,score:route.distance*.8+cd*.3+(1-cos)*55+14});
          }
        }
        if(kind!=='bank'&&direct>.1&&lineClear(target.x,target.y,p.x,p.y,[0,target.n])){
          const nx=(p.x-target.x)/direct,ny=(p.y-target.y)/direct,ghost={x:target.x-2*R*nx,y:target.y-2*R*ny};
          const route=reflectedLeg(c,ghost,wall);
          if(!route||!lineClear(c.x,c.y,route.bounce.x,route.bounce.y,[0,target.n])||!lineClear(route.bounce.x,route.bounce.y,ghost.x,ghost.y,[0,target.n]))continue;
          const length=Math.hypot(ghost.x-route.bounce.x,ghost.y-route.bounce.y),cos=((ghost.x-route.bounce.x)*nx+(ghost.y-route.bounce.y)*ny)/length;
          if(cos>.3)options.push({target:target.n,pocket,type:'kick',banks:1,rail:wall.id,aim:Math.atan2(route.bounce.y-c.y,route.bounce.x-c.x),cd:route.distance,pd:direct,cos,score:direct*.8+route.distance*.3+(1-cos)*55+20});
        }
      }
    }
    return options.sort((a,b)=>a.score-b.score);
  }
  function validTacticalRoute(plan,result){
    const hits=result.cushionHits||[];
    if((plan.type==='bank'||plan.type==='kick')&&!result.potted)return false;
    return plan.type==='bank'?hits.some(h=>h.n===plan.target&&!h.jaw):plan.type==='kick'?hits.some(h=>h.n===0&&h.beforeFirstHit&&!h.jaw):true;
  }
  function plausibleAttackAttempt(plan,result){
    // Accept a genuine attacking miss close to the intended mouth when no
    // nominal pot exists. A legal nudge that never approaches a bag is safety.
    if(!result.safe||result.firstHit!==plan.target||result.potApproach>7||plan.pd-result.potApproach<1)return false;
    const hits=result.cushionHits||[];
    return plan.type==='bank'?hits.some(h=>h.n===plan.target&&!h.jaw):plan.type==='kick'?hits.some(h=>h.n===0&&h.beforeFirstHit&&!h.jaw):true;
  }
  async function searchMasterAttacks(targets,isCurrent,kind=null,attempts=null){
    const options=masterAttackOptions(targets,kind),success=[];let trials=0;
    const selected=diverseAIOptions(options,kind?12:10);
    for(const option of selected){
      const contact=Math.sqrt(2*ROLL_DECEL*(option.pd+9))/.72/(.97*option.cos)*(option.type==='bank'?1.38:1.1);
      const desired=Math.sqrt(contact*contact+2*ROLL_DECEL*option.cd)/.72*(option.type==='kick'?1.3:1);option.desiredSpeed=desired;
      // Geometry only proposes a route: search rail loss/throw/English corrections.
      for(const factor of [.95,1.15,1.4])for(const offset of [-.03,-.015,-.005,0,.005,.015,.03]){
        if(!isCurrent())return null;
        const plan={...option,aim:option.aim+offset,power:powerForSpeed(desired*factor),spinX:0,spinY:0,trackPotApproach:!!attempts};
        const result=simulateAIShot(plan);
        if(result.safe&&(result.potted||result.winning)&&validTacticalRoute(plan,result))success.push({...plan,winning:result.winning,positionCost:aiPositionScore(result),score:option.score+aiPositionScore(result)+plan.power*.08,tacticalVerified:true});
        else if(attempts&&plausibleAttackAttempt(plan,result))attempts.push({...plan,score:option.score+result.potApproach*18,attackAttempt:true});
        if(++trials%4===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(success.length>=8)break;
    }
    if(success.length<3)for(const option of selected.slice(0,4))for(const spinX of [-.65,.65])for(const offset of [-.1,-.05,0,.05,.1]){
      if(!isCurrent())return null;
      const plan={...option,aim:option.aim+offset+spinX*.018,power:powerForSpeed((option.desiredSpeed||90)*1.1),spinX,spinY:0},result=simulateAIShot(plan);
      if(result.safe&&result.potted&&validTacticalRoute(plan,result))success.push({...plan,score:option.score+aiPositionScore(result)+plan.power*.08,positionCost:aiPositionScore(result),tacticalVerified:true});
      if(++trials%4===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    // Refine promising routes with genuine side English, rather than a cue-only boost.
    for(const base of success.slice().sort((a,b)=>a.score-b.score).slice(0,3))for(const spinX of [-.65,-.3,.3,.65]){
      if(!isCurrent())return null;
      const plan=spinVariant(base,spinX,0),result=simulateAIShot(plan);
      if(result.safe&&(result.potted||result.winning)&&validTacticalRoute(plan,result))success.push({...plan,score:base.score-(base.positionCost||0)+masterPositionScore(result),positionCost:masterPositionScore(result),positionPlanned:true});
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return success.sort((a,b)=>a.score-b.score);
  }
  async function rankTacticalShots(plans,isCurrent){
    const tested=[];
    for(const base of plans.slice(0,12)){
      if(!isCurrent())return null;
      let robust=0;
      for(const sign of [-1,1])for(const powerSign of [-1,1]){
        const plan={...base,aim:Math.round((base.aim+sign*.00052)*180/Math.PI*100)/100*Math.PI/180,power:clamp(Math.round(base.power*(1+powerSign*.015)),8,100)};
        const result=simulateAIShot(plan);
        if(result.safe&&result.potted&&validTacticalRoute(plan,result))robust++;
      }
      tested.push({...base,score:base.score+(4-robust)*25,robustness:robust/4});
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return tested.sort((a,b)=>b.robustness-a.robustness||a.score-b.score);
  }
  function exposedContactFraction(balls,c,target){
    const distance=Math.hypot(target.x-c.x,target.y-c.y);
    if(distance<=2*R+.01)return 1;
    const angle=Math.atan2(target.y-c.y,target.x-c.x),half=Math.asin(Math.min(1,2*R/distance));
    let exposed=0;
    for(const fraction of [-.98,-.75,-.5,-.25,0,.25,.5,.75,.98]){
      const direction=angle+half*fraction,dx=Math.cos(direction),dy=Math.sin(direction);
      const along=(target.x-c.x)*dx+(target.y-c.y)*dy;
      const lateral2=distance*distance-along*along;
      const entry=along-Math.sqrt(Math.max(0,4*R*R-lateral2));
      if(lineClearIn(balls,c.x,c.y,c.x+dx*entry,c.y+dy*entry,[0,target.n],0))exposed++;
    }
    return exposed/9;
  }
  function safetyPosition(result){
    const balls=result.balls.filter(b=>!b.pocketed),c=balls.find(b=>b.n===0),objects=balls.filter(b=>b.n!==0);
    const opponentGroup=state.groups[1-state.turn];
    const targets=targetsInLayout(balls,1-state.turn,opponentGroup);
    if(!targets.length)return {score:0,blocked:false,threat:0,exposure:0,visible:0};
    let threat=0,visible=0,exposure=0;
    for(const target of targets){
      const fraction=exposedContactFraction(balls,c,target);exposure+=fraction;if(fraction>0)visible++;
      for(let pocket=0;pocket<6;pocket++){
        const p=pocketAim(pocket),pd=Math.hypot(p.x-target.x,p.y-target.y);
        if(pd<.1||!lineClearIn(balls,target.x,target.y,p.x,p.y,[0,target.n]))continue;
        const nx=(p.x-target.x)/pd,ny=(p.y-target.y)/pd,gx=target.x-2*R*nx,gy=target.y-2*R*ny;
        const cd=Math.hypot(gx-c.x,gy-c.y),cos=((gx-c.x)*nx+(gy-c.y)*ny)/Math.max(cd,.01);
        if(gx<R||gx>W-R||gy<R||gy>H-R||cos<.28||!lineClearIn(balls,c.x,c.y,gx,gy,[0,target.n]))continue;
        threat=Math.max(threat,cos*Math.exp(-pd/65-cd/100));
      }
    }
    const distance=targets.length?Math.min(...targets.map(b=>Math.hypot(c.x-b.x,c.y-b.y))):W;
    return {score:threat*180+exposure/Math.max(1,targets.length)*80-distance*.35-(visible===0?55:0),blocked:visible===0,threat,exposure,visible};
  }
  async function refineMasterDefence(plans,isCurrent){
    const candidates=plans.slice(0,6),refined=[];let count=0;
    defenceRefinement:for(const base of candidates)for(const [spinX,spinY] of MASTER_SPINS.slice(0,15))for(const factor of [.72,1,1.2]){
      if(!isCurrent())return null;
      const plan=spinVariant(base,spinX,spinY,factor),result=simulateAIShot(plan);
      if(result.safe){const position=safetyPosition(result);refined.push({...plan,type:position.blocked?'snooker':'safety',score:position.score+plan.power*.025,snookerPlanned:position.blocked,opponentExposure:position.exposure,description:`先碰 ${plan.target} 号 · ${strokeName(plan)} · ${position.blocked?'藏白球做斯诺克':position.threat<.15?'拉开球距限制进攻':'控制对手进攻角度'}`});}
      if(++count%4===0)await new Promise(resolve=>setTimeout(resolve,0));
      if(count>=216)break defenceRefinement;
    }
    const ranked=refined.sort((a,b)=>a.score-b.score).slice(0,12);
    for(const plan of ranked){
      let stable=0;
      for(const sign of [-1,1])for(const factor of [.985,1.015]){
        if(!isCurrent())return null;
        const result=simulateAIShot({...plan,aim:Math.round((plan.aim+sign*.00052)*180/Math.PI*100)/100*Math.PI/180,power:clamp(Math.round(plan.power*factor),8,100)});
        if(result.safe&&safetyPosition(result).blocked)stable++;
      }
      plan.snookerRobustness=stable/4;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return ranked.sort((a,b)=>b.snookerRobustness-a.snookerRobustness||a.score-b.score);
  }
  function escapeRoutes(c,target){
    const walls=[{axis:'x',value:R},{axis:'x',value:W-R},{axis:'y',value:R},{axis:'y',value:H-R}];
    const reflect=(p,w)=>({...p,[w.axis]:2*w.value-p[w.axis]});
    const routes=[{...target,banks:0}];
    for(const wall of walls)routes.push({...reflect(target,wall),banks:1});
    // Unfold two successive cushions. The live simulator verifies the actual
    // rail order, cut-outs and blockers; mirrored geometry only proposes aims.
    for(const first of walls)for(const second of walls){
      if(first===second)continue;
      routes.push({...reflect(reflect(target,second),first),banks:2});
    }
    return routes.map(p=>({...p,distance:Math.hypot(p.x-c.x,p.y-c.y)})).sort((a,b)=>a.distance-b.distance);
  }
  function placeAICue(targets){
    // Ball in hand: align behind an unobstructed pot instead of placing next
    // to the first numbered ball regardless of its path to the pocket.
    const options=[];
    for(const target of targets)for(let pocket=0;pocket<6;pocket++){
      const p=pocketAim(pocket),pd=Math.hypot(p.x-target.x,p.y-target.y);
      if(pd<.1||!lineClear(target.x,target.y,p.x,p.y,[0,target.n]))continue;
      for(const distance of [12,18,8]){
        const x=target.x-(p.x-target.x)/pd*distance,y=target.y-(p.y-target.y)/pd*distance;
        if(validCuePosition(x,y)&&lineClear(x,y,target.x,target.y,[0,target.n]))options.push({x,y,score:pd+Math.abs(distance-12)});
      }
    }
    options.sort((a,b)=>a.score-b.score);
    if(options.length){cue().x=options[0].x;cue().y=options[0].y;return;}
    for(let y=R+2;y<H-R;y+=4)for(let x=R+2;x<W-R;x+=4)if(validCuePosition(x,y)){cue().x=x;cue().y=y;return;}
  }
  function diverseAIOptions(options,limit=12){
    const selected=[],seen=new Set();
    for(const option of options){
      const key=option.target+':'+option.pocket;
      if(!seen.has(key)){selected.push(option);seen.add(key);if(selected.length===limit)return selected;}
    }
    for(const option of options)if(!selected.includes(option)){selected.push(option);if(selected.length===limit)break;}
    return selected;
  }
  async function searchEscape(targets,isCurrent){
    const c=cue(),tested=[],safe=[];
    let count=0;
    const test=plan=>{
      const result=simulateAIShot({...plan,trackApproach:true});
      const fallback=(result.legal?100:300+Math.sqrt(result.closestApproach))+(result.scratch?500:0);
      const score=result.safe?safetyPosition(result).score+plan.power*.025:fallback;
      const candidate={...plan,target:result.legal?result.firstHit:plan.target,score,result};
      tested.push(candidate);if(result.safe)safe.push(candidate);
    };
    // A bounded all-angle search catches routes missed by mirrored targets,
    // including three-cushion escapes and changes caused by cushion loss.
    const base=Math.atan2(targets[0].y-c.y,targets[0].x-c.x);
    for(let i=0;i<aiLevel().escapeAngles;i++)for(const power of [38,64,94]){
      if(!isCurrent())return null;
      test({target:targets[0].n,pocket:null,aim:base+i*2*Math.PI/aiLevel().escapeAngles,power,spinY:0,type:'escape'});
      if(++count%6===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(!safe.length){
      const seeds=tested.sort((a,b)=>a.score-b.score).slice(0,state.aiDifficulty==='easy'?1:4);
      for(const seed of seeds)for(const offset of [-2,-1,-.5,.5,1,2])for(const factor of [.8,1,1.15]){
        if(!isCurrent())return null;
        test({target:seed.target,pocket:null,aim:seed.aim+offset*Math.PI/180,power:clamp(seed.power*factor,8,100),spinY:0,type:'escape'});
        if(++count%6===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    if(state.aiDifficulty==='hard'&&!safe.length){
      for(const seed of tested.sort((a,b)=>a.score-b.score).slice(0,4))for(const spinX of [-.65,.65])for(const offset of [-.03,0,.03])for(const factor of [.85,1.15]){
        if(!isCurrent())return null;
        test({...seed,aim:seed.aim+offset+spinX*.018,power:clamp(seed.power*factor,8,100),spinX,spinY:0,type:'escape'});
        if(++count%4===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    const best=(safe.length?safe:tested).sort((a,b)=>a.score-b.score)[0];
    if(!best)return null;
    const {result,...plan}=best;
    plan.description=result.safe?`先碰 ${plan.target} 号 · 碰库勾球解围 · ${strokeName(plan)} · 控制落点`:
      result.legal&&!result.scratch?`尝试解球 · 先碰 ${plan.target} 号，仍有无碰库犯规风险`:
      '解球困难 · 已比较碰库线路，当前仍有犯规风险';
    return plan;
  }
  async function chooseAIPlan(isCurrent=()=>true){
    const targets=aiTargets();if(!targets.length||!isCurrent())return null;
    if(state.ballInHand)placeAICue(targets);
    const successful=[],attempts=[];let attackTrials=0;
    for(const option of diverseAIOptions(aiOptions(targets),aiLevel().options)){
      if(!isCurrent())return null;
      const contact=Math.sqrt(2*ROLL_DECEL*(option.pd+7))/.72/(.97*option.cos);
      const desired=Math.sqrt(contact*contact+2*ROLL_DECEL*option.cd)/.72;
      const correction=.055*2*R/(Math.max(option.cd,4)*option.cos);
      for(const factor of [.88,1,1.15])for(const offset of [0,-correction*.5,correction*.5,-correction,correction]){
        if(!isCurrent())return null;
        const plan={...option,aim:option.aim+offset,power:powerForSpeed(desired*factor),spinY:0,type:'attack',trackPotApproach:state.aiDifficulty==='hard'};
        let result=simulateAIShot(plan);
        if((result.potted||result.winning)&&!result.safe){plan.spinY=-.65;result=simulateAIShot(plan);}
        if(result.safe&&(result.potted||result.winning))successful.push({...plan,winning:result.winning,score:option.score+aiPositionScore(result)+plan.power*.08,positionCost:aiPositionScore(result)});
        else if(state.aiDifficulty==='hard'&&plausibleAttackAttempt(plan,result))attempts.push({...plan,score:option.score+result.potApproach*18,attackAttempt:true});
        if(++attackTrials%2===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(state.aiDifficulty==='hard'&&(!successful.length||Math.min(...successful.map(p=>p.score))>60||Math.min(...successful.map(p=>p.realismRisk||0))>12)){
      const tactical=await searchMasterAttacks(targets,isCurrent,null,attempts);if(!isCurrent())return null;successful.push(...tactical);
    }
    successful.sort((a,b)=>a.score-b.score);
    if(successful.length){
      // Test small input variations before ranking finalists. Difficulty
      // changes choice among validated shots, never the launch physics.
      let finalists=successful.slice(0,state.aiDifficulty==='easy'?3:state.aiDifficulty==='hard'?18:6);
      if(state.aiDifficulty==='hard'){const refined=await refineMasterPosition(finalists,isCurrent);if(!refined)return null;if(refined.length)finalists=refined.slice(0,6);}
      for(const plan of finalists){
        let robust=0;
        for(const sign of [-1,1])for(const powerSign of (state.aiDifficulty==='hard'?[-1,1]:[sign])){
          if(!isCurrent())return null;
          const perturbation=state.aiDifficulty==='hard'?.0021:.0015;
          const result=simulateAIShot({...plan,aim:plan.aim+sign*perturbation,power:clamp(Math.round(plan.power*(1+powerSign*.015)),8,100)});
          if(result.safe&&(result.potted||result.winning)&&validTacticalRoute(plan,result))robust++;
        }
        const checks=state.aiDifficulty==='hard'?4:2;
        plan.score+=(checks-robust)*12;plan.robustness=robust/checks;
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      finalists.sort((a,b)=>a.score-b.score);
      const margin=state.aiDifficulty==='easy'?20:state.aiDifficulty==='normal'?5:0;
      const pool=finalists.filter(p=>p.score<=finalists[0].score+margin);
      const best=pool[Math.floor(Math.random()*pool.length)];
      // Stability ranks attacks; it never replaces an available pot with a
      // snooker. Master keeps its offensive intent on difficult opportunities.
      best.description=best.winning?'决胜出杆 · 尝试打进决胜球':`${best.target} 号 → ${POCKETS[best.pocket].name} · ${best.type==='bank'?'翻袋 · ':best.type==='kick'?'碰库勾球 · ':''}${strokeName(best)}${best.positionPlanned?' · 留下一杆角度':''}`;
      return executeAIPlan(best);
    }
    if(state.aiDifficulty==='hard'&&attempts.length){
      const best=attempts.sort((a,b)=>a.score-b.score)[0];
      best.description=`主动尝试进攻 · ${best.target} 号 → ${POCKETS[best.pocket].name} · ${best.type==='bank'?'翻袋 · ':best.type==='kick'?'碰库勾球 · ':''}${strokeName(best)}`;
      return executeAIPlan(best);
    }
    return executeAIPlan(await chooseAIDefence(targets,isCurrent));
  }
  async function chooseAIDefence(targets,isCurrent){
    const c=cue(),defence=[];
    let trials=0;
    // Keep the mirrored search bounded; reserve a separate budget for the
    // broad escape search instead of falling back to a blocked straight aim.
    defenceSearch:for(const target of targets){
      for(const route of escapeRoutes(c,target)){
        if(route.banks>aiLevel().maxBanks)continue;
        const baseAim=Math.atan2(route.y-c.y,route.x-c.x);
        const contactPower=powerForSpeed(Math.sqrt(2*ROLL_DECEL*(route.distance+9))/.72*(1+route.banks*.2));
        for(const offset of [0,-1.35*R,1.35*R])for(const factor of [.9,1.2,1.5]){
          if(!isCurrent())return null;
          const plan={target:target.n,pocket:null,aim:baseAim+Math.atan2(offset,route.distance),power:clamp(contactPower*factor,15,95),spinY:0,type:'safety',banks:route.banks};
          const result=simulateAIShot(plan);trials++;
          if(result.safe){
            const position=safetyPosition(result);
            defence.push({...plan,score:position.score+plan.power*.035+route.banks*.5,description:`先碰 ${target.n} 号 · ${route.banks?`${route.banks} 库解球`:'薄球防守'} · ${position.blocked?'藏白球，挡住对手首碰线':position.threat<.15?'拉开球距，压缩进攻空间':'避开白球落袋，控制落点'}`});
          }
          if(trials>=216)break defenceSearch;
        }
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(defence.length>=24)break;
    }
    defence.sort((a,b)=>a.score-b.score);
    if(defence.length){
      if(state.aiDifficulty==='hard'){const refined=await refineMasterDefence(defence,isCurrent);if(!refined)return null;if(refined.length)return refined[0];}
      return defence[0];
    }
    return await searchEscape(targets,isCurrent);
  }
  async function chooseAITechnique(kind,isCurrent=()=>true){
    const targets=aiTargets();if(!targets.length)return null;
    if(kind==='snooker')return executeAIPlan(await chooseAIDefence(targets,isCurrent));
    const plans=await searchMasterAttacks(targets,isCurrent,kind);if(!plans?.length||!isCurrent())return null;
    const refined=await refineMasterPosition(plans,isCurrent);if(!refined||!isCurrent())return null;
    const ranked=await rankTacticalShots(refined.length?refined:plans,isCurrent);if(!ranked||!isCurrent())return null;
    const best=ranked[0];
    best.description=`${best.target} 号 → ${POCKETS[best.pocket].name} · ${kind==='bank'?'翻袋':'碰库勾球'} · ${strokeName(best)}`;
    return executeAIPlan(best);
  }
  function showAIStroke(plan){
    if(!plan)return;state.aim=plan.aim;state.power=plan.power;state.spinX=plan.spinX||0;state.spinY=plan.spinY||0;
    syncPowerUI();moveSpinDot();updateUI();
  }
  async function queueAI() {
    if(state.opponent!=='ai'||state.turn!==1||state.phase!=='aim')return;
    const ticket=++state.aiTicket,isCurrent=()=>ticket===state.aiTicket&&state.opponent==='ai'&&state.turn===1&&state.phase==='aim';
    state.aiThinking=true;state.aiPlan=null;say('电脑正在判断球路…');render();
    const plan=await chooseAIPlan(isCurrent);
    if(!isCurrent()||!plan)return;
    state.aiPlan=plan;showAIStroke(plan);say(`电脑计划：${plan.description}`);render();
    // Show the selected ball and pocket for a full 2.5 seconds before shooting.
    setTimeout(()=>{
      if(!isCurrent())return;
      state.aiThinking=false;state.ballInHand=false;state.aim=plan.aim;state.power=plan.power;
      state.spinX=plan.spinX||0;state.spinY=plan.spinY||0;moveSpinDot();syncPowerUI();updateUI();fire(true,true);
    },2500);
  }
  function validCuePosition(x,y) {
    return x>=R&&x<=(state.breaking?HEAD_LINE:W-R)&&y>=R&&y<=H-R&&activeBalls().every(b=>Math.hypot(b.x-x,b.y-y)>=2*R+.06);
  }
  function placeCue(x,y,commit=true) {
    x=clamp(x,R,state.breaking?HEAD_LINE:W-R);y=clamp(y,R,H-R);
    if(!validCuePosition(x,y))return false;
    cue().x=x;cue().y=y;
    if(commit){state.ballInHand=false;say(`白球已摆放。${actor(state.turn)}请瞄准击球。`);updateUI();}
    render();return true;
  }
  function physicsStep(balls,dt,animate=false){
    const topSpeed=Math.max(0,...balls.filter(b=>!b.pocketed).map(b=>Math.hypot(b.vx,b.vy)));
    const subdivisions=clamp(Math.ceil(topSpeed*dt/(R*.45)),1,8),subdt=dt/subdivisions;
    for(let sub=0;sub<subdivisions;sub++){
      const moving=balls.filter(b=>!b.pocketed);
      for(const b of moving){
        clothStep(b,subdt);
        if(animate){advanceBallOrientation(b,subdt);const speed=Math.hypot(b.rollVx,b.rollVy);if(speed>.01){b.roll+=speed*subdt/R;b.rollHeading=Math.atan2(b.rollVy,b.rollVx);}}
        b.x+=b.vx*subdt;b.y+=b.vy*subdt;rails(b);pocketCheck(b);
      }
      for(let i=0;i<moving.length;i++)for(let j=i+1;j<moving.length;j++)if(!moving[i].pocketed&&!moving[j].pocketed)ballsCollide(moving[i],moving[j]);
    }
  }
  function ballsSettled(balls){return balls.every(b=>b.pocketed||Math.hypot(b.vx,b.vy)<.12&&Math.hypot(b.rollVx,b.rollVy)<.12&&Math.abs(b.spin)<.12);}
  let displayGuideKey='',displayGuideCache=null;
  function firstBallOnRay(x,y,dx,dy,excluded){
    let hit=null,distance=Infinity;
    for(const b of state.balls){
      if(b.pocketed||excluded.includes(b.n))continue;
      const along=(b.x-x)*dx+(b.y-y)*dy;
      if(along<=0)continue;
      const side2=(b.x-x)**2+(b.y-y)**2-along*along;
      if(side2>(2*R)**2)continue;
      const t=Math.max(0,along-Math.sqrt(Math.max(0,(2*R)**2-side2)));
      if(t<distance){hit=b;distance=t;}
    }
    return {ball:hit,distance};
  }
  function firstBoundaryOnRay(x,y,dx,dy){
    let distance=Infinity;
    for(const [component,edge,direction,outward] of [[x,R,dx,-1],[x,W-R,dx,1],[y,R,dy,-1],[y,H-R,dy,1]]){
      if(Math.abs(direction)<1e-8)continue;
      const t=(edge-component)/direction;
      if((t>1e-6||Math.abs(t)<=1e-6&&direction*outward>0)&&t<distance)distance=Math.max(0,t);
    }
    return Number.isFinite(distance)?distance:0;
  }
  function pathLength(points){let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);return length;}
  function trimGuidePath(points,maxLength){
    if(points.length<2)return points;
    const trimmed=[points[0]];let length=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],segment=Math.hypot(b.x-a.x,b.y-a.y);
      if(length+segment<=maxLength){trimmed.push(b);length+=segment;continue;}
      const fraction=(maxLength-length)/Math.max(segment,1e-9);
      trimmed.push({x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction});break;
    }
    return trimmed;
  }
  function displayGuide(){
    const guidePower=state.guidePowerLock??state.power;
    const key=[state.aim,guidePower,state.spinX,state.spinY,state.breaking,...state.balls.flatMap(b=>[b.n,b.x,b.y,b.vx,b.vy,b.rollVx,b.rollVy,b.spin,b.pocketed?1:0])].join(',');
    if(key===displayGuideKey)return displayGuideCache;
    displayGuideKey=key;
    const liveCue=cue();if(!liveCue)return displayGuideCache=null;
    const balls=state.balls.map(b=>({...b,q:[...b.q]})),c=balls.find(b=>b.n===0);
    const previous=physicsContext,events={firstHit:null,pocketed:[],railAfterHit:false,breakRails:new Set(),captureContacts:true,contacts:[],cushionHits:[]};
    const shotPath=[{x:c.x,y:c.y}],cuePath=[],targetPath=[];
    const point=(path,x,y,force=false)=>{const last=path.at(-1);if(force||!last||Math.hypot(x-last.x,y-last.y)>.025)path.push({x,y});};
    const moved=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    let target=null,contact=null,cueDone=false,targetDone=false;
    let cueTravel=0,targetTravel=0,preTravel=0,cueRails=0,targetRails=0,preRails=0,firstContacts=0;
    let lastCue={x:c.x,y:c.y},lastTarget=null;
    try{
      physicsContext=events;applyCueImpulse(c,guidePower,state.aim,state.spinX,state.spinY,state.breaking);
      for(let i=0;i<5400;i++){
        const contactsBefore=events.contacts.length,hitsBefore=events.cushionHits.length;
        const beforeCue={x:c.x,y:c.y},beforeTarget=target?{x:target.x,y:target.y}:null;
        physicsStep(balls,STEP);
        const newHits=events.cushionHits.slice(hitsBefore),newContacts=events.contacts.slice(contactsBefore);
        if(!target){
          preTravel+=moved(beforeCue,c);
          for(const hit of newHits.filter(h=>h.n===0)){point(shotPath,hit.x,hit.y,true);preRails++;}
          if(events.firstHit!==null){
            target=balls.find(b=>b.n===events.firstHit);contact=events.contacts.find(e=>e.a===0||e.b===0);
            const cueContact=contact?(contact.a===0?contact.afterA:contact.afterB):c;
            const targetContact=contact?(contact.a===0?contact.afterB:contact.afterA):target;
            point(shotPath,cueContact.x,cueContact.y,true);
            point(cuePath,cueContact.x,cueContact.y,true);
            point(targetPath,targetContact.x,targetContact.y,true);
            lastCue={x:cueContact.x,y:cueContact.y};lastTarget={x:targetContact.x,y:targetContact.y};
            firstContacts=events.contacts.length;
          }else if(c.pocketed||preRails>=3||preTravel>=235||ballsSettled(balls)){
            point(shotPath,c.x,c.y,true);break;
          }
        }else{
          cueTravel+=moved(beforeCue,c);targetTravel+=moved(beforeTarget,target);
          for(const hit of newHits){
            if(hit.n===0&&!cueDone){point(cuePath,hit.x,hit.y,true);if(++cueRails>=3)cueDone=true;}
            if(hit.n===target.n&&!targetDone){point(targetPath,hit.x,hit.y,true);if(++targetRails>=3)targetDone=true;}
          }
          const secondary=events.contacts.slice(firstContacts);
          const blocked=n=>secondary.some(h=>h.a===n||h.b===n);
          if(!cueDone&&(c.pocketed||blocked(0)||cueTravel>=8||Math.hypot(c.vx,c.vy)<.01&&Math.hypot(c.rollVx,c.rollVy)<.01)){
            point(cuePath,c.x,c.y,true);cueDone=true;
          }
          if(!targetDone&&(target.pocketed||blocked(target.n)||targetTravel>=11||Math.hypot(target.vx,target.vy)<.01&&Math.hypot(target.rollVx,target.rollVy)<.01)){
            point(targetPath,target.x,target.y,true);targetDone=true;
          }
          if(cueDone&&targetDone||ballsSettled(balls))break;
        }
      }
    }finally{physicsContext=previous;}
    if(target){if(!cueDone)point(cuePath,c.x,c.y,true);if(!targetDone)point(targetPath,target.x,target.y,true);}
    const objectCenter=target?(contact?(contact.a===0?contact.afterB:contact.afterA):target):null;
    // The guide ends at the first cushion. Keep the later physics trial only
    // for internal reachability; never draw a rebound segment after a rail.
    const directTarget=target&&preRails===0,oneSegment=path=>path.length>1?path.slice(0,2):path;
    return displayGuideCache={shotPath:oneSegment(shotPath),cuePath:directTarget?oneSegment(trimGuidePath(cuePath,8)):[],targetPath:directTarget?oneSegment(trimGuidePath(targetPath,11)):[],objectCenter:directTarget&&objectCenter?{x:objectCenter.x,y:objectCenter.y}:null,targetNumber:directTarget?target.n:null,shotBlocked:!directTarget,physicsBased:true,straight:true,railCount:preRails};
  }
  function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function fillRect(x,y,w,h,r,color){ctx.fillStyle=color;roundedRect(x,y,w,h,r);ctx.fill();}
  let tableBackdrop=null;
  function drawTable(){
    if(!tableBackdrop){
      const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;
      const screenContext=ctx;ctx=layer.getContext('2d');ctx.setTransform(PIXEL_RATIO,0,0,PIXEL_RATIO,0,0);
      try{paintTable();tableBackdrop=layer;}finally{ctx=screenContext;}
    }
    ctx.drawImage(tableBackdrop,0,0,VIEW_W,VIEW_H);
  }
  function drawChengyuEmblem(x,y,scale=1,alpha=1){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=alpha;
    ctx.strokeStyle='#d8efe8';ctx.lineCap='round';ctx.lineJoin='round';
    for(let i=0;i<3;i++){
      const d=i*13;ctx.lineWidth=4-i*.55;ctx.beginPath();ctx.moveTo(42-d,-38+d*.28);
      ctx.bezierCurveTo(-5-d,-67+d*.4,-72+d*.5,-14,-44+d*.3,23-d*.2);
      ctx.bezierCurveTo(-18,54-d*.65,29-d*.35,35-d*.5,50-d,9-d*.18);ctx.stroke();
    }
    ctx.fillStyle='#e8f4e9';ctx.beginPath();ctx.ellipse(43,-26,4.5,7,-.5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#dbb778';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(16,29);ctx.bezierCurveTo(46,49,64,28,64,6);ctx.stroke();ctx.restore();
  }
  function paintTable(){
    const l=OX,t=OY,r=OX+W*SCALE,b=OY+H*SCALE;
    ctx.fillStyle='#090e17';ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.shadowColor='#000b';ctx.shadowBlur=30;ctx.shadowOffsetY=12;
    const frame=ctx.createLinearGradient(0,t-48,0,b+48);
    frame.addColorStop(0,'#8b7962');frame.addColorStop(.08,'#20262c');frame.addColorStop(.48,'#0c1016');frame.addColorStop(.94,'#20262c');frame.addColorStop(1,'#7a6958');
    fillRect(l-50,t-50,W*SCALE+100,H*SCALE+100,30,frame);
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle='#c6a98579';ctx.lineWidth=2;roundedRect(l-48,t-48,W*SCALE+96,H*SCALE+96,29);ctx.stroke();
    fillRect(l-37,t-37,W*SCALE+74,H*SCALE+74,22,'#092c3b');
    const felt=ctx.createRadialGradient(l+W*SCALE*.45,t+H*SCALE*.35,10,l+W*SCALE*.5,t+H*SCALE*.5,690);
    felt.addColorStop(0,'#208b9d');felt.addColorStop(.65,'#147286');felt.addColorStop(1,'#0b5265');
    ctx.fillStyle=felt;ctx.fillRect(l-5,t-5,W*SCALE+10,H*SCALE+10);
    ctx.save();ctx.strokeStyle='#c9eef060';ctx.lineWidth=1.2;ctx.setLineDash([8,7]);
    ctx.beginPath();ctx.moveTo(l+HEAD_LINE*SCALE,t+2);ctx.lineTo(l+HEAD_LINE*SCALE,b-2);ctx.stroke();ctx.restore();
    // Original tide-ribbon print sits beneath the cloth fibres.
    const brandX=l+W*SCALE/2,brandY=t+H*SCALE/2;
    drawChengyuEmblem(brandX,brandY-28,1,.25);
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#def4ee50';
    ctx.font='500 25px "PingFang SC", "Microsoft YaHei", sans-serif';ctx.fillText('澄  域',brandX,brandY+42);
    ctx.fillStyle='#d7efeb39';ctx.font='600 10px Arial, sans-serif';ctx.fillText('C 1   /   T I D E L I N E',brandX,brandY+66);ctx.restore();
    // Sparse fibres are cached, rather than repainting 56,000 per frame.
    let seed=19327;
    for(let i=0;i<9500;i++){
      seed=(seed*1664525+1013904223)>>>0;const x=l+(seed>>>8)%(r-l);
      seed=(seed*1664525+1013904223)>>>0;const y=t+(seed>>>8)%(b-t);
      ctx.fillStyle=i%4?'#d4f5ff09':'#032d480c';ctx.fillRect(x,y,1.1,.45);
    }
    const railWidth=27;
    const rubberPaint=(outerX,outerY,noseX,noseY)=>{
      const paint=ctx.createLinearGradient(outerX,outerY,noseX,noseY);
      paint.addColorStop(0,'#10516c');paint.addColorStop(.30,'#1e8da9');paint.addColorStop(.76,'#14718c');paint.addColorStop(1,'#084456');
      return paint;
    };
    function horizontal(a,z,y,sign){
      const x1=l+a*SCALE,x2=l+z*SCALE,outer=y-sign*railWidth;
      const rubber=rubberPaint(0,outer,0,y);
      ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.lineTo(x2+17,outer);ctx.lineTo(x1-17,outer);ctx.closePath();ctx.fillStyle=rubber;ctx.fill();
      ctx.beginPath();ctx.moveTo(x1,y-sign);ctx.lineTo(x2,y-sign);ctx.strokeStyle='#58bcd055';ctx.lineWidth=2;ctx.stroke();
    }
    for(const [a,z] of [[CUT,SIDE_L],[SIDE_R,W-CUT]]){
      horizontal(a,z,t,1);horizontal(a,z,b,-1);
    }
    for(const x of [l,r]){
      const sign=x===l?-1:1,upper=t+CUT*SCALE,lower=b-CUT*SCALE;
      const rubber=rubberPaint(x+sign*railWidth,0,x,0);
      ctx.beginPath();ctx.moveTo(x,upper);ctx.lineTo(x,lower);ctx.lineTo(x+sign*railWidth,lower+17);ctx.lineTo(x+sign*railWidth,upper-17);ctx.closePath();ctx.fillStyle=rubber;ctx.fill();
      ctx.beginPath();ctx.moveTo(x+sign,upper);ctx.lineTo(x+sign,lower);ctx.strokeStyle='#58bcd055';ctx.lineWidth=2;ctx.stroke();
    }
    // Silver corner caps and middle-pocket brackets match the reference.
    for(const [x,y] of [[l,t],[r,t],[l,b],[r,b]]){
      const sx=x===l?1:-1,sy=y===t?1:-1;
      ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);
      const metal=ctx.createLinearGradient(-33,-33,36,36);
      metal.addColorStop(0,'#edf0ed');metal.addColorStop(.2,'#747e83');metal.addColorStop(.5,'#d0d9dc');metal.addColorStop(.78,'#525e63');metal.addColorStop(1,'#bdc8ca');
      ctx.fillStyle=metal;ctx.beginPath();ctx.moveTo(-34,39);ctx.lineTo(-34,-13);ctx.quadraticCurveTo(-34,-34,-13,-34);ctx.lineTo(39,-34);ctx.lineTo(39,-27);ctx.lineTo(10,-27);ctx.quadraticCurveTo(-27,-27,-27,10);ctx.lineTo(-27,39);ctx.closePath();ctx.fill();ctx.restore();
    }
    for(const y of [t,b]){
      const sy=y===t?-1:1;
      const metal=ctx.createLinearGradient(0,y+sy*28,0,y+sy*46);
      metal.addColorStop(0,'#e4e9e9');metal.addColorStop(.5,'#6d797e');metal.addColorStop(1,'#c3ced0');
      ctx.fillStyle=metal;ctx.fillRect(l+SIDE_L*SCALE-6,Math.min(y+sy*28,y+sy*46),SIDE_MOUTH*SCALE+12,18);
    }
    for(let index=0;index<6;index++){
      const geometry=POCKET_GEOMETRY[index],center=geometry.well,q=worldToScreen(center.x,center.y),radius=geometry.radius*SCALE;
      // Supported shelf remains the same cloth, including at the mouth.
      ctx.beginPath();ctx.arc(q.x,q.y,radius+3.5,0,Math.PI*2);ctx.fillStyle=felt;ctx.fill();
    }
    // Mouth facings are filled continuations of the cushion bevel, with
    // the identical material and width. No separate dark line or capsule.
    for(const p of POCKET_GEOMETRY)for(const face of p.faces){
      const a=worldToScreen(face.ax,face.ay),b=worldToScreen(face.bx,face.by);
      const horizontalFace=Math.abs(face.ay)<1e-6||Math.abs(face.ay-H)<1e-6;
      const offsetX=horizontalFace?(face.ax>p.mx?-17:17):(face.ax<W/2?-railWidth:railWidth);
      const offsetY=horizontalFace?(face.ay<H/2?-railWidth:railWidth):(face.ay>p.my?-17:17);
      ctx.fillStyle=rubberPaint(a.x+offsetX,a.y+offsetY,a.x,a.y);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.quadraticCurveTo(b.x-p.nx*5,b.y-p.ny*5,b.x-p.nx*10,b.y-p.ny*10);ctx.lineTo(a.x+offsetX,a.y+offsetY);ctx.closePath();ctx.fill();
    }
    // Paint only the true falling cap black, after all blue support/cushion
    // pieces. Nothing can shade or paint a fictitious black shelf outside it.
    for(const p of POCKET_GEOMETRY){
      const q=worldToScreen(p.well.x,p.well.y),depth=ctx.createRadialGradient(q.x-2,q.y-3,1,q.x,q.y,p.fallRadius*SCALE);
      depth.addColorStop(0,'#010204');depth.addColorStop(.8,'#020508');depth.addColorStop(1,'#0a1014');
      drawPocketFallPath(p);ctx.fillStyle=depth;ctx.fill();
    }
    ctx.lineCap='butt';
    ctx.fillStyle='#c8d2d2';
    for(let x=12.5;x<=87.5;x+=12.5){if(x===50)continue;for(const y of [t-40,b+40]){ctx.beginPath();ctx.arc(l+x*SCALE,y,1.9,0,Math.PI*2);ctx.fill();}}
    for(let y=12.5;y<=37.5;y+=12.5)for(const x of [l-40,r+40]){ctx.beginPath();ctx.arc(x,t+y*SCALE,1.9,0,Math.PI*2);ctx.fill();}
    // Inset rail nameplate between sight markers, outside the playing cloth.
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    const nameplateX=l+W*SCALE*.3125,nameplateY=b+40;
    ctx.fillStyle='#d8ca91';ctx.font='italic 700 18px Georgia, "Times New Roman", serif';
    ctx.fillText('C1',nameplateX-25,nameplateY+.5);
    ctx.font='600 12px "Songti SC", SimSun, serif';ctx.fillStyle='#c9bd91';
    ctx.fillText('澄域',nameplateX+21,nameplateY+.5);ctx.restore();
  }
  function drawPocketFallPath(p){
    const profile=pocketFallProfile(p),q=worldToScreen(profile.x,profile.y);
    ctx.beginPath();ctx.arc(q.x,q.y,profile.radius*SCALE,profile.angle-profile.halfAngle,profile.angle+profile.halfAngle);ctx.closePath();
  }
  function rotated(q,x,y,z){
    const tx=2*(q[1]*z-q[2]*y),ty=2*(q[2]*x-q[0]*z),tz=2*(q[0]*y-q[1]*x);
    return [x+q[3]*tx+q[1]*tz-q[2]*ty,y+q[3]*ty+q[2]*tx-q[0]*tz,z+q[3]*tz+q[0]*ty-q[1]*tx];
  }
  // 80 texels cover a phone ball even at high DPR; shading far more texels
  // than the displayed diameter was the dominant moving-frame cost.
  const BALL_SPRITE_SIZE=MOBILE_RENDER?80:112,BALL_SPRITE_MID=BALL_SPRITE_SIZE/2,BALL_SPRITE_RADIUS=BALL_SPRITE_SIZE*.476;
  const ballPixelMap=(()=>{
    const cells=[];
    for(let py=0;py<BALL_SPRITE_SIZE;py++)for(let px=0;px<BALL_SPRITE_SIZE;px++){
      const u=(px+.5-BALL_SPRITE_MID)/BALL_SPRITE_RADIUS,v=(py+.5-BALL_SPRITE_MID)/BALL_SPRITE_RADIUS,r2=u*u+v*v;
      if(r2>=1)continue;
      const z=Math.sqrt(1-r2),diffuse=Math.max(0,-u*.39-v*.5+z*.79),light=.49+.55*diffuse;
      const highlight=Math.pow(Math.max(0,-u*.45-v*.59+z*.68),98)*.72;
      const broadHighlight=Math.pow(Math.max(0,-u*.48-v*.57+z*.66),14)*.12;
      // Small overhead reflections make the resin read as polished and dense.
      const pinLight=Math.exp(-(((u+.36)/.065)**2+((v+.43)/.08)**2))*.38;
      const rimBounce=Math.pow(Math.max(0,u*.47+v*.31+z*.26),9)*.095;
      const grain=1+((((px*37+py*71)%17)-8)*.0012);
      const shade=(1-.36*Math.pow(1-z,1.25))*light*grain;
      cells.push([(py*BALL_SPRITE_SIZE+px)*4,u,v,z,shade,255*(highlight+broadHighlight+pinLight+rimBounce),Math.round(255*clamp((1-r2)*BALL_SPRITE_RADIUS*.75,0,1))]);
    }
    return new Float32Array(cells.flat());
  })();
  const numberBadges=new Map();
  function numberBadgePixels(n){
    if(numberBadges.has(n))return numberBadges.get(n);
    const icon=document.createElement('canvas');icon.width=icon.height=96;
    const g=icon.getContext('2d');
    // The reference balls use an ivory, three-lobed number insert with a
    // dark outline. It is painted in the sphere's local coordinates so both
    // colour and number roll together instead of facing the camera forever.
    g.beginPath();g.moveTo(48,6);
    g.bezierCurveTo(62,6,62,26,68,37);
    g.bezierCurveTo(75,49,91,54,88,68);
    g.bezierCurveTo(85,84,71,88,55,82);
    g.bezierCurveTo(49,80,46,80,41,82);
    g.bezierCurveTo(25,89,10,84,8,69);
    g.bezierCurveTo(6,55,20,49,27,37);
    g.bezierCurveTo(33,26,34,6,48,6);g.closePath();
    const shade=g.createRadialGradient(34,24,4,49,56,67);
    shade.addColorStop(0,'#fffef4');shade.addColorStop(.57,'#f1ebd8');shade.addColorStop(1,'#c5bbab');
    g.fillStyle=shade;g.fill();g.strokeStyle='#10151a';g.lineWidth=7;g.lineJoin='round';g.stroke();
    g.strokeStyle='#ffffff80';g.lineWidth=1.3;g.stroke();
    g.fillStyle='#101318';g.font=`900 ${n>9?44:59}px Arial`;
    g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),48,54);
    const pixels=g.getImageData(0,0,96,96).data;
    numberBadges.set(n,pixels);return pixels;
  }
  function renderBallSprite(b){
    const size=BALL_SPRITE_SIZE,mid=BALL_SPRITE_MID,radius=BALL_SPRITE_RADIUS,sprite=b.sprite||document.createElement('canvas');
    if(!b.sprite)sprite.width=sprite.height=size;
    const sc=sprite.getContext('2d'),pixels=b.spritePixels||sc.createImageData(size,size),data=pixels.data;
    const pole=rotated(b.q,0,0,1);
    const badge=b.n>0?numberBadgePixels(b.n):null;
    const right=badge?rotated(b.q,1,0,0):null,up=badge?rotated(b.q,0,1,0):null;
    const cueMarks=b.n===0?[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(v=>rotated(b.q,...v)):null;
    const color=PALETTE[b.n<=8?b.n:b.n-8],ivory=[247,241,229];
    // Flat typed storage avoids allocating an iterator for every shaded texel.
    for(let i=0;i<ballPixelMap.length;i+=7){
      const at=ballPixelMap[i],u=ballPixelMap[i+1],v=ballPixelMap[i+2],z=ballPixelMap[i+3],shade=ballPixelMap[i+4],specular=ballPixelMap[i+5],alpha=ballPixelMap[i+6];
      const signedLatitude=u*pole[0]+v*pole[1]+z*pole[2],latitude=Math.abs(signedLatitude);
      const painted=b.n!==0&&(b.n<=8?latitude<.972:latitude<.52);
      const cueMark=cueMarks?.some(m=>u*m[0]+v*m[1]+z*m[2]>.991);
      const base=cueMark?[184,56,50]:painted?color:ivory;
      let badgeAt=-1,badgeAlpha=0;
      if(badge&&latitude>.69){
        // Project the number inserts from opposite poles onto the sphere.
        const side=signedLatitude<0?-1:1;
        const bx=(u*right[0]+v*right[1]+z*right[2])*side;
        const by=u*up[0]+v*up[1]+z*up[2];
        const tx=Math.round(48+bx*65),ty=Math.round(48+by*65);
        if(tx>=0&&tx<96&&ty>=0&&ty<96){badgeAt=(ty*96+tx)*4;badgeAlpha=badge[badgeAt+3]/255;}
      }
      for(let c=0;c<3;c++){
        const pigment=badgeAlpha?base[c]*(1-badgeAlpha)+badge[badgeAt+c]*badgeAlpha:base[c];
        data[at+c]=Math.min(255,pigment*shade+specular);
      }
      data[at+3]=alpha;
    }
    sc.putImageData(pixels,0,0);
    b.sprite=sprite;b.spritePixels=pixels;b.spriteDirty=false;
  }
  function drawBall(b,scale=1,worldX=b.x,worldY=b.y,alpha=1,shadow=true){
    if(!b.sprite)renderBallSprite(b);
    const {x,y}=worldToScreen(worldX,worldY),rr=DISPLAY_R*SCALE*scale;
    ctx.save();ctx.globalAlpha=alpha;
    const speed=Math.hypot(b.vx,b.vy);
    if(!MOBILE_RENDER&&state.phase==='moving'&&scale===1&&speed>28){
      const trail=Math.min(7,speed*.048),weight=Math.min(.16,speed/900);
      ctx.save();ctx.globalAlpha=alpha*weight;ctx.drawImage(b.sprite,x-rr-b.vx/speed*trail,y-rr-b.vy/speed*trail,rr*2,rr*2);ctx.restore();
    }
    if(shadow){ctx.shadowColor='#00111f9e';ctx.shadowBlur=MOBILE_RENDER?0:5;ctx.fillStyle='#021b2b8a';ctx.beginPath();ctx.ellipse(x+2.3,y+rr*.69,rr*.9,rr*.35,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    ctx.drawImage(b.sprite,x-rr,y-rr,rr*2,rr*2);
    ctx.restore();
  }
  function drawPocketBanks(){
    if(state.mode!=='eight')return;
    for(const [numbers,x,title] of [ [[1,2,3,4,5,6,7],39,'纯 色'],[[9,10,11,12,13,14,15],VIEW_W-39,'花 色'] ]){
      ctx.save();
      fillRect(x-24,196,48,353,18,'#0a1925dc');
      ctx.strokeStyle='#7ad8e56b';ctx.lineWidth=1;roundedRect(x-24,196,48,353,18);ctx.stroke();
      ctx.fillStyle='#a8edf2';ctx.font='700 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(title,x,217);
      for(let i=0;i<numbers.length;i++){
        const n=numbers[i],y=251+i*41,potted=state.balls.find(b=>b.n===n)?.pocketed;
        ctx.fillStyle=potted?'#6cddea5f':'#3e61724d';ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.fill();
        ctx.save();ctx.globalAlpha=potted?1:.42;
        const model=state.balls.find(b=>b.n===n);
        if(model){if(!model.sprite||model.spriteDirty)renderBallSprite(model);ctx.drawImage(model.sprite,x-11,y-11,22,22);}
        ctx.restore();
        if(!potted){ctx.strokeStyle='#acb8ae78';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.stroke();}
      }
      ctx.restore();
    }
  }
  function legalTarget(n){
    if(state.mode==='nine')return n===lowestNine();
    const g=currentGroup();return g?(allGroupGone(g)?n===8:group(n)===g):n!==8;
  }
  function guideLine(x,y,dx,dy,len,color,dashed=false){
    if(len<.2)return;
    const a=worldToScreen(x,y),b=worldToScreen(x+dx*len,y+dy*len);
    ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=9;ctx.lineWidth=2.4;ctx.setLineDash(dashed?[8,7]:[]);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;
  }
  function guidePath(points,color,maxLength=Infinity,dashed=false){
    if(points.length<2)return;
    ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=0;ctx.lineWidth=1.15;ctx.lineCap='round';
    ctx.setLineDash(dashed?[7,6]:[]);ctx.beginPath();
    let length=0,end=points[0];const start=worldToScreen(points[0].x,points[0].y);ctx.moveTo(start.x,start.y);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],segment=Math.hypot(b.x-a.x,b.y-a.y);
      if(segment<1e-6)continue;
      const fraction=Math.min(1,(maxLength-length)/segment);
      end={x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction};
      const next=worldToScreen(end.x,end.y);ctx.lineTo(next.x,next.y);
      length+=segment*fraction;if(length>=maxLength)break;
    }

    ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;
  }
  function drawAim() {
    if(state.phase!=='aim'||state.ballInHand||(state.opponent==='ai'&&state.turn===1&&!state.aiPlan))return;
    const c=cue(),cueX=Math.cos(state.aim),cueY=Math.sin(state.aim),p=worldToScreen(c.x,c.y);
    const prediction=displayGuide(),color=prediction.targetNumber!==null&&!legalTarget(prediction.targetNumber)?'#ff627a':'#e5fff7';
    ctx.save();
    // Draw only the reachable, physically simulated portion of the stroke.
    // Short draw/follow/English paths share the live collision and cloth code.
    ctx.globalAlpha=.65;guidePath(prediction.shotPath,color);
    ctx.globalAlpha=1;guidePath(prediction.shotPath,color,Math.min(18,pathLength(prediction.shotPath)));
    for(const bounce of prediction.shotPath.slice(1,-1)){
      const q=worldToScreen(bounce.x,bounce.y);ctx.fillStyle='#baf8ff';ctx.beginPath();ctx.arc(q.x,q.y,3.1,0,Math.PI*2);ctx.fill();
    }
    if(prediction.targetNumber!==null){
      const hit=prediction.shotPath.at(-1),object=prediction.objectCenter,end=worldToScreen(hit.x,hit.y),objectCenter=worldToScreen(object.x,object.y);
      ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(end.x,end.y,R*SCALE,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=.45;ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(objectCenter.x,objectCenter.y);ctx.stroke();ctx.globalAlpha=1;
      guidePath(prediction.cuePath,'#a0e6ff',8);
      guidePath(prediction.targetPath,color,11);
      for(const bounce of prediction.targetPath.slice(1,-1)){
        const q=worldToScreen(bounce.x,bounce.y);ctx.fillStyle=color;ctx.beginPath();ctx.arc(q.x,q.y,2.7,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();drawCue(c,state.aim,state.power);
  }
  let cueTexture=null;
  function buildCueTexture(){
    // Original HUYING 01: warm maple shaft, graphite butt and two offset
    // copper arcs. No borrowed star/diamond inlays or maker's seal.
    const length=1400,texture=document.createElement('canvas');texture.width=length;texture.height=56;
    const g=texture.getContext('2d'),mid=28;
    g.beginPath();g.moveTo(7,mid-3);g.lineTo(963,mid-9.2);g.lineTo(1390,mid-15.5);
    g.quadraticCurveTo(1399,mid-15.5,1399,mid);g.quadraticCurveTo(1399,mid+15.5,1390,mid+15.5);
    g.lineTo(963,mid+9.2);g.lineTo(7,mid+3);g.closePath();g.save();g.clip();
    const wood=g.createLinearGradient(0,mid-14,0,mid+14);
    for(const [at,color] of [[0,'#795d35'],[.24,'#d3ad6c'],[.48,'#f5dcaa'],[.7,'#c6a065'],[1,'#72542f']])wood.addColorStop(at,color);
    g.fillStyle=wood;g.fillRect(0,0,980,56);
    for(let k=0;k<9;k++){
      g.strokeStyle=k%2?'#5139212b':'#fff4d447';g.lineWidth=.6;
      g.beginPath();g.moveTo(20,mid+(k-4)*.6);g.bezierCurveTo(260,mid+(k-4),640,mid+(k-4)*1.3,978,mid+(k-4)*1.8);g.stroke();
    }
    const graphite=g.createLinearGradient(0,5,0,51);
    for(const [at,color] of [[0,'#080c13'],[.22,'#36404b'],[.48,'#101723'],[.8,'#202936'],[1,'#03070d']])graphite.addColorStop(at,color);
    g.fillStyle=graphite;g.fillRect(978,0,422,56);
    g.fillStyle='#b98857';g.fillRect(970,0,8,56);g.fillRect(995,0,3,56);
    for(let k=0;k<2;k++){
      const x=1065+k*142;g.strokeStyle=k?'#f0cf9e':'#b88452';g.lineWidth=3;
      g.beginPath();g.ellipse(x,mid,52,10,-.16,Math.PI*.18,Math.PI*1.64);g.stroke();
      g.fillStyle='#e5dbca';g.beginPath();g.arc(x+32,mid-6,2,0,Math.PI*2);g.fill();
    }
    g.fillStyle='#d9c3a2';g.font='600 12px Arial';g.textAlign='center';g.fillText('HUYING 01',1295,mid+4);
    g.fillStyle='#b88452';g.fillRect(1363,0,5,56);g.fillStyle='#05090e';g.fillRect(1376,0,24,56);
    g.restore();g.fillStyle='#f0e5ce';g.fillRect(4,mid-3.05,11,6.1);
    g.fillStyle='#487c86';g.beginPath();g.roundRect(0,mid-3.25,4.6,6.5,1.5);g.fill();
    const vertical=document.createElement('canvas');vertical.width=56;vertical.height=length;
    const v=vertical.getContext('2d');v.translate(56,0);v.rotate(Math.PI/2);v.drawImage(texture,0,0);
    $('cueStick').style.backgroundImage=`url(${vertical.toDataURL()})`;return texture;
  }
  function drawCue(c,angle,power,tipGap=null,opacity=1){
    const p=worldToScreen(c.x,c.y);ctx.save();ctx.globalAlpha=opacity;
    const gap=tipGap??R*SCALE+14+power*.4,back=gap+350,butt=back-110;
    ctx.translate(p.x,p.y);ctx.rotate(angle+Math.PI);
    if(cueTexture){ctx.shadowColor='#0009';ctx.shadowBlur=5;ctx.shadowOffsetY=3;ctx.drawImage(cueTexture,gap,-12,350,24);ctx.restore();return;}
    ctx.shadowColor='#00100d99';ctx.shadowBlur=9;ctx.shadowOffsetY=5;
    let g=ctx.createLinearGradient(0,-8,0,8);g.addColorStop(0,'#341c17');g.addColorStop(.28,'#87502d');g.addColorStop(.55,'#b67e43');g.addColorStop(.8,'#633620');g.addColorStop(1,'#241514');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(butt,-5.4);ctx.lineTo(back-3,-8.6);ctx.quadraticCurveTo(back+2,-8.4,back+2,-4);ctx.lineTo(back+2,4);ctx.quadraticCurveTo(back+2,8.4,back-3,8.6);ctx.lineTo(butt,5.4);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    g=ctx.createLinearGradient(0,-6,0,6);g.addColorStop(0,'#8a6742');g.addColorStop(.24,'#e7c693');g.addColorStop(.49,'#fff1c9');g.addColorStop(.79,'#c1955f');g.addColorStop(1,'#755235');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(gap+4,-2.7);ctx.lineTo(butt,-5.4);ctx.lineTo(butt,5.4);ctx.lineTo(gap+4,2.7);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#70442277';ctx.lineWidth=.7;for(const y of [-1.3,1.1]){ctx.beginPath();ctx.moveTo(gap+13,y*.45);ctx.lineTo(butt-7,y);ctx.stroke();}
    for(const d of [butt,butt+6,back-17]){ctx.fillStyle='#d9b870';ctx.fillRect(d,-6,2,12);ctx.fillStyle='#e6e3cb';ctx.fillRect(d+2,-5.6,1,11.2);}
    ctx.fillStyle='#253a3b';ctx.fillRect(back-14,-8.5,10,17);
    ctx.fillStyle='#e8ece2';ctx.fillRect(gap,-3.1,4,6.2);
    ctx.fillStyle='#54a9b2';ctx.beginPath();ctx.roundRect(gap-3,-3.4,3.3,6.8,1.5);ctx.fill();
    ctx.restore();
  }
  function drawStroke(){
    const s=state.stroke;if(!s)return;
    let gap,opacity=1;
    if(s.age<0){const t=clamp((s.age+s.windup)/s.windup,0,1);gap=R*SCALE+(14+s.power*.4)*(1-t*t*t*t);}
    else{const t=clamp(s.age/s.duration,0,1);gap=R*SCALE-(s.power>=42?22:14)*Math.sin(Math.PI*Math.min(1,t*2));opacity=1-t;}
    drawCue(s,s.aim,s.power,gap,opacity);
  }
  function pocketAnimationPose(a){
    const t=clamp(a.age/a.duration,0,1);
    const drop=.5*GRAVITY*a.age*a.age,sink=clamp(drop/(6*R),0,1);
    const fade=clamp((drop-2*R)/(4*R),0,1);
    return {t,sink,x:a.fallX,y:a.fallY,scale:1/(1+drop/(6*R)),alpha:1-fade*fade*(3-2*fade),depth:0,drop};
  }
  function drawPocketFallMask(pocket){
    const profile=pocketFallProfile(pocket),well=worldToScreen(profile.x,profile.y);
    ctx.beginPath();
    // Clip to the same circular cap used by pocket physics. The rail and cloth
    // are never part of this mask, which keeps the sinking sphere below the lip.
    const start=profile.angle-profile.halfAngle,end=profile.angle+profile.halfAngle,radius=Math.max(1,profile.radius*SCALE-2);
    ctx.moveTo(well.x+Math.cos(start)*radius,well.y+Math.sin(start)*radius);ctx.arc(well.x,well.y,radius,start,end);ctx.closePath();
    return {profile,well,start,end,radius};
  }
  function drawPocketEffect(a){
    const pocket=POCKET_GEOMETRY[a.pocket],pose=pocketAnimationPose(a);
    const center=worldToScreen(pose.x,pose.y+pose.depth),rr=DISPLAY_R*SCALE*pose.scale;
    ctx.save();const mouth=drawPocketFallMask(pocket);ctx.clip();
    ctx.globalAlpha=.28*(1-pose.sink);ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(center.x,center.y,rr*1.08,rr*.5,0,0,Math.PI*2);ctx.fill();
    drawBall(a.visual,pose.scale,pose.x,pose.y+pose.depth,pose.alpha,false);
    ctx.globalAlpha=pose.alpha*(.1+.84*pose.sink);
    const shade=ctx.createRadialGradient(center.x-rr*.24,center.y-rr*.28,rr*.08,center.x,center.y,rr*1.08);
    shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(.58,`rgba(0,0,0,${.14+.32*pose.sink})`);shade.addColorStop(1,'rgba(0,0,0,.97)');
    ctx.fillStyle=shade;ctx.beginPath();ctx.arc(center.x,center.y,rr,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.save();ctx.globalAlpha=.82*(1-pose.sink*.7);ctx.strokeStyle='#030608';ctx.lineWidth=5.2;
    ctx.beginPath();ctx.arc(mouth.well.x,mouth.well.y,mouth.radius,mouth.start,mouth.end);ctx.stroke();ctx.restore();
  }
  let tableSurface=null;
  let textureCursor=0;
  function refreshBallTextures(){
    const models=[...live(),...state.pocketAnimations.map(a=>a.visual)];
    let budget=state.phase==='moving'?(MOBILE_RENDER?4:8):models.length;
    for(let i=0;i<models.length;i++){
      const b=models[(textureCursor+i)%models.length];
      if(!b.sprite||(b.spriteDirty&&budget>0)){renderBallSprite(b);budget--;}
    }
    if(models.length)textureCursor=(textureCursor+(MOBILE_RENDER?4:8))%models.length;
  }
  function resizeRenderBuffer(){
    const rect=canvas.getBoundingClientRect();
    const cssWidth=sideways()?rect.height:rect.width,cssHeight=sideways()?rect.width:rect.height;
    if(!cssWidth||!cssHeight)return;
    const ratio=clamp(Math.max(cssWidth/VIEW_W,cssHeight/VIEW_H)*deviceScale,MOBILE_RENDER?1.35:1.5,MOBILE_RENDER?1.8:2);
    if(Math.abs(ratio-PIXEL_RATIO)<.04)return;
    PIXEL_RATIO=ratio;canvas.width=Math.round(VIEW_W*ratio);canvas.height=Math.round(VIEW_H*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);tableSurface=null;tableBackdrop=null;render();
  }
  function render() {
    refreshBallTextures();
    if(!tableSurface){
      drawTable();
      tableSurface=document.createElement('canvas');tableSurface.width=canvas.width;tableSurface.height=canvas.height;
      tableSurface.getContext('2d').drawImage(canvas,0,0);
    }else ctx.drawImage(tableSurface,0,0,VIEW_W,VIEW_H);
    drawAim();for(const b of live())drawBall(b);drawStroke();
    for(const a of state.pocketAnimations){
      drawPocketEffect(a);
    }
    if(state.ballInHand){const c=cue(),p=worldToScreen(c.x,c.y);ctx.strokeStyle='#fff4a3';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(p.x,p.y,24,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    if(state.aiThinking&&state.phase==='aim'&&!state.aiPlan){
      ctx.save();ctx.fillStyle='rgba(5,20,30,.85)';ctx.strokeStyle='rgba(130,234,255,.62)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.roundRect(460,332,480,125,18);ctx.fill();ctx.stroke();
      ctx.fillStyle='#e4faff';ctx.textAlign='center';ctx.font='bold 24px sans-serif';ctx.fillText(state.aiPlan?`电脑 · ${state.aiPlan.type==='bank'?'翻袋进攻':state.aiPlan.type==='kick'?'勾球进攻':state.aiPlan.type==='snooker'?'斯诺克防守':state.aiPlan.type==='attack'?'选择进攻':'选择解球'}`:'电脑正在判断球路',700,373);
      ctx.fillStyle='#a8ecff';ctx.font='17px sans-serif';ctx.fillText(state.aiPlan?.description||'检查遮挡、袋口与白球落点',700,405);
      ctx.fillStyle='#86cbd5';ctx.font='13px sans-serif';ctx.fillText(state.aiPlan?'准备出杆 · 2.5 秒':'正在试算候选路线',700,433);ctx.restore();
    }
  }
  let aimFramePending=false;
  function requestAimFrame(){
    if(aimFramePending)return;
    aimFramePending=true;
    requestAnimationFrame(()=>{aimFramePending=false;if(state.phase==='aim'){updateUI();render();}});
  }
  const sideways=()=>document.getElementById('mobile-pool-preview')?.classList.contains('is-landscape')||false;
  const aimScreenPoint=e=>sideways()?{x:e.clientY,y:-e.clientX}:{x:e.clientX,y:e.clientY};
  function pointerWorld(e){
    const rect=canvas.getBoundingClientRect();
    return sideways()
      ?screenToWorld((e.clientY-rect.top)/rect.height*VIEW_W,(rect.right-e.clientX)/rect.width*VIEW_H)
      :screenToWorld((e.clientX-rect.left)/rect.width*VIEW_W,(e.clientY-rect.top)/rect.height*VIEW_H);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(state.phase!=='aim'||(state.opponent==='ai'&&state.turn===1))return;
    canvas.setPointerCapture(e.pointerId);const p=pointerWorld(e);
    if(state.ballInHand){state.drag='place';placeCue(p.x,p.y,false);return;}
    const c=cue(),dx=p.x-c.x,dy=p.y-c.y,ax=Math.cos(state.aim),ay=Math.sin(state.aim);
    if(state.breaking&&state.repositionAllowed&&Math.hypot(dx,dy)<=R*1.6){state.drag='place-break';return;}
    // The cloth is exclusively an aiming surface. Pulling the left cue lane
    // fires; a precision drag behind the cue must never accidentally fire.
    state.drag={kind:'aim',start:p,startScreen:aimScreenPoint(e),startAim:state.aim,axis:null,moved:false};
  });
  canvas.addEventListener('pointermove',e=>{
    if(!state.drag||state.phase!=='aim')return;const p=pointerWorld(e);
    if(state.drag==='place'||state.drag==='place-break')placeCue(p.x,p.y,false);
    else if(state.drag.kind==='aim'){
      const drag=state.drag,point=aimScreenPoint(e),dx=point.x-drag.startScreen.x,dy=point.y-drag.startScreen.y;
      if(!drag.axis&&Math.hypot(dx,dy)>2){drag.axis=Math.abs(dx)>=Math.abs(dy)?'x':'y';drag.moved=true;}
      if(drag.axis){const distance=drag.axis==='x'?dx:dy;
        state.aim=drag.startAim+Math.sign(distance)*Math.max(0,Math.abs(distance)-2)*.035*Math.PI/180;requestAimFrame();}
    }else {const d=state.drag.start;const pull=(d.x-p.x)*Math.cos(state.aim)+(d.y-p.y)*Math.sin(state.aim);state.drag.pull=Math.max(0,pull);state.power=state.drag.pull<.7?state.drag.startingPower:clamp(Math.round(5+(state.drag.pull-.7)*5.7),5,100);syncPowerUI();render();}
  });
  const pointerUp=e=>{if(state.drag?.kind==='aim'&&state.phase==='aim'&&!state.drag.moved){const p=pointerWorld(e);aimAt(p.x,p.y);}if((state.drag==='place'||state.drag==='place-break')&&state.phase==='aim'){const p=pointerWorld(e);if(placeCue(p.x,p.y,false))say('白球位置已预览，可继续调整或确认摆放。');}else if(state.drag?.kind==='power'){const p=pointerWorld(e),d=state.drag.start;state.drag.pull=Math.max(0,(d.x-p.x)*Math.cos(state.aim)+(d.y-p.y)*Math.sin(state.aim));if(state.drag.pull>=1.5){syncPowerUI();fire(false,true);}else{state.power=state.drag.startingPower;state.guidePowerLock=null;syncPowerUI();render();}}state.drag=null;};
  canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',()=>{if(state.drag?.kind==='power'){state.power=state.drag.startingPower;state.guidePowerLock=null;syncPowerUI();render();}state.drag=null;});
  const spinPad=$('spinPad');
  function moveSpinDot(){const dot=$('spinDot');dot.style.left=`${50+state.spinX*36}%`;dot.style.top=`${50-state.spinY*36}%`;if($('strokeReadout'))$('strokeReadout').textContent=strokeName(state);}
  function setSpin(e){if(!canAdjustStroke())return;const rect=spinPad.getBoundingClientRect();const x=sideways()?(e.clientY-rect.top)/rect.height*2-1:(e.clientX-rect.left)/rect.width*2-1,y=sideways()?1-(rect.right-e.clientX)/rect.width*2:1-(e.clientY-rect.top)/rect.height*2;const k=Math.max(1,Math.hypot(x,y));state.spinX=clamp(x/k,-1,1);state.spinY=clamp(y/k,-1,1);moveSpinDot();requestAimFrame();}
  spinPad.addEventListener('pointerdown',e=>{if(!canAdjustStroke())return;spinPad.setPointerCapture(e.pointerId);setSpin(e);});
  spinPad.addEventListener('pointermove',e=>{if(spinPad.hasPointerCapture(e.pointerId))setSpin(e);});
  $('resetSpin').addEventListener('click',()=>{if(!canAdjustStroke())return;state.spinX=0;state.spinY=0;moveSpinDot();requestAimFrame();});
  $('power').addEventListener('input',e=>{if(!canAdjustStroke())return;state.power=Number(e.target.value);syncPowerUI();render();});
  function openPracticeMenu(rules=state.mode==='eight'?'eight':'nine'){
    state.practiceRuleset=rules;
    if($('practiceRulesetLabel'))$('practiceRulesetLabel').textContent=rules==='eight'?'八球规则':'九球规则';
    $('practiceOverlay').classList.remove('hidden');
  }
  $('practiceBtn')?.addEventListener('click',()=>openPracticeMenu());
  const closePracticeMenu=()=>{
    $('practiceOverlay').classList.add('hidden');
    if(state.phase==='menu'){$('menuOverlay').classList.remove('hidden');showSetupStep('rules');}
  };
  $('closePractice')?.addEventListener('click',closePracticeMenu);
  $('backPractice')?.addEventListener('click',closePracticeMenu);
  $('repeatPractice')?.addEventListener('click',()=>startPractice(state.practice));
  document.querySelectorAll('[data-practice]').forEach(btn=>btn.addEventListener('click',()=>startPractice(btn.dataset.practice)));
  const meter=$('cueMeter');let meterDrag=null;
  const meterAxis=e=>sideways()?-e.clientX:e.clientY;
  function updateMeterDrag(e){
    if(!meterDrag||meterDrag.id!==e.pointerId)return;
    const travel=clamp(meter.clientHeight*.72,95,360);
    const pull=Math.max(0,meterAxis(e)-meterDrag.startAxis);
    meterDrag.pull=pull;
    const progress=clamp((pull-6)/(travel-6),0,1);
    state.power=Math.round(5+95*Math.pow(progress,1.15));
    const track=meter.querySelector('.cue-track');
    meter.style.setProperty('--cue-pull',`${Math.round(progress*track.clientHeight*.2)}px`);
    syncPowerUI();requestAimFrame();
  }
  meter.addEventListener('pointerdown',e=>{
    if(state.phase!=='aim'||state.ballInHand||(state.opponent==='ai'&&state.turn===1))return;
    e.preventDefault();state.guidePowerLock=state.power;meterDrag={id:e.pointerId,startAxis:meterAxis(e),pull:0,startingPower:state.power};meter.classList.add('dragging');meter.setPointerCapture(e.pointerId);state.power=5;syncPowerUI();render();
  });
  meter.addEventListener('pointermove',e=>{
    updateMeterDrag(e);
  });
  meter.addEventListener('pointerup',e=>{
    if(!meterDrag||meterDrag.id!==e.pointerId)return;
    // Release commits the last previewed strength; it does not retune the shot.
    const shoot=meterDrag.pull>=14,startingPower=meterDrag.startingPower;
    meterDrag=null;meter.classList.remove('dragging');meter.style.setProperty('--cue-pull','0px');
    if(shoot)fire(false,true);else{state.power=startingPower;state.guidePowerLock=null;syncPowerUI();render();}
  });
  meter.addEventListener('pointercancel',()=>{if(meterDrag){state.power=meterDrag.startingPower;state.guidePowerLock=null;syncPowerUI();render();}meterDrag=null;meter.classList.remove('dragging');meter.style.setProperty('--cue-pull','0px');});
  meter.addEventListener('keydown',e=>{
    if(!canAdjustStroke())return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();state.power=clamp(state.power+(e.key==='ArrowDown'?5:-5),5,100);syncPowerUI();render();
    }
    if(e.key==='Enter'){e.preventDefault();fire(false,true);}
  });
  $('shootBtn').addEventListener('click',()=>fire(false,true));
  $('placeCueBtn').addEventListener('click',()=>{
    if(state.phase!=='aim'||!state.repositionAllowed||state.opponent==='ai'&&state.turn===1)return;
    if(state.ballInHand){if(!validCuePosition(cue().x,cue().y)){say('白球与目标球重叠，请选择空位。');return;}placeCue(cue().x,cue().y,true);}
    else{state.ballInHand=true;say(state.breaking?'开球摆球：白球须在虚线后，摆好后确认。':'自由球：拖动白球，满意后确认位置。');updateUI();render();}
  });
  const angleRuler=$('angleRuler');let angleDrag=null;
  const rulerAxis=e=>sideways()?e.clientY:e.clientX;
  angleRuler.addEventListener('pointerdown',e=>{
    if(state.phase!=='aim'||state.ballInHand||(state.opponent==='ai'&&state.turn===1))return;
    e.preventDefault();angleDrag={id:e.pointerId,start:rulerAxis(e),aim:state.aim};angleRuler.setPointerCapture(e.pointerId);
  });
  angleRuler.addEventListener('pointermove',e=>{
    if(!angleDrag||angleDrag.id!==e.pointerId)return;
    state.aim=angleDrag.aim+(rulerAxis(e)-angleDrag.start)*.004*Math.PI/180;
    requestAimFrame();
  });
  const stopAngleDrag=()=>{angleDrag=null;};
  angleRuler.addEventListener('pointerup',stopAngleDrag);
  angleRuler.addEventListener('pointercancel',stopAngleDrag);
  angleRuler.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    e.preventDefault();const step=e.shiftKey?.0001:.001;state.aim+=(e.key==='ArrowLeft'?-1:1)*step*Math.PI/180;updateUI();render();
  });
  let setupChoice='ai',setupRuleset='eight';
  function showSetupStep(step){
    const ids={mode:'setupMode',rules:'setupRules',difficulty:'setupDifficulty'};
    for(const [name,id] of Object.entries(ids))$(id).classList.toggle('hidden',name!==step);
    document.querySelectorAll('[data-progress]').forEach(label=>label.classList.toggle('active',label.dataset.progress===step));
  }
  function openSetup(step='mode'){
    window.PoolAudio?.stopGameMusic?.();
    window.PoolAudio?.startIntro?.();
    document.body?.setAttribute('data-screen','setup');
    $('resultOverlay')?.classList.add('hidden');$('startOverlay').classList.add('hidden');$('practiceOverlay')?.classList.add('hidden');$('menuOverlay').classList.remove('hidden');showSetupStep(step);
  }
  function leaveTable(){
    state.aiTicket++;state.aiThinking=false;state.aiPlan=null;state.phase='menu';state.shot=null;state.stroke=null;state.windup=0;state.drag=null;
    state.pocketAnimations=[];state.ballInHand=false;state.repositionAllowed=false;
    for(const b of live())b.vx=b.vy=b.rollVx=b.rollVy=b.spin=0;
    meterDrag=null;angleDrag=null;meter.classList.remove('dragging');meter.style.setProperty('--cue-pull','0px');
    for(const id of ['resultOverlay','practiceOverlay','rulesOverlay'])$(id)?.classList.add('hidden');
    window.PoolAudio?.stopGameMusic?.();window.PoolAudio?.startIntro?.();
    document.body?.setAttribute('data-screen','setup');updateUI();
  }
  function returnHome(){
    leaveTable();state.practice=null;state.matchScores=[0,0];
    $('menuOverlay').classList.add('hidden');$('startOverlay').classList.remove('hidden');
    document.body?.setAttribute('data-screen','welcome');$('startBtn').focus?.();
  }
  function returnPreviousPage(){
    const previous=state.returnPage,rules=state.practiceRuleset||state.mode;
    leaveTable();
    if(previous==='practice'){
      setupChoice='practice';setupRuleset=rules;
      $('menuOverlay').classList.add('hidden');openPracticeMenu(rules);
    }else{
      state.practice=null;setupChoice=state.opponent;setupRuleset=state.mode;openSetup(previous);
    }
  }
  document.querySelectorAll('[data-flow-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    setupChoice=btn.dataset.flowMode;
    $('setupRulesHint').textContent=setupChoice==='practice'?'先选择八球或九球规则，再挑选训练项目。':setupChoice==='local'?'双人同屏不需要选择难度。':'选择玩法后继续设置电脑难度。';
    showSetupStep('rules');
  }));
  document.querySelectorAll('[data-flow-rules]').forEach(btn=>btn.addEventListener('click',()=>{
    setupRuleset=btn.dataset.flowRules;
    if(setupChoice==='ai'){state.opponent='ai';showSetupStep('difficulty');return;}
    if(setupChoice==='practice'){$('menuOverlay').classList.add('hidden');state.phase='menu';openPracticeMenu(setupRuleset);return;}
    state.opponent='local';init(setupRuleset);
  }));
  document.querySelectorAll('[data-flow-difficulty]').forEach(btn=>btn.addEventListener('click',()=>{
    state.opponent='ai';state.aiDifficulty=btn.dataset.flowDifficulty;init(setupRuleset);
  }));
  document.querySelectorAll('[data-setup-back]').forEach(btn=>btn.addEventListener('click',()=>{
    if(btn.dataset.setupBack==='welcome'){
      returnHome();return;
    }
    showSetupStep(btn.dataset.setupBack);
  }));
  $('startBtn').addEventListener('click',()=>openSetup('mode'));
  $('backBtn').addEventListener('click',returnPreviousPage);
  $('resultHome').addEventListener('click',returnHome);
  $('resultReplay').addEventListener('click',()=>{
    if(state.phase!=='gameover')return;
    init(state.mode,{rematch:true});
  });
  $('rulesBtn').addEventListener('click',()=>$('rulesOverlay').classList.remove('hidden'));
  $('closeRules').addEventListener('click',()=>$('rulesOverlay').classList.add('hidden'));
  $('rulesOverlay').addEventListener('click',e=>{if(e.target.id==='rulesOverlay')$('rulesOverlay').classList.add('hidden');});
  async function fullscreen(){await window.PoolPreviewFullscreen?.toggle();
  }
  $('fullBtn').addEventListener('click',fullscreen);
  document.addEventListener('keydown',e=>{
    if(e.key==='f'||e.key==='F'){fullscreen();return;}
    if(e.key==='Escape'){$('rulesOverlay').classList.add('hidden');return;}
    if(state.phase!=='aim')return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){if(e.target===angleRuler)return;e.preventDefault();if(state.opponent==='ai'&&state.turn===1)return;const step=e.shiftKey?.0001:.001;state.aim+=(e.key==='ArrowLeft'?-1:1)*step*Math.PI/180;updateUI();render();}
    if(e.key===' '){e.preventDefault();fire(false,true);}
  });
  let last=performance.now(),acc=0,manualTime=false;
  function frame(now){
    const elapsed=Math.min(.05,(now-last)/1000);last=now;
    const active=state.phase==='moving'||state.pocketAnimations.length>0||!!state.stroke;
    if(!manualTime&&active){acc+=elapsed;while(acc>=STEP){update(STEP);acc-=STEP;}}else acc=0;
    // Match the display's native refresh; a fixed 120-Hz gate skips alternate
    // frames on 144-Hz displays. Idle pages need neither physics nor paint.
    if(active)render();requestAnimationFrame(frame);
  }
  window.addEventListener?.('resize',()=>requestAnimationFrame(resizeRenderBuffer));
  if(window.ResizeObserver)new window.ResizeObserver(()=>requestAnimationFrame(resizeRenderBuffer)).observe(canvas);
  requestAnimationFrame(resizeRenderBuffer);
  window.advanceTime=ms=>{manualTime=true;acc=0;const steps=Math.ceil(ms/1000/STEP);for(let i=0;i<steps;i++)update(STEP);render();};
  window.render_game_to_text=()=>JSON.stringify({coordinates:`world inches, origin at top-left cushion nose; +x right, +y down; table 100x50; ball diameter ${(2*R).toFixed(4)}; corner mouth ${CORNER_MOUTH}; side mouth ${SIDE_MOUTH}`,mode:state.mode,opponent:state.opponent,aiDifficulty:state.aiDifficulty,aiThinking:state.aiThinking,aiPlan:state.aiPlan?{target:state.aiPlan.target,pocket:state.aiPlan.pocket,type:state.aiPlan.type,spinX:state.aiPlan.spinX||0,spinY:state.aiPlan.spinY||0,snookerPlanned:!!state.aiPlan.snookerPlanned,power:+state.aiPlan.power.toFixed(1),description:state.aiPlan.description}:null,phase:state.phase,turn:state.turn+1,groups:state.groups,scores:state.scores,matchScores:state.matchScores,returnPage:state.returnPage,breaking:state.breaking,rackSeed:state.rackSeed,ballInHand:state.ballInHand,repositionAllowed:state.repositionAllowed,aimDegrees:+(state.aim*180/Math.PI).toFixed(2),power:state.power,spin:[+state.spinX.toFixed(2),+state.spinY.toFixed(2)],balls:state.balls.map(b=>({n:b.n,x:+b.x.toFixed(2),y:+b.y.toFixed(2),vx:+b.vx.toFixed(2),vy:+b.vy.toFixed(2),rollVx:+b.rollVx.toFixed(2),rollVy:+b.rollVy.toFixed(2),sideSpin:+b.spin.toFixed(2),roll:+b.roll.toFixed(2),pocketed:b.pocketed})),status:state.status,winner:state.winner});
  if(new URLSearchParams(location.search).has('test')){
    $('startOverlay').classList.add('hidden');$('menuOverlay').classList.remove('hidden');
    window.__poolTest={sampleFall(index,x,y,vx,vy,age){const a=makePocketFall(Object.assign(ball(1,x,y),{vx,vy,rollVx:vx,rollVy:vy}),index);advancePocketFall(a,age);advanceBallOrientation(a.visual,age);return {...pocketAnimationPose(a),vx:a.fallVx,vy:a.fallVy,q:[...a.visual.q]};},launchBall(power,aim,side=0){const b=ball(0,50,25);applyCueImpulse(b,power,aim,side,0,false);return b;},railTest(b,nx,ny){const copy={...b};railHit(copy,nx,ny);return copy;},assessAttack:attackRisk,simulateShot:simulateAIShot,masterStrokeCost,getRenderInfo(){return {ratio:PIXEL_RATIO,textureSize:BALL_SPRITE_SIZE,width:canvas.width,height:canvas.height};},getPocketGeometry(){return POCKET_GEOMETRY.map(p=>({...p,well:{...p.well}}));},getShotSummary(){return {firstHit:state.shot?.firstHit??null,pocketed:state.shot?.pocketed||[]};},getFallAnimations(){return state.pocketAnimations.map(a=>({n:a.visual.n,pocket:a.pocket,age:a.age,duration:a.duration,entryX:a.entryX,entryY:a.entryY,vx:a.vx,vy:a.vy,...pocketAnimationPose(a),q:[...a.visual.q]}));},pocketRollingTest(index=1,angleDegrees=0,speed=6,offMouth=false){
      const p=POCKET_GEOMETRY[index],angle=angleDegrees*Math.PI/180;
      const dx=p.nx*Math.cos(angle)+p.tx*Math.sin(angle),dy=p.ny*Math.cos(angle)+p.ty*Math.sin(angle);
      const distance=Math.min(8,speed*speed/(2*ROLL_DECEL)*.7),offset=offMouth?p.radius+1.4:0;
      window.__poolTest.setMovingBalls([{n:0,x:50,y:25},{n:9,x:80,y:35},{n:1,x:p.well.x-dx*distance+p.tx*offset,y:p.well.y-dy*distance+p.ty*offset,vx:dx*speed,vy:dy*speed,rollVx:dx*speed,rollVy:dy*speed}]);
      manualTime=false;acc=0;state.shotTime=0;say(`袋口试球：${POCKETS[index].name} · ${offMouth?'撞袋角外侧':'慢球入袋'}`);render();
    },openTestMatch(mode='eight'){init(mode);},async planAI(entries,mode='nine',ownGroup=null,hand=false,difficulty='hard',technique=null){
    const ticket=++state.aiTicket;state.aiThinking=true;state.aiPlan=null;state.mode=mode;state.opponent='ai';state.phase='aim';state.turn=1;state.breaking=false;state.ballInHand=hand;state.groups=[ownGroup==='solid'?'stripe':ownGroup==='stripe'?'solid':null,ownGroup];state.aiDifficulty=difficulty;state.balls=entries.map(q=>ball(q.n,q.x,q.y));state.shot=null;state.pocketAnimations=[];state.winner=null;state.scores=[0,0];
    $('menuOverlay').classList.add('hidden');$('player2Name').textContent='电脑';say('电脑正在判断球路…');updateUI();render();const started=performance.now();const plan=technique?await chooseAITechnique(technique,()=>ticket===state.aiTicket):await chooseAIPlan(()=>ticket===state.aiTicket);if(ticket!==state.aiTicket)return {plan:null,result:null,ms:performance.now()-started};state.aiPlan=plan;state.aiThinking=false;showAIStroke(plan);say(plan?`电脑计划：${plan.description}`:'没有可击打的目标');render();return {plan,options:aiOptions(aiTargets()),result:plan?simulateAIShot(plan):null,ms:performance.now()-started};
  },fireAIPlanTest(){if(!state.aiPlan||state.phase!=='aim')return false;manualTime=false;state.ballInHand=false;state.aim=state.aiPlan.aim;state.power=state.aiPlan.power;state.spinX=state.aiPlan.spinX||0;state.spinY=state.aiPlan.spinY||0;fire(true,true);},getAIPottedTest(){return state.balls.filter(b=>b.pocketed).map(b=>({n:b.n,pocket:b.pocketCandidate}));},queueAITest(){queueAI();},getLaunchSpeed(power,breaking=false){return cueLaunchSpeed(power,breaking);},getPocketEvents(){return {effects:state.pocketAnimations.map(a=>({n:a.visual.n,pocket:a.pocket,x:a.effectX,y:a.effectY,ballX:a.entryX,ballY:a.entryY})),shot:state.shot?.pocketed||[]};},setMovingBalls(entries){
    manualTime=true;acc=0;
    state.aiTicket++;state.aiThinking=false;state.mode='nine';state.opponent='local';state.phase='moving';state.turn=0;state.breaking=false;state.ballInHand=false;state.pocketAnimations=[];state.balls=entries.map(q=>Object.assign(ball(q.n,q.x,q.y),{vx:q.vx||0,vy:q.vy||0,rollVx:q.rollVx||0,rollVy:q.rollVy||0,spin:q.spin||0,pocketCandidate:q.pocketCandidate??null}));
    state.shot={shooter:0,breaking:false,firstHit:1,pocketed:[],railAfterHit:false,breakRails:new Set(),groupAtStart:null,eightReady:false};state.stopTime=0;state.shotTime=0;$('menuOverlay').classList.add('hidden');updateUI();render();
  },setSpinAim(vertical=0,horizontal=0){
    state.pocketAnimations=[];
    state.aiTicket++;state.aiThinking=false;state.aiPlan=null;state.mode='nine';state.opponent='local';state.phase='aim';state.turn=0;state.breaking=false;state.ballInHand=false;
    state.balls=[ball(0,40,25),ball(1,55,25)];state.aim=0;state.power=70;state.spinY=vertical;state.spinX=horizontal;
    state.shot=null;$('menuOverlay').classList.add('hidden');syncPowerUI();moveSpinDot();updateUI();render();
  },getGuidePrediction(){return displayGuide();
  },getDisplayGuide(){return displayGuide();
  },setGuideBalls(entries,aim=0,power=70,spinY=0,spinX=0){
    state.pocketAnimations=[];
    state.aiTicket++;state.aiThinking=false;state.aiPlan=null;state.mode='nine';state.opponent='local';state.phase='aim';state.turn=0;state.breaking=false;state.ballInHand=false;
    state.groups=[null,null];state.scores=[0,0];say('拖动瞄准，拉动左侧球杆出杆。');state.balls=entries.map(q=>ball(q.n,q.x,q.y));state.aim=aim;state.power=power;state.spinY=spinY;state.spinX=spinX;
    state.shot=null;$('menuOverlay').classList.add('hidden');syncPowerUI();moveSpinDot();updateUI();render();
  },fireTest(){fire();
  },setSpinShot(vertical=0,horizontal=0,power=70){
    manualTime=true;acc=0;
    state.pocketAnimations=[];
    state.aiTicket++;state.aiThinking=false;state.aiPlan=null;state.mode='nine';state.opponent='local';state.phase='aim';state.turn=0;state.breaking=false;state.ballInHand=false;
    state.balls=[ball(0,40,25),ball(1,55,25)];state.aim=0;state.power=power;state.spinY=vertical;state.spinX=horizontal;
    state.shot=null;$('menuOverlay').classList.add('hidden');syncPowerUI();moveSpinDot();updateUI();render();fire();
  },setGuideFixture(illegal=false){
    state.pocketAnimations=[];
    state.aiTicket++;state.aiThinking=false;state.aiPlan=null;state.mode='nine';state.opponent='local';state.phase='aim';state.turn=0;state.breaking=false;state.ballInHand=false;
    state.balls=[ball(0,25,25),ball(1,65,12),ball(illegal?2:1,50,25)];
    if(!illegal)state.balls.splice(1,1);
    state.aim=0;state.shot=null;$('menuOverlay').classList.add('hidden');updateUI();render();
  },setEightFinal(ready=true){
    state.pocketAnimations=[];
    state.aiTicket++;state.aiThinking=false;state.aiPlan=null;state.mode='eight';state.opponent='local';state.phase='aim';state.turn=0;state.breaking=false;state.ballInHand=false;state.groups=['solid','stripe'];state.scores=[ready?7:0,0];state.balls=[ball(0,50,22),ball(8,50,8)];if(!ready)state.balls.push(ball(1,80,35));state.aim=-Math.PI/2;state.power=56;state.shot=null;
    state.spinX=0;state.spinY=-.85;$('player2Name').textContent='玩家 2';syncPowerUI();moveSpinDot();$('menuOverlay').classList.add('hidden');updateUI();render();
  },setNineFinal(){
    state.pocketAnimations=[];
    state.aiTicket++;state.aiThinking=false;state.aiPlan=null;state.mode='nine';state.opponent='local';state.phase='aim';state.turn=0;state.breaking=false;state.ballInHand=false;state.groups=[null,null];state.scores=[8,0];state.balls=[ball(0,50,22),ball(9,50,8)];state.aim=-Math.PI/2;state.power=56;state.shot=null;
    state.spinX=0;state.spinY=-.85;$('player2Name').textContent='玩家 2';syncPowerUI();moveSpinDot();$('menuOverlay').classList.add('hidden');updateUI();render();
  }};}
  const boot=$('boot'),bootStarted=performance.now(),bootDuration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?100:1900;
  let bootDone=false;
  function dismissBoot(){if(bootDone)return;bootDone=true;boot.classList.add('done');setTimeout(()=>boot.remove(),600);}
  $('skipBoot').addEventListener('click',dismissBoot);
  function animateBoot(now){
    if(bootDone)return;
    const pct=clamp((now-bootStarted)/bootDuration,0,1);
    $('bootProgress').style.width=`${Math.round(pct*100)}%`;$('bootPercent').textContent=`${Math.round(pct*100)}%`;
    if(pct>=1)dismissBoot();else requestAnimationFrame(animateBoot);
  }
  cueTexture=buildCueTexture();
  syncPowerUI();render();requestAnimationFrame(frame);requestAnimationFrame(animateBoot);
})();

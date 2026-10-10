const assert=require('node:assert/strict');
const {window:w,ids}=require('./load-game.cjs')();
const t=w.__poolTest;w.advanceTime(0);
const fixtures=[];
for(const y of [25,26,27.3])for(const spinX of [-.85,0,.85])fixtures.push({name:`cut-${y}-spin-${spinX}`,balls:[{n:0,x:30,y:25},{n:1,x:52,y}],power:70,spinX});
for(const spinY of [-.85,0,.85])fixtures.push({name:`straight-spinY-${spinY}`,balls:[{n:0,x:40,y:25},{n:1,x:55,y:25}],power:70,spinY});
fixtures.push({name:'weak-unreachable',balls:[{n:0,x:30,y:25},{n:1,x:70,y:25}],power:5});
fixtures.push({name:'nearest-obstruction',balls:[{n:0,x:30,y:25},{n:1,x:70,y:25},{n:2,x:46,y:25}],power:56});
fixtures.push({name:'middle-pocket',balls:[{n:0,x:50,y:22},{n:1,x:50,y:8}],power:56,aim:-Math.PI/2});
fixtures.push({name:'corner-pocket',balls:[{n:0,x:24,y:12},{n:1,x:12,y:6}],power:56,aim:Math.atan2(-6,-12)});
fixtures.push({name:'one-rail-kick',balls:[{n:0,x:25,y:25},{n:1,x:55,y:10}],power:80,aim:-172*Math.PI/180,expectedRails:1});
fixtures.push({name:'two-rail-kick',balls:[{n:0,x:20,y:25},{n:1,x:70,y:15}],power:80,aim:-177.5*Math.PI/180,expectedRails:2});
for(const f of fixtures){
 t.setGuideBalls(f.balls,f.aim||0,f.power,f.spinY||0,f.spinX||0);
 const before=w.render_game_to_text(),g=t.getDisplayGuide();
 assert.equal(before,w.render_game_to_text(),`${f.name}: trial mutated live state`);
 assert.equal(g.straight,true,`${f.name}: guide not marked straight`);
 for(const points of [g.shotPath,g.cuePath,g.targetPath]){
   assert(points.length<=1200,`${f.name}: unbounded short guide`);
   assert(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),`${f.name}: invalid guide point`);
 }
 assert(pathLength(g.cuePath)<=8.05,`${f.name}: cue guide exceeds legacy length`);
 assert(pathLength(g.targetPath)<=11.05,`${f.name}: target guide exceeds legacy length`);
 if(f.expectedRails){
   assert.equal(g.railCount,1,`${f.name}: preview must stop computing at its first visible cushion`);
   assert.equal(g.targetNumber,null,`${f.name}: target after cushion should stay hidden`);
   assert.equal(g.cuePath.length,0,`${f.name}: cue rebound guide should stay hidden`);
   assert.equal(g.targetPath.length,0,`${f.name}: target rebound guide should stay hidden`);
 }
 if(g.targetNumber!==null){const e=g.shotPath.at(-1),o=g.objectCenter;assert(Math.abs(Math.hypot(e.x-o.x,e.y-o.y)-2*1.125*1.05*1.05)<1e-7,`${f.name}: ghost radius`);}
 t.fireTest();let actual;
 for(let i=0;i<5400;i++){w.advanceTime(1000/180);actual=t.getShotSummary().firstHit;if(actual!==null||JSON.parse(w.render_game_to_text()).phase!=='moving')break;}
 if(f.expectedRails)assert.equal(actual,1,`${f.name}: live cushion route changed`);
 else assert.equal(g.targetNumber,actual,`${f.name}: first-hit prediction differs from live shot`);
 if(g.targetPath.length===2){
   const b=JSON.parse(w.render_game_to_text()).balls.find(b=>b.n===g.targetNumber);
   const v=g.targetPath[1],o=g.targetPath[0];
   assert(Math.abs(Math.atan2(b.vy,b.vx)-Math.atan2(v.y-o.y,v.x-o.x))<.002,`${f.name}: outgoing direction mismatch`);
 }
}
for(let p=0;p<6;p++){
 t.pocketRollingTest(p,0,12);w.advanceTime(0);
 let a;for(let i=0;i<180;i++){w.advanceTime(1000/180);a=t.getFallAnimations()[0];if(a)break;}
 assert(a,`pocket ${p}: missing fall`);assert.equal(a.pocket,p);
 const first=a;w.advanceTime(1000/180);const next=t.getFallAnimations()[0],dt=next.age-first.age;
 assert(dt>0,`pocket ${p}: fall clock stopped`);
 const visualVx=(next.x-first.x)/dt,visualVy=(next.y-first.y)/dt,entrySpeed=Math.hypot(first.vx,first.vy);
 assert(Math.hypot(visualVx-first.vx,visualVy-first.vy)<Math.max(1,entrySpeed*.4),`pocket ${p}: entry animation velocity jumped`);
 w.advanceTime(80);const deeper=t.getFallAnimations()[0];
 assert(deeper.scale<first.scale,`pocket ${p}: ball did not drop into depth`);
 const events=t.getShotSummary().pocketed;
 const remaining=(deeper.duration-deeper.age)*1000;
 assert(remaining>0&&remaining<250,`pocket ${p}: implausible drop time`);
 w.advanceTime(remaining+30);assert.equal(t.getFallAnimations().length,0,`pocket ${p}: drop did not finish`);
 assert.equal(events.filter(e=>e.n===1).length,1,`pocket ${p}: duplicate score`);
 assert(JSON.parse(w.render_game_to_text()).balls.find(b=>b.n===1).pocketed,`pocket ${p}: score disappeared`);
}
// Drag the left lane: the release must use exactly the last displayed power.
t.setGuideBalls([{n:0,x:50,y:25},{n:1,x:80,y:40}],0,56);
const meter=ids.get('cueMeter'),event=y=>({pointerId:1,clientY:y,clientX:0,preventDefault(){}});
const guideBeforePull=JSON.stringify(t.getDisplayGuide());
meter.handlers.pointerdown(event(20));meter.handlers.pointermove(event(160));
assert.equal(JSON.stringify(t.getDisplayGuide()),guideBeforePull,'left pull moved the locked aiming guide');
const previewPower=JSON.parse(w.render_game_to_text()).power;
meter.handlers.pointerup(event(160));w.advanceTime(100);
const shot=JSON.parse(w.render_game_to_text());
assert.equal(shot.power,previewPower);assert.equal(meter.styles['--power-fraction'],String(previewPower/100));
assert(shot.balls.find(b=>b.n===0).vx>0,'release did not strike');
// One precision ruler moves .002 degrees per CSS pixel.
t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:52,y:25}],0,56);
const ruler=ids.get('angleRuler'),rulerEvent=x=>({pointerId:7,clientX:x,clientY:0,preventDefault(){}});
ruler.handlers.pointerdown(rulerEvent(100));ruler.handlers.pointermove(rulerEvent(200));ruler.handlers.pointerup(rulerEvent(200));
assert.equal(JSON.parse(w.render_game_to_text()).aimDegrees,.2,'precision ruler scale drifted');
console.log(JSON.stringify({passed:true,guideFixtures:fixtures.length,pocketFixtures:6,meterRelease:true,guideLockedDuringPull:true,rulerStep:'.002deg/px'}));

function pathLength(points){let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);return length;}

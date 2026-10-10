const assert=require('node:assert/strict'),load=require('./load-game.cjs');
for(const rotated of [false,true]){
 const g=load({mobile:true}),w=g.window,t=w.__poolTest;if(rotated)g.ids.get('mobile-pool-preview').classList.add('is-landscape');
 const e=(x,y,id=1)=>({pointerId:id,clientX:rotated?-y:x,clientY:rotated?x:y,preventDefault(){}});
 const aim=()=>Number(g.ids.get('angleReadout').textContent.replace('°',''));
 t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:70,y:40}],0);
 g.canvas.handlers.pointerdown(e(500,300));g.canvas.handlers.pointermove(e(500,310));g.canvas.handlers.pointerup(e(500,320));assert(Math.abs(aim()-.16)<1e-5,'last lift movement lost');
 const buttons=g.elements.filter(b=>b.dataset.aimFeel);
 assert.equal(buttons.length,0,'legacy sensitivity selectors remain');
 for(const steps of [1,20]){
  t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:70,y:40}],0);
  g.canvas.handlers.pointerdown(e(500,300));g.canvas.handlers.pointermove(e(500,320,2));assert.equal(aim(),0,'second finger moved the aim');
  for(let i=1;i<=steps;i++)g.canvas.handlers.pointermove(e(500,300+20*i/steps));
  g.canvas.handlers.pointerup(e(500,320));assert(Math.abs(aim()-.16)<1e-5,'event frequency changed gain');
 }
 const ruler=g.ids.get('angleRuler');t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:70,y:40}],0);ruler.handlers.pointerdown(e(0,0));ruler.handlers.pointermove(e(10,0));ruler.handlers.pointerup(e(20,0));assert(Math.abs(aim()-.04)<1e-5,'ruler lift not committed');
}
console.log(JSON.stringify({passed:true,finalLift:true,samplingIndependent:true,multitouchIsolation:true,rotatedInput:true,sensitivitySelectorsRemoved:true}));

const assert=require('node:assert/strict');
const load=require('./load-game.cjs');
for(const rotated of [false,true]){
  const queue=[],g=load({mobile:true,dpr:3,animationFrame:fn=>queue.push(fn)}),w=g.window,t=w.__poolTest;
  if(rotated)g.ids.get('mobile-pool-preview').classList.add('is-landscape');
  g.canvas.getBoundingClientRect=()=>rotated?{left:0,top:0,right:395,width:395,height:700}:{left:0,top:0,right:700,width:700,height:395};
  const event=(x,y)=>({pointerId:1,clientX:rotated?395-y/2:x/2,clientY:rotated?x/2:y/2,preventDefault(){}});
  const aim=()=>Number(g.ids.get('angleReadout').textContent.replace('°',''));
  const flush=()=>{const pending=queue.splice(0);for(const fn of pending)fn(performance.now());};
  const initial=t.getRenderInfo();assert(initial.width>=1890);assert(initial.width<=2520);assert.equal(initial.textureSize,80);
  for(const distance of [3,50]){
    t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:80,y:40}],0);
    const x=60+(30+distance)*12.8,y=75+25*12.8;
    g.canvas.handlers.pointerdown(event(x,y));assert.equal(aim(),0,'pointer-down snapped the aim');
    for(let i=1;i<=20;i++)g.canvas.handlers.pointermove(event(x,y+i*2));
    flush();assert(Math.abs(aim()-.63)<.0002,`drag gain depends on cue distance: ${aim()}`);
    g.canvas.handlers.pointerup(event(x,y+40));assert(Math.abs(aim()-.63)<.0002,'release snapped to touch point');
  }
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const axis of ['x','y'])for(const steps of [1,20]){
    t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:80,y:40}],heading);
    const before=aim(),x=300,y=250;
    g.canvas.handlers.pointerdown(event(x,y));
    for(let i=1;i<=steps;i++)g.canvas.handlers.pointermove(event(x+(axis==='x'?80*i/steps:0),y+(axis==='y'?80*i/steps:0)));
    flush();const delta=(aim()-before+540)%360-180;
    assert(Math.abs(delta-1.33)<.0002,`direction or sampling changed gain: ${heading}/${axis}/${steps}: ${delta}`);
    g.canvas.handlers.pointerup(event(x+(axis==='x'?80:0),y+(axis==='y'?80:0)));
    assert.equal(JSON.parse(w.render_game_to_text()).phase,'aim','cloth aiming accidentally fired a shot');
  }
  t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:80,y:40}],0);
  const tap=event(60+60*12.8,75+35*12.8);
  g.canvas.handlers.pointerdown(tap);g.canvas.handlers.pointerup(tap);assert(Math.abs(aim()-18.4349)<.0002,'tap no longer selects a large direction');
  const ruler=g.ids.get('angleRuler');
  ruler.handlers.pointerdown(event(20,20));ruler.handlers.pointermove(event(220,20));flush();
  assert(Math.abs(aim()-18.8349)<.0002,'ruler should move 0.4 degrees for 100 CSS pixels');
  ruler.handlers.pointercancel();
  const before=aim();ruler.handlers.pointermove(event(400,20));flush();assert.equal(aim(),before);
}
console.log(JSON.stringify({passed:true,phoneDpr3:true,rotatedAndUnrotated:true,noPressOrReleaseJump:true,nearCueStable:true,fineRuler:true}));

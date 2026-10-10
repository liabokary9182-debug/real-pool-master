const assert=require('node:assert/strict'),fs=require('node:fs'),load=require('./load-game.cjs');
const sourceFile=process.argv[2],g=load(sourceFile?{source:fs.readFileSync(sourceFile,'utf8')}:{ }),w=g.window,t=w.__poolTest;
const distance=(p,path)=>Math.min(...path.slice(1).map((b,i)=>{
 const a=path[i],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(l2,1e-12)));
 return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
}));
let fixtures=0,samples=0,maxError=0,curved=0;
for(const power of [22,56,90])for(const spinY of [-.9,0,.9])for(const spinX of [-.65,0,.65]){
 const entries=[{n:0,x:30,y:25},{n:1,x:48,y:26.4}];
 t.setGuideBalls(entries,0,power,spinY,spinX);const guide=t.getDisplayGuide();assert.equal(guide.targetNumber,1);
 if(guide.cuePath.length>2)curved++;
 t.fireTest();let collided=false,startCue=null,startTarget=null;
 for(let i=0;i<1800;i++){
  w.advanceTime(1000/180);const balls=t.getBallStates?t.getBallStates():JSON.parse(w.render_game_to_text()).balls,c=balls.find(b=>b.n===0),o=balls.find(b=>b.n===1);
  if(t.getShotSummary().firstHit!==1)continue;
  if(!collided){collided=true;startCue=c;startTarget=o;}
  for(const [b,path,start,limit] of [[c,guide.cuePath,startCue,7.7],[o,guide.targetPath,startTarget,10.7]]){
   if(path.length<2||b.pocketed||b.hitRail||Math.hypot(b.x-start.x,b.y-start.y)>limit)continue;
   const error=distance(b,path);maxError=Math.max(maxError,error);samples++;
   assert(error<.025,`guide/live divergence: power ${power}, spin ${spinX}/${spinY}, ball ${b.n}, error ${error}`);
  }
  if((c.pocketed||Math.hypot(c.vx,c.vy)<.1)&&(o.pocketed||Math.hypot(o.vx,o.vy)<.1))break;
  if(Math.hypot(c.x-startCue.x,c.y-startCue.y)>8&&Math.hypot(o.x-startTarget.x,o.y-startTarget.y)>11)break;
 }
 assert(collided);fixtures++;
}
assert(curved>0,'follow/draw guide still flattened into a chord');
// Freeze only the displayed trial during pulling; release still uses chosen power.
t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:48,y:26.4}],0,56,.9,.65);
const meter=g.ids.get('cueMeter'),event=y=>({pointerId:3,clientX:0,clientY:y,preventDefault(){}});
const guideBeforePull=JSON.stringify(t.getDisplayGuide());
meter.handlers.pointerdown(event(0));meter.handlers.pointermove(event(135));
const drawn=t.getDisplayGuide(),power=JSON.parse(w.render_game_to_text()).power;assert.equal(JSON.stringify(drawn),guideBeforePull,'pull moved the guide');
meter.handlers.pointerup(event(135));assert.equal(JSON.parse(w.render_game_to_text()).power,power);
console.log(JSON.stringify({passed:true,fixtures,samples,maxError,curvedGuides:curved,pullGuideLocked:true,chosenPowerReleased:true}));

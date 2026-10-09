const assert=require('node:assert/strict'),fs=require('node:fs'),load=require('./load-game.cjs');
const source=fs.readFileSync(process.argv[2]||require('node:path').join(__dirname,'../game.js'),'utf8');
// Test-only renderer access; the shipped game exposes no extra production API.
const instrumented=source.replace('window.__poolTest={',`window.__poolTest={entryFixture(index,falling){const p=POCKET_GEOMETRY[index];state.phase='moving';state.balls=[];state.pocketAnimations=[];state.stroke=null;const depth=(p.well.x-p.mx)*p.nx+(p.well.y-p.my)*p.ny;const b=ball(1,p.well.x+p.nx*(p.fallFront-depth+.001),p.well.y+p.ny*(p.fallFront-depth+.001));if(falling)state.pocketAnimations=[makePocketFall(b,index)];else state.balls=[b];render();return {x:worldToScreen(b.x,b.y).x,y:worldToScreen(b.x,b.y).y,r:DISPLAY_R*SCALE};},`);
const g=load({source:instrumented,raster:true,mobile:true,dpr:1}),t=g.window.__poolTest,ratio=t.getRenderInfo().ratio,ctx=g.canvas.getContext('2d');
let checked=0,maxMissing=0;
for(let p=0;p<6;p++){
 const q=t.entryFixture(p,false),x=Math.floor((q.x-q.r)*ratio),y=Math.floor((q.y-q.r)*ratio),size=Math.ceil(q.r*ratio*2);
 const before=ctx.getImageData(x,y,size,size).data;t.entryFixture(p,true);const after=ctx.getImageData(x,y,size,size).data;
 let bright=0,missing=0;
 for(let i=0;i<before.length;i+=4)if(before[i]>150&&before[i+1]>90){bright++;if(after[i]<before[i]*.6)missing++;}
 assert(bright>20);maxMissing=Math.max(maxMissing,missing/bright);
 assert(missing/bright<.08,`pocket ${p}: ${(100*missing/bright).toFixed(1)}% of visible sphere vanished at entry`);checked++;
}
console.log(JSON.stringify({passed:true,pockets:checked,maxMissingFraction:maxMissing}));
// The physical handoff occurs at the exact lip crossing, including a
// fractional remainder of the fixed step, rather than at the next tick.
const sim=load(),u=sim.window.__poolTest;
for(let index=0;index<6;index++){
 u.pocketRollingTest(index,0,50);const p=u.getPocketGeometry()[index];let a;
 for(let step=0;step<300&&!a;step++){sim.window.advanceTime(1000/180);a=u.getFallAnimations()[0];}
 assert(a,'missing entry');
 const front=Math.abs((a.entryX-p.mx)*p.nx+(a.entryY-p.my)*p.ny-p.fallFront);
 const circle=Math.abs(Math.hypot(a.entryX-p.well.x,a.entryY-p.well.y)-p.fallRadius);
 assert(Math.min(front,circle)<1e-7,`pocket ${index}: entry skipped past the rim`);
 assert(a.age>0&&a.age<=1/180,'lost the remainder of the entry tick');
}
console.log(JSON.stringify({passed:true,continuousLipCrossings:6}));

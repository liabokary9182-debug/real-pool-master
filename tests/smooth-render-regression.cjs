const assert=require('node:assert/strict'),fs=require('node:fs'),load=require('./load-game.cjs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../game.js'),'utf8');
const instrumented=source.replace('refreshBallTextures();','if(!window.__skipTextures)refreshBallTextures();').replace('window.__poolTest={',`window.__poolTest={
  frameTest(dt){manualTime=false;frame(last+dt);return state.balls.filter(b=>!b.pocketed).map(b=>({n:b.n,...renderPosition(b)}));},
  fullPaint(){window.__skipTextures=true;previousPaint=null;render();window.__skipTextures=false;},allTextures(){textureBudget=32;},
  diagonalFixture(){state.phase='aim';state.opponent='local';state.breaking=false;state.ballInHand=false;state.balls=[ball(0,30,25),ball(1,80,40)];state.aim=0;},`);
let frames=0;
for(const hz of [60,120,144,240]){
 const g=load({source:instrumented,mobile:true}),w=g.window,t=w.__poolTest;
 t.setMovingBalls([{n:0,x:30,y:25,vx:12,rollVx:12},{n:1,x:80,y:40}]);
 const positions=[];
 for(let i=0;i<80;i++){positions.push(t.frameTest(1000/hz)[0].x);frames++;}
 const deltas=positions.slice(2).map((x,i)=>x-positions[i+1]);
 assert(deltas.every(d=>d>0),`${hz} Hz: frame repeats a stale physics position`);
 const errors=deltas.slice(1).map((d,i)=>Math.abs(d-deltas[i]));
 assert(Math.max(...errors)<.004,`${hz} Hz: fixed-step judder still visible`);
}
// Same signed finger travel gives the same gain on horizontal, vertical,
// diagonal, and rotated screens, independent of event count.
for(const rotated of [false,true])for(const count of [1,20])for(const [dx,dy] of [[40,0],[0,40],[Math.SQRT1_2*40,Math.SQRT1_2*40],[-40,0],[0,-40]]){
 const g=load({source:instrumented,mobile:true}),t=g.window.__poolTest;
 if(rotated)g.ids.get('mobile-pool-preview').classList.add('is-landscape');t.diagonalFixture();
 const event=(x,y)=>({pointerId:1,clientX:rotated?-y:x,clientY:rotated?x:y,preventDefault(){}});
 g.canvas.handlers.pointerdown(event(400,300));
 for(let i=1;i<=count;i++)g.canvas.handlers.pointermove(event(400+dx*i/count,300+dy*i/count));
 g.canvas.handlers.pointerup(event(400+dx,300+dy));
 const actual=JSON.parse(g.window.render_game_to_text()).aimDegrees;
 assert(Math.abs(actual-Math.sign(Math.abs(dx)>=Math.abs(dy)?dx:dy)*.24)<1e-5);
}
const g=load({source:instrumented,raster:true,mobile:true,dpr:3}),t=g.window.__poolTest;
t.setMovingBalls([{n:0,x:30,y:25,vx:14,rollVx:14},{n:1,x:50,y:8,vx:7,rollVx:7},{n:9,x:70,y:42,vx:-12,rollVx:-12}]);
t.allTextures();
let maxDifference=0;
for(let i=0;i<12;i++){
 g.window.advanceTime(1000/180);
 const partial=g.canvas.getContext('2d').getImageData(0,0,g.canvas.width,g.canvas.height).data;
 t.fullPaint();const full=g.canvas.getContext('2d').getImageData(0,0,g.canvas.width,g.canvas.height).data;
 for(let j=0;j<full.length;j++)maxDifference=Math.max(maxDifference,Math.abs(full[j]-partial[j]));
}
assert(maxDifference<=1,'partial restoration leaves stale pixels');
console.log(JSON.stringify({passed:true,frames,refreshRates:[60,120,144,240],diagonalAndRotatedGain:true,partialPaintMaxPixelDifference:maxDifference}));

const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=require('./load-game.cjs'),{createCanvas}=require('@napi-rs/canvas');
const source=fs.readFileSync(process.argv[2]||path.join(__dirname,'../game.js'),'utf8');
const injected=source.replace('window.__poolTest={',`window.__poolTest={
  realismFrame(index,age){const p=POCKET_GEOMETRY[index];state.phase='moving';state.balls=[];state.pocketAnimations=[];state.stroke=null;
    if(age!==null){const a=makePocketFall(Object.assign(ball(1,p.well.x,p.well.y),{rollVx:8,rollVy:3}),index);advancePocketFall(a,age);advanceBallOrientation(a.visual,age);state.pocketAnimations=[a];}
    render();return {p,ratio:PIXEL_RATIO};
  },sphereFrame(n,age){const b=ball(n,50,25);b.rollVx=8;b.rollVy=3;advanceBallOrientation(b,age);renderBallSprite(b);return b.sprite.toBuffer('image/png');},`);
const g=load({source:injected,raster:true,mobile:true,dpr:3}),t=g.window.__poolTest;
let depthCases=0,occlusionPixels=0;
for(let pocket=0;pocket<6;pocket++){
 const p=t.getPocketGeometry()[pocket],zero=t.sampleFall(pocket,p.well.x,p.well.y,0,0,0);
 assert.equal(zero.depth,0);assert.equal(zero.scale,1);assert.equal(zero.alpha,1);
 const first=t.sampleFall(pocket,p.well.x,p.well.y,0,0,.04),next=t.sampleFall(pocket,p.well.x,p.well.y,0,0,.08);
 assert(first.depth>0,'fall still uses shrink-in-place instead of vertical displacement');
 assert(Math.abs(next.depth/first.depth-4)<1e-9,'drop is not accelerating under gravity');
 assert(next.scale>.95,'fall shrinks the ball before it is occluded');
 const {ratio}=t.realismFrame(pocket,null),ctx=g.canvas.getContext('2d');
 const x=Math.floor((60+p.well.x*12.8-50)*ratio),y=Math.floor((75+p.well.y*12.8-50)*ratio),size=Math.ceil(100*ratio);
 const before=ctx.getImageData(x,y,size,size).data;
 const mask=createCanvas(g.canvas.width,g.canvas.height),m=mask.getContext('2d');m.setTransform(ratio,0,0,ratio,0,0);
 const depth=(p.well.x-p.mx)*p.nx+(p.well.y-p.my)*p.ny,angle=Math.atan2(p.ny,p.nx),half=Math.acos((p.fallFront-depth)/p.fallRadius);
 m.beginPath();m.arc(60+p.well.x*12.8,75+p.well.y*12.8,p.fallRadius*12.8,angle-half,angle+half);m.closePath();m.fillStyle='white';m.fill();
 const allowed=m.getImageData(x,y,size,size).data;
 for(const age of [.10,.15,.20]){
  t.realismFrame(pocket,age);const after=ctx.getImageData(x,y,size,size).data;
  for(let i=0;i<before.length;i+=4)if(allowed[i+3]===0){
   for(let c=0;c<3;c++)assert(Math.abs(before[i+c]-after[i+c])<=1,`fall painted cloth/rail at pocket ${pocket}, age ${age}`);
   occlusionPixels++;
  }
  depthCases++;
 }
}
// Pigment/number pixels must rotate while the world-space reflection stays fixed.
for(const n of [0,1,8,9,15])assert(!t.sphereFrame(n,0).equals(t.sphereFrame(n,.12)),`ball ${n} markings do not roll`);
// A small actual drag works in all three settings, including rotated phones.
for(const rotated of [false,true]){
 const h=load({source,mobile:true}),w=h.window,u=w.__poolTest;
 if(rotated)h.ids.get('mobile-pool-preview').classList.add('is-landscape');
 const e=x=>({pointerId:1,clientX:rotated?0:x,clientY:rotated?x:0,preventDefault(){}}),r=h.ids.get('angleRuler');
 const read=()=>parseFloat(h.ids.get('angleReadout').textContent);
 for(const [mode,gain] of [['fine',.001],['balanced',.004],['responsive',.008]]){
  h.elements.find(b=>b.dataset.aimFeel===mode).handlers.click();u.setGuideBalls([{n:0,x:30,y:25},{n:1,x:70,y:40}],0);
  r.handlers.pointerdown(e(100));r.handlers.pointerup(e(100.25));assert(Math.abs(read()-.25*gain)<=.0000501);
  r.handlers.pointerdown(e(100));r.handlers.pointerup(e(200));assert(Math.abs(read()-100.25*gain)<=.0000501);
 }
 u.setMovingBalls([{n:0,x:30,y:25,vx:10},{n:1,x:70,y:40}]);const before=read();r.handlers.keydown({key:'ArrowRight',preventDefault(){}});assert.equal(read(),before,'keyboard retuned a shot in motion');
}
console.log(JSON.stringify({passed:true,depthCases,occlusionPixels,rollingMaterials:5,rulerModes:3,rotatedInput:true,acceleratingDrop:true}));

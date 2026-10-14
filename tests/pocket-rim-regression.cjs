const assert=require('node:assert/strict'),fs=require('node:fs'),load=require('./load-game.cjs'),{createCanvas}=require('@napi-rs/canvas');
const source=fs.readFileSync(process.argv[2]||require('node:path').join(__dirname,'../game.js'),'utf8');
const instrumented=source.replace('window.__poolTest={',`window.__poolTest={
 rimFixture(index,lateral,drop,falling=true){
  const p=POCKET_GEOMETRY[index],depth=(p.well.x-p.mx)*p.nx+(p.well.y-p.my)*p.ny;
  const b=ball(1,p.well.x+p.nx*(p.fallFront-depth+.001)+p.tx*lateral,p.well.y+p.ny*(p.fallFront-depth+.001)+p.ty*lateral);
  state.phase='moving';state.stroke=null;state.balls=falling?[]:[b];state.pocketAnimations=[];previousPaint=null;
  if(falling){const a=makePocketFall(b,index);a.age=Math.sqrt(2*drop*R/GRAVITY);state.pocketAnimations=[a];}render();
 },rimBase(){state.phase='moving';state.balls=[];state.stroke=null;state.pocketAnimations=[];previousPaint=null;render();},`);
const g=load({source:instrumented,raster:true,mobile:true}),t=g.window.__poolTest,ratio=t.getRenderInfo().ratio;
const mask=createCanvas(g.canvas.width,g.canvas.height),m=mask.getContext('2d');m.setTransform(ratio,0,0,ratio,0,0);m.fillStyle='white';
const W=100,H=50,S=12.8,l=60,top=75,bottom=top+H*S,right=l+W*S,pockets=t.getPocketGeometry(),cut=pockets[0].radius*Math.SQRT2,sideL=50-pockets[1].radius,sideR=50+pockets[1].radius;
function polygon(points){m.beginPath();points.forEach(([x,y],i)=>i?m.lineTo(x,y):m.moveTo(x,y));m.closePath();m.fill();}
for(const [a,z] of [[cut,sideL],[sideR,W-cut]])for(const [y,sign] of [[top,1],[bottom,-1]])polygon([[l+a*S,y],[l+z*S,y],[l+z*S+17,y-sign*27],[l+a*S-17,y-sign*27]]);
for(const [x,sign] of [[l,-1],[right,1]])polygon([[x,top+cut*S],[x,bottom-cut*S],[x+sign*27,bottom-cut*S+17],[x+sign*27,top+cut*S-17]]);
t.rimBase();const context=g.canvas.getContext('2d');let protectedPixels=0,cases=0;
for(const p of pockets){
 const x=Math.max(0,Math.floor((l+p.mx*S-85)*ratio)),y=Math.max(0,Math.floor((top+p.my*S-85)*ratio)),size=Math.ceil(170*ratio);
 const base=context.getImageData(x,y,size,size).data,marks=m.getImageData(x,y,size,size).data;
 for(const lateral of [-p.radius*.55,0,p.radius*.55])for(const drop of [0,.15,.5,.9,1.01,2]){
  t.rimFixture(p.index,lateral,drop);const pixels=context.getImageData(x,y,size,size).data;
  // Check the solid rubber interior, excluding its antialiased edge, where
  // partial coverage legitimately mixes the sphere with the bevel.
  for(let yy=1;yy<size-1;yy++)for(let xx=1;xx<size-1;xx++){
   const i=(yy*size+xx)*4;
   if([-size-1,-size,-size+1,-1,0,1,size-1,size,size+1].every(o=>marks[i+o*4+3]===255)){
    protectedPixels++;for(let c=0;c<3;c++)assert(Math.abs(pixels[i+c]-base[i+c])<=1,`pocket ${p.index}, offset ${lateral}, depth ${drop}: ball painted through cushion`);
   }
  }cases++;
 }
 t.rimBase();
}
assert(protectedPixels>500);console.log(JSON.stringify({passed:true,pockets:6,cases,protectedPixels,fullCushionOcclusion:true}));

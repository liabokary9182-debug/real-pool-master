const assert=require('node:assert/strict'),load=require('./load-game.cjs'),{createCanvas}=require('@napi-rs/canvas');
const g=load({raster:true,mobile:true,dpr:3,source:process.argv[2]?require("node:fs").readFileSync(process.argv[2],"utf8"):null}),t=g.window.__poolTest,ratio=t.getRenderInfo().ratio;
t.setMovingBalls([{n:0,x:50,y:25}]);const base=g.canvas.getContext('2d').getImageData(0,0,g.canvas.width,g.canvas.height).data;
const mask=createCanvas(g.canvas.width,g.canvas.height),m=mask.getContext('2d');m.setTransform(ratio,0,0,ratio,0,0);m.fillStyle='white';
let protectedPixels=0;
for(const p of t.getPocketGeometry())for(const face of p.faces){
  const a={x:60+face.ax*12.8,y:75+face.ay*12.8},b={x:60+face.bx*12.8,y:75+face.by*12.8},horizontal=Math.abs(face.ay)<1e-6||Math.abs(face.ay-50)<1e-6;
  const ox=horizontal?(face.ax>p.mx?-17:17):(face.ax<50?-27:27),oy=horizontal?(face.ay<25?-27:27):(face.ay>p.my?-17:17);
  m.clearRect(0,0,1400,790);m.beginPath();m.moveTo(a.x,a.y);m.lineTo(b.x,b.y);m.quadraticCurveTo(b.x-p.nx*5,b.y-p.ny*5,b.x-p.nx*10,b.y-p.ny*10);m.lineTo(a.x+ox,a.y+oy);m.closePath();m.fill();
  const marks=m.getImageData(0,0,mask.width,mask.height).data;
  t.setMovingBalls([{n:0,x:50,y:25},{n:1,x:(face.ax+face.bx)/2,y:(face.ay+face.by)/2}]);const pixels=g.canvas.getContext('2d').getImageData(0,0,g.canvas.width,g.canvas.height).data;
  for(let i=0;i<marks.length;i+=4)if(marks[i+3]===255){protectedPixels++;for(let c=0;c<3;c++)assert(Math.abs(pixels[i+c]-base[i+c])<=1,`ball crossed foreground jaw ${p.index}`);}
}
assert(protectedPixels>500);console.log(JSON.stringify({passed:true,pockets:6,facings:12,protectedPixels}));

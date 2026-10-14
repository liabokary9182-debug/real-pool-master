const assert=require('node:assert/strict'),fs=require('node:fs'),load=require('./load-game.cjs');
const source=fs.readFileSync(process.argv[2]||require('node:path').join(__dirname,'../game.js'),'utf8');
let taps=0,drags=0;
for(const rotated of [false,true]){
 const g=load({source,mobile:true}),t=g.window.__poolTest;
 if(rotated){g.ids.get('mobile-pool-preview').classList.add('is-landscape');g.canvas.getBoundingClientRect=()=>({left:0,top:0,right:790,width:790,height:1400});}
 const e=(x,y,id=1)=>({pointerId:id,clientX:rotated?790-y:x,clientY:rotated?x:y,preventDefault(){}});
 const read=()=>parseFloat(g.ids.get('angleReadout').textContent);
 const angleDelta=(a,b)=>(a-b+540)%360-180;
 for(let degree=-180;degree<180;degree+=15){
  const rad=degree*Math.PI/180,x=700+180*Math.cos(rad),y=395+180*Math.sin(rad);
  t.setGuideBalls([{n:0,x:50,y:25}],.4);
  g.canvas.handlers.pointerdown(e(x,y));g.canvas.handlers.pointermove(e(x+.8,y-.6));g.canvas.handlers.pointerup(e(x+.8,y-.6));
  assert(Math.abs(angleDelta(read(),degree))<.001,`jitter blocked tap ${degree}/${rotated}: ${read()}`);taps++;
  for(const [dx,dy] of [[80,0],[-80,0],[0,80],[0,-80]]){
   t.setGuideBalls([{n:0,x:50,y:25}],rad);const before=read();
   g.canvas.handlers.pointerdown(e(400,300));
   // Initial subpixel movement is perpendicular to the deliberate swipe.
   g.canvas.handlers.pointermove(e(400+(dy?.6:0),300+(dx?.6:0)));
   g.canvas.handlers.pointermove(e(400+dx,300+dy));g.canvas.handlers.pointerup(e(400+dx,300+dy));
   const expected=Math.sign(dx||dy)*.48;
   assert(Math.abs(angleDelta(read(),before)-expected)<.0002,`axis dead zone ${degree}/${rotated}/${dx},${dy}`);drags++;
  }
 }
 // Cancel from another finger cannot roll back the active gesture.
 t.setGuideBalls([{n:0,x:50,y:25}],0);
 g.canvas.handlers.pointerdown(e(400,300));g.canvas.handlers.pointermove(e(480,300));
 g.canvas.handlers.pointercancel(e(480,300,2));g.canvas.handlers.pointerup(e(480,300));assert(Math.abs(read()-.48)<.0002);
}
console.log(JSON.stringify({passed:true,taps,drags,fullCircle:true,initialJitterIgnored:true,rotatedInput:true}));

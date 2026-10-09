const assert=require('node:assert/strict');
const loadGame=require('./load-game.cjs');
let cases=0,samples=0;
for(let pocket=0;pocket<6;pocket++)for(const speed of [6,18,50,120])for(const angle of [-25,0,25]){
  const {window:w}=loadGame(),t=w.__poolTest,p=t.getPocketGeometry()[pocket];
  t.pocketRollingTest(pocket,angle,speed);let found=false,last=null;
  for(let frame=0;frame<350;frame++){
    w.advanceTime(1000/180);const a=t.getFallAnimations().find(a=>a.n===1);
    if(!a){if(found)break;continue;}found=true;samples++;
    assert(Math.hypot(a.x-p.well.x,a.y-p.well.y)<=p.fallRadius+1e-8,`well overshoot: ${pocket}/${speed}/${angle}`);
    assert((a.x-p.mx)*p.nx+(a.y-p.my)*p.ny>=p.fallFront-1e-8,'fall crossed the shelf');
    assert(a.scale>0&&a.scale<=1&&a.alpha>=0&&a.alpha<=1);
    if(last){assert(a.scale<=last.scale+1e-8);assert(a.alpha<=last.alpha+1e-8);}
    last=a;
  }
  assert(found,`missing fall: ${pocket}/${speed}/${angle}`);
  w.advanceTime(1000);assert.equal(t.getFallAnimations().length,0,'fall never cleared');cases++;
}
console.log(JSON.stringify({passed:true,pocketCases:cases,fallSamples:samples,constrainedWell:true}));

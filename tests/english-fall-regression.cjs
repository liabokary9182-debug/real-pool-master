const assert=require('node:assert/strict'),load=require('./load-game.cjs');
const {window:w}=load(),t=w.__poolTest;
const energy=b=>b.vx*b.vx+b.vy*b.vy+.4*b.spin*b.spin;
let railCases=0;
for(const [nx,ny] of [[0,1],[0,-1],[1,0],[-1,0]]){
  const heading=Math.atan2(-ny,-nx),rightX=ny,rightY=-nx;
  for(const sideSign of [-1,1]){
    let last=0;
    for(const strength of [.3,.65,.95]){
      const side=sideSign*strength,b=t.launchBall(55,heading+side*.018,side),r=t.railTest(b,nx,ny);
      const kick=(r.vx*rightX+r.vy*rightY)*sideSign;
      assert(kick>last+1e-6,'stronger English did not increase the correct-side rebound');last=kick;
      assert(energy(r)<=energy(b)+1e-6,'cushion created energy');railCases++;
      // Run the actual fixed-step physics with the same launch toward each rail.
      const entries=[{...b,n:0,x:nx===1?5:nx===-1?95:30,y:ny===1?5:ny===-1?45:25},{n:1,x:75,y:38}];
      t.setMovingBalls(entries);let reflected=false;
      for(let step=0;step<400;step++){
        w.advanceTime(1000/180);const c=JSON.parse(w.render_game_to_text()).balls[0];
        if(c.vx*nx+c.vy*ny>.1){assert((c.vx*rightX+c.vy*rightY)*sideSign>0,'live physics rebounded on the wrong side');reflected=true;break;}
      }
      assert(reflected,'normal incident fixture never hit its rail');
    }
  }
  const neutral=t.railTest(t.launchBall(55,heading),nx,ny);
  assert(Math.abs(neutral.vx*rightX+neutral.vy*rightY)<1e-8,'centre-ball shot gained side deflection');
}
for(let index=0;index<6;index++){
  const p=t.getPocketGeometry()[index],x=p.well.x,y=p.well.y;
  for(const speed of [6,50,120]){
    const vx=p.nx*speed,vy=p.ny*speed,zero=t.sampleFall(index,x,y,vx,vy,0),a=t.sampleFall(index,x,y,vx,vy,1e-6);
    assert.equal(zero.x,x);assert.equal(zero.y,y);assert.equal(zero.scale,1);assert.equal(zero.alpha,1);
    assert(Math.abs((a.x-x)/1e-6-vx)<1e-6);assert(Math.abs((a.y-y)/1e-6-vy)<1e-6);
    assert.equal(a.vx,vx);assert.equal(a.vy,vy);assert(a.q.some((v,i)=>Math.abs(v-zero.q[i])>1e-8),'rolling orientation stopped at the lip');
  }
}
const sounds=[];w.PoolAudio={play:(kind,impact)=>sounds.push({kind,impact})};
t.pocketRollingTest(1,0,18);let entry=false;
for(let i=0;i<400;i++){
  w.advanceTime(1000/180);const a=t.getFallAnimations()[0];
  if(a&&!entry){entry=true;assert.equal(sounds.filter(s=>s.kind==='pocket').length,0,'sound fired before the drop');}
}
assert(entry);const pocketSounds=sounds.filter(s=>s.kind==='pocket');assert.equal(pocketSounds.length,1);assert(pocketSounds[0].impact>30,'slow roll produced an inaudible bottom impact');
console.log(JSON.stringify({passed:true,railCases,actualPhysics:true,entryVelocityAndRotationContinuous:true,singleBottomSound:true}));

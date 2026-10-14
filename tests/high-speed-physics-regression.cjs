const assert=require('node:assert/strict'),fs=require('node:fs'),load=require('./load-game.cjs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../game.js'),'utf8').replace('window.__poolTest={',`window.__poolTest={
  physicsFixture(entries,dt){state.shot=null;const balls=entries.map(q=>Object.assign(ball(q.n,q.x,q.y),q));physicsStep(balls,dt);return balls;},`);
const t=load({source}).window.__poolTest,R=1.125*1.05*1.05;
const energy=balls=>balls.reduce((sum,b)=>sum+b.vx*b.vx+b.vy*b.vy+.4*b.spin*b.spin,0);
let checked=0;
for(const speed of [30,90,180,300])for(const angle of [0,.2,.5]){
 let balls=[{n:0,x:45,y:25,vx:speed*Math.cos(angle),vy:speed*Math.sin(angle),rollVx:speed*Math.cos(angle),rollVy:speed*Math.sin(angle),spin:0},{n:1,x:55,y:25,vx:-speed,vy:0,rollVx:-speed,rollVy:0,spin:0}];
 const before=energy(balls);let hit=false;
 for(let i=0;i<60;i++){balls=t.physicsFixture(balls,1/180);if(balls[0].vx<0)hit=true;assert(energy(balls)<=before+1e-6,'collision generated kinetic energy');}
 if(angle===0)assert(hit,`head-on ${speed}: balls tunnel through one another`);
 assert(Math.hypot(balls[0].x-balls[1].x,balls[0].y-balls[1].y)>=2*R-.02,'persistent ball overlap');checked++;
}
console.log(JSON.stringify({passed:true,highSpeedFixtures:checked,speeds:[30,90,180,300],energyBounded:true,noHeadOnTunnelling:true}));

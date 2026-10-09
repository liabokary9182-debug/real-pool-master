const assert=require('node:assert/strict'),load=require('./load-game.cjs');
const {window:w}=load(),t=w.__poolTest;w.crypto={getRandomValues:a=>{a[0]=725;return a;}};
t.openTestMatch('eight');const start=t.getBallStates();assert.equal(start.length,16,'Chinese eight rack must retain 15 object balls');
const cue=start.find(b=>b.n===0);assert(cue.x<=25&&cue.y>1.3&&cue.y<48.7,'break cue outside legal head area');
for(let i=1;i<start.length;i++)for(let j=i+1;j<start.length;j++)assert(Math.hypot(start[i].x-start[j].x,start[i].y-start[j].y)>=2*1.125*1.05*1.05-.007,'rack overlaps');
t.fireTest();w.advanceTime(600);const firstHit=t.getShotSummary().firstHit;w.advanceTime(7400);const balls=t.getBallStates().filter(b=>b.n>0&&!b.pocketed),spread=balls.reduce((sum,b)=>sum+Math.hypot(b.x-78,b.y-25),0)/balls.length;
assert(spread>18,'opening remained too concentrated for the reference rack');assert(balls.filter(b=>b.hitRail).length>=4,'insufficient object-ball rail travel');assert.equal(firstHit,start[1].n,'break missed head ball');assert(balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)));
console.log(JSON.stringify({passed:true,objectBalls:15,spread:+spread.toFixed(2),legalHeadContact:true}));

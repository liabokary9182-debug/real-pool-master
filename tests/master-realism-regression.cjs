const assert=require('node:assert/strict');
const load=require('./load-game.cjs');
(async()=>{
  const {window:w}=load(),t=w.__poolTest;w.setTimeout=fn=>setImmediate(fn);
  const r=t.assessAttack({cd:65,pd:50,cos:Math.cos(70*Math.PI/180)},{x:70,y:1.25});
  assert(r.unrealistic,'frozen long thin cut must be rejected');
  assert(!t.assessAttack({cd:65,pd:50,cos:.99},{x:70,y:1.25}).unrealistic,'straight rail pot should remain available');
  assert(!t.assessAttack({cd:15,pd:10,cos:.7},{x:50,y:25}).unrealistic,'short ordinary cut rejected');
  const setups=[
    [{n:0,x:50,y:35},{n:1,x:50,y:12},{n:9,x:80,y:36}],
    [{n:0,x:25,y:30},{n:1,x:50,y:18},{n:9,x:80,y:32}]
  ];
  const plans=[];
  for(const entries of setups){
    const out=await t.planAI(entries,'nine');assert(out.plan,'no plan');
    assert(out.result.legal&&out.result.safe,'master chose illegal/scratch route');
    assert(['attack','bank','kick'].includes(out.plan.type),'credible attack replaced by defence');
    assert(out.plan.positionPlanned,'cue leave not refined');
    const c=out.result.balls.find(b=>b.n===0);assert(c&&!c.pocketed);
    plans.push({type:out.plan.type,power:out.plan.power,spin:[out.plan.spinX||0,out.plan.spinY||0],potted:out.result.potted});
  }
  assert(plans.some(p=>p.power>=35),'all master attacks remained soft pushes');
  console.log(JSON.stringify({passed:true,physicalPotting:true,realisticLongRailFilter:true,plans}));
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict'),fs=require('node:fs'),load=require('./load-game.cjs');
const {window:w}=load({source:process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):null}),t=w.__poolTest,R=1.125*1.05*1.05;
let cases=0;
for(const power of [35,70,100])for(const gap of [0,.01,.08]){
 t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:40,y:25},{n:2,x:40+(2*R+gap)*Math.SQRT1_2,y:25+(2*R+gap)*Math.SQRT1_2}],0,power);
 const guide=t.getDisplayGuide();assert.equal(guide.targetNumber,1);
 assert(guide.targetPath.every(p=>p.x<40+.6),`guide continued through touching ball: power=${power}, gap=${gap}, end=${guide.targetPath.at(-1).x}`);cases++;
}
console.log(JSON.stringify({passed:true,touchingClusterCases:cases}));

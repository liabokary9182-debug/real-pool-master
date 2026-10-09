const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const channels=[],pending=[];
class Audio{
 constructor(src){this.src=src;this.paused=true;this.muted=false;channels.push(this);}
 play(){this.paused=false;if(this.muted)return new Promise(resolve=>pending.push(resolve));return Promise.resolve();}
 pause(){this.paused=true;}
}
const element={addEventListener(){},classList:{contains:()=>true}};
const w={Audio,performance,document:{getElementById:()=>element,addEventListener(){}},setTimeout:()=>1,clearTimeout(){},console,addEventListener(){}};w.window=w;
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../audio.js'),'utf8'),w);
(async()=>{
 w.PoolAudio.unlock();assert(pending.length>=20);
 w.PoolAudio.play('pocket',55);const pocket=channels.find(c=>c.src.includes('pocket-leather')&&!c.muted);
 assert(pocket&&!pocket.paused,'pocket did not start during sound prewarming');
 pending.forEach(resolve=>resolve());await Promise.resolve();await Promise.resolve();
 assert(!pocket.paused,'a delayed sound-unlock callback silenced the current pocket impact');assert(pocket.volume>.5);
 console.log(JSON.stringify({passed:true,delayedUnlockDoesNotStopPocket:true,nativePocketAudible:true}));
})().catch(e=>{console.error(e);process.exitCode=1});

const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const handlers={},hint={hidden:true};let allowed=false,introAttempts=0,ready=[];
class Audio{
  constructor(src){this.src=src;this.paused=true;this.events={};}
  addEventListener(k,f){this.events[k]=f;}
  play(){if(this.src.includes('intro')){introAttempts++;if(!allowed)return Promise.reject(Error('autoplay blocked'));}this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
}
const element={addEventListener(){},classList:{contains:()=>false}},w={Audio,performance,console,document:{getElementById:id=>id==='introStatus'?hint:element,addEventListener:(k,f)=>handlers[k]=f},setTimeout:()=>1,clearTimeout(){},addEventListener(){},PoolStartup:{ready:task=>ready.push(task)}};w.window=w;
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../audio.js'),'utf8'),w);
(async()=>{
  await Promise.resolve();await Promise.resolve();assert.equal(introAttempts,1,'intro waits for window.load');assert(!hint.hidden,'blocked autoplay has no welcome-page hint');
  allowed=true;handlers.pointerdown();await Promise.resolve();assert(w.PoolAudio.introPlaying(),'welcome gesture did not start music');assert(hint.hidden);
  console.log(JSON.stringify({passed:true,immediateAutoplayAttempt:true,welcomeGestureRetry:true}));
})().catch(e=>{console.error(e);process.exitCode=1});

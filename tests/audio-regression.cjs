const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const ids=new Map(),documentHandlers={};
function element(){
  const handlers={};
  return {handlers,hidden:true,textContent:'',files:[],addEventListener:(name,fn)=>handlers[name]=fn,setAttribute(){}};
}
const document={
  getElementById(id){if(!ids.has(id))ids.set(id,element());return ids.get(id);},
  addEventListener(name,fn){documentHandlers[name]=fn;},
  hidden:false
};
const instances=[];
class MockAudio{
  constructor(src=''){this.src=src;this.currentTime=0;this.volume=1;this.playbackRate=1;this.muted=false;this.paused=true;instances.push(this);}
  play(){this.paused=false;MockAudio.playCount++;return Promise.resolve();}
  pause(){this.paused=true;}
}
MockAudio.playCount=0;
const sandbox={document,Audio:MockAudio,performance,setTimeout:fn=>{fn();return 1;},clearTimeout(){},console,fetch:()=>Promise.reject(Error('unused')),URL};
sandbox.window=sandbox;sandbox.addEventListener=()=>{};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../audio.js'),'utf8'),sandbox);

(async()=>{
  sandbox.PoolAudio.unlock();
  await Promise.resolve();await Promise.resolve();
  const afterUnlock=MockAudio.playCount;
  sandbox.PoolAudio.play('cue',70);
  sandbox.PoolAudio.play('ball',55);
  sandbox.PoolAudio.play('rail',45);
  sandbox.PoolAudio.play('pocket',60);
  await Promise.resolve();
  assert(MockAudio.playCount-afterUnlock>=5,'effect calls did not reach native audio channels');
  assert.deepEqual({...sandbox.PoolAudio.stats},{cue:1,ball:1,rail:1,pocket:1});
  assert.equal(sandbox.PoolAudio.musicInfo().source,'provided-local-audio');
  assert.equal(typeof sandbox.PoolAudio.setMusic,'undefined','obsolete remote music controller still exposed');
  assert(instances.every(a=>!a.src.startsWith('https:')),'external music source remained');
  assert(instances.length>=16,'not enough reusable audio channels for rack collisions');
  await sandbox.PoolAudio.startIntro();
  assert.equal(sandbox.PoolAudio.introPlaying(),true,'loading music did not start');
  sandbox.PoolAudio.stopIntro(false);
  assert.equal(sandbox.PoolAudio.introPlaying(),false,'loading music did not stop at match start');
  assert.equal(typeof sandbox.PoolAudio.startGameMusic,'function','game music start control missing');
  assert.equal(typeof sandbox.PoolAudio.stopGameMusic,'function','game music stop control missing');
  console.log(JSON.stringify({passed:true,nativeChannels:instances.length,effectStarts:MockAudio.playCount-afterUnlock}));
})().catch(error=>{console.error(error);process.exitCode=1;});

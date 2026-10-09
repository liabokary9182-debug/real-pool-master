const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const started=[],oscillators=[],gains=[];
const param=()=>({value:0,setValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.peak=Math.max(this.peak||0,v);},linearRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
const node=()=>({connect(){},disconnect(){}});
class AudioContext{
  constructor(){this.currentTime=1;this.state='running';this.sampleRate=48000;this.destination=node();}
  resume(){return Promise.resolve();}
  createGain(){const n={...node(),gain:param()};gains.push(n);return n;}
  createDynamicsCompressor(){return {...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
  createAnalyser(){return {...node(),fftSize:1024};}
  createBuffer(channels,length,sampleRate){const data=new Float32Array(length);return {length,sampleRate,numberOfChannels:channels,duration:length/sampleRate,getChannelData:()=>data};}
  decodeAudioData(){const b=this.createBuffer(1,48000,48000);b.getChannelData(0)[10]=.8;return Promise.resolve(b);}
  createBufferSource(){return {...node(),playbackRate:param(),start(){started.push(this);},stop(){}};}
  createBiquadFilter(){return {...node(),frequency:param(),Q:param()};}
  createOscillator(){const n={...node(),frequency:param(),start(){oscillators.push(this);},stop(){}};return n;}
}
class Audio{play(){return Promise.resolve();}pause(){}}
const document={getElementById:()=>({addEventListener(){},classList:{contains:()=>false}}),addEventListener(){}};
const w={Audio,AudioContext,document,console,performance,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}),setTimeout:()=>1,clearTimeout(){},addEventListener(){}};w.window=w;
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../audio.js'),'utf8'),w);
(async()=>{
  w.PoolAudio.unlock();await w.PoolAudio.waitForSamples();assert(w.PoolAudio.samplesReady());
  w.PoolAudio.play('ball',10);const softGain=gains.at(-1).gain.peak;
  assert.equal(started.at(-1).buffer.length,4800,'ball did not use onset-trimmed recording');
  w.PoolAudio.play('ball',90);const loudGain=gains.at(-1).gain.peak;
  assert(loudGain>softGain*2,'soft and hard collisions have indistinguishable volume');
  const before=started.length,tones=oscillators.length;w.PoolAudio.play('pocket',60);
  assert.equal(started.length-before,2,'pocket repeats the impact recording');
  assert.equal(oscillators.length-tones,1,'pocket still adds multiple metallic rings');
  assert(started.every(s=>s.playbackRate.value===0||s.playbackRate.value>=.9),'real recordings unnaturally slowed');
  console.log(JSON.stringify({passed:true,recordedBall:true,impactDynamics:true,singlePocketImpact:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});

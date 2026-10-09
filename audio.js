(() => {
  'use strict';
  const startButton=document.getElementById('startBtn');
  const introMusic=new Audio('./sounds/xiaotang-intro.mp3');
  introMusic.preload='auto';introMusic.loop=true;introMusic.playsInline=true;introMusic.volume=.32;
  const AudioEngine=window.AudioContext||window.webkitAudioContext;
  let context=null,effects=null,limiter=null,meter=null,recordings=[],loading=null,effectLoading=null;
  let lastBall=0,noiseBuffer=null;
  let nativeUnlocked=false,nativeWarning=false;
  let introWanted=true,introFadeTicket=0;
  let gameMusicBuffer=null,gameMusicLoading=null,gameMusicWanted=false,gameMusicMaster=null,gameMusicTimer=null,gameMusicNextStart=0;
  const gameMusicSources=new Set();
  let gameMusicTicket=0;
  const effectStats={cue:0,ball:0,rail:0,pocket:0},lastEffect={cue:-1,ball:-1,rail:-1,pocket:-1};
  const lastWeight={cue:0,ball:0,rail:0,pocket:0};
  const effectSources={
    cue:['./sounds/cue-soft.wav'],
    ball:['./sounds/ball-soft-1.wav','./sounds/ball-soft-2.wav','./sounds/ball-soft-3.wav'],
    rail:['./sounds/rail-soft.wav'],
    pocket:['./sounds/pocket-soft.wav','./sounds/rail-soft.wav']
  };
  const nativePools={},nativeCursor={cue:0,ball:0,rail:0,pocket:0};
  const decodedPools={cue:[],ball:[],rail:[],pocket:[]},decodedCursor={cue:0,ball:0,rail:0,pocket:0};
  for(const [kind,urls] of Object.entries(effectSources)){
    nativePools[kind]=Array.from({length:kind==='ball'?8:kind==='pocket'?5:4},(_,i)=>{
      const channel=new Audio(urls[i%urls.length]);channel.preload='auto';channel.playsInline=true;return channel;
    });
  }

  function unlockNative(){
    if(nativeUnlocked)return;
    nativeUnlocked=true;
    for(const pool of Object.values(nativePools))for(const channel of pool){
      channel.muted=true;channel.currentTime=0;
      const started=channel.play();
      if(started?.then)started.then(()=>{channel.pause();channel.currentTime=0;channel.muted=false;}).catch(()=>{channel.muted=false;nativeUnlocked=false;});
      else{channel.pause();channel.currentTime=0;channel.muted=false;}
    }
  }

  function startIntroMusic(){
    introWanted=true;introFadeTicket++;introMusic.volume=.32;
    if(!introMusic.paused)return Promise.resolve();
    const started=introMusic.play();
    if(started?.catch)started.catch(()=>{});
    return started||Promise.resolve();
  }
  function stopIntroMusic(fade=true){
    introWanted=false;const ticket=++introFadeTicket;
    if(!fade){introMusic.pause();introMusic.currentTime=0;introMusic.volume=.32;return;}
    const startVolume=introMusic.volume,steps=8;
    const fadeStep=step=>{
      if(ticket!==introFadeTicket)return;
      if(step>=steps){introMusic.pause();introMusic.currentTime=0;introMusic.volume=.32;return;}
      introMusic.volume=startVolume*(1-(step+1)/steps);setTimeout(()=>fadeStep(step+1),40);
    };
    fadeStep(0);
  }
  function clearGameMusicSources(){
    clearTimeout(gameMusicTimer);gameMusicTimer=null;
    for(const source of gameMusicSources){try{source.stop();}catch{}}
    gameMusicSources.clear();
    try{gameMusicMaster?.disconnect();}catch{}gameMusicMaster=null;
  }
  function fillGameMusicQueue(){
    if(!gameMusicWanted||!context||!gameMusicBuffer||!gameMusicMaster)return;
    const overlap=Math.min(.65,gameMusicBuffer.duration*.08),period=gameMusicBuffer.duration-overlap;
    while(gameMusicNextStart<context.currentTime+60){
      const source=context.createBufferSource(),crossfade=context.createGain(),start=gameMusicNextStart;
      source.buffer=gameMusicBuffer;
      crossfade.gain.setValueAtTime(.0001,start);
      crossfade.gain.linearRampToValueAtTime(1,start+overlap);
      crossfade.gain.setValueAtTime(1,start+gameMusicBuffer.duration-overlap);
      crossfade.gain.linearRampToValueAtTime(.0001,start+gameMusicBuffer.duration);
      source.connect(crossfade);crossfade.connect(gameMusicMaster);gameMusicSources.add(source);
      source.onended=()=>{gameMusicSources.delete(source);source.disconnect();crossfade.disconnect();};
      source.start(start);source.stop(start+gameMusicBuffer.duration+.02);gameMusicNextStart+=period;
    }
    gameMusicTimer=setTimeout(fillGameMusicQueue,20000);
  }
  async function startGameMusic(){
    stopGameMusic(false);const ticket=gameMusicTicket;gameMusicWanted=true;ensureContext();
    try{await gameMusicLoading;}catch{}
    if(ticket!==gameMusicTicket||!gameMusicWanted||!context||!gameMusicBuffer)return false;
    if(context.state==='suspended')try{await context.resume();}catch{}
    if(ticket!==gameMusicTicket||!gameMusicWanted||context.state!=='running')return false;
    gameMusicMaster=context.createGain();gameMusicMaster.gain.value=.20;gameMusicMaster.connect(limiter);
    gameMusicNextStart=context.currentTime+.025;fillGameMusicQueue();return true;
  }
  function stopGameMusic(fade=true){
    gameMusicTicket++;gameMusicWanted=false;clearTimeout(gameMusicTimer);gameMusicTimer=null;
    if(!gameMusicMaster||!context||!fade){clearGameMusicSources();return;}
    const master=gameMusicMaster,now=context.currentTime;
    master.gain.cancelScheduledValues(now);master.gain.setValueAtTime(Math.max(.0001,master.gain.value),now);master.gain.linearRampToValueAtTime(.0001,now+.24);
    setTimeout(()=>{if(gameMusicMaster===master)clearGameMusicSources();},280);
  }

  function nativeEffect(kind,weight,delay=0,tail=false){
    const run=()=>{
      const pool=nativePools[kind],channel=pool[nativeCursor[kind]++%pool.length];
      channel.pause();channel.currentTime=0;channel.muted=false;
      channel.playbackRate=kind==='cue'?.90:kind==='rail'?.70:kind==='pocket'?(tail?.62:.76):.88+.09*weight;
      channel.volume=Math.min(.88,(kind==='cue'?.28:kind==='ball'?.31:kind==='rail'?.23:.34)+(kind==='ball'?.48:.34)*weight)*(tail?.44:1);
      const started=channel.play();
      if(started?.catch)return started.catch(error=>{if(!nativeWarning){nativeWarning=true;console.warn('本地碰撞音效未能播放，改用合成备用音。',error);}throw error;});
      return Promise.resolve();
    };
    if(!delay)return run();
    return new Promise((resolve,reject)=>setTimeout(()=>run().then(resolve,reject),delay));
  }

  function bufferedEffect(kind,weight,delay=0,tail=false){
    const pool=decodedPools[kind];
    if(!context||context.state!=='running'||!pool?.length)return false;
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    const at=context.currentTime+delay;
    source.buffer=pool[decodedCursor[kind]++%pool.length];
    source.playbackRate.value=kind==='cue'?.90:kind==='rail'?.70:kind==='pocket'?(tail?.62:.76):.88+.09*weight;
    filter.type='lowpass';filter.frequency.value=kind==='ball'?5800:kind==='cue'?4200:kind==='rail'?2400:3100;
    const volume=Math.min(.88,(kind==='cue'?.28:kind==='ball'?.31:kind==='rail'?.23:.34)+(kind==='ball'?.48:.34)*weight)*(tail?.44:1);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+.0008);
    gain.gain.exponentialRampToValueAtTime(.0001,at+Math.min(.14,source.buffer.duration/source.playbackRate.value));
    source.connect(filter);filter.connect(gain);gain.connect(effects);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start(at);
    return true;
  }

  function ensureContext(){
    if(!AudioEngine)return false;
    if(!context){
      try{context=new AudioEngine({latencyHint:'interactive'});}catch{context=new AudioEngine();}
      limiter=context.createDynamicsCompressor();limiter.threshold.value=-7;limiter.knee.value=4;
      limiter.ratio.value=5;limiter.attack.value=.004;limiter.release.value=.09;
      meter=context.createAnalyser();meter.fftSize=1024;limiter.connect(meter);meter.connect(context.destination);
      effects=context.createGain();effects.gain.value=.66;effects.connect(limiter);
      loading=Promise.all([1,2,3].map(async i=>{
        const response=await fetch(`./sounds/ball-clack-${i}.wav`);
        if(!response.ok)throw Error(`Pool sound ${i}: HTTP ${response.status}`);
        return context.decodeAudioData(await response.arrayBuffer());
      })).then(values=>{recordings=values.map(prepareClack);}).catch(error=>console.warn('台球录音未加载，使用柔和的合成回退音效。',error));
      effectLoading=Promise.all(Object.entries(effectSources).map(async([kind,urls])=>{
        const buffers=await Promise.all(urls.map(async url=>{
          const response=await fetch(url);if(!response.ok)throw Error(`${kind}: HTTP ${response.status}`);
          return context.decodeAudioData(await response.arrayBuffer());
        }));
        decodedPools[kind]=buffers;
      })).catch(error=>console.warn('低延迟音效未完成预热，暂用原生音频回退。',error));
      gameMusicLoading=fetch('./sounds/xiaotang-game-loop.m4a').then(response=>{
        if(!response.ok)throw Error(`Game music: HTTP ${response.status}`);return response.arrayBuffer();
      }).then(data=>context.decodeAudioData(data)).then(buffer=>{gameMusicBuffer=buffer;}).catch(error=>console.warn('对局背景音乐未加载。',error));
    }
    if(context.state==='suspended')context.resume().catch(()=>{});
    return true;
  }
  function prepareClack(buffer){
    const mono=new Float32Array(buffer.length);
    for(let channel=0;channel<buffer.numberOfChannels;channel++){
      const input=buffer.getChannelData(channel);
      for(let i=0;i<mono.length;i++)mono[i]+=input[i]/buffer.numberOfChannels;
    }
    let peak=0;for(const sample of mono)peak=Math.max(peak,Math.abs(sample));
    if(peak<.0001)return buffer;
    let onset=0;while(onset<mono.length&&Math.abs(mono[onset])<peak*.12)onset++;
    const start=Math.max(0,onset-Math.round(buffer.sampleRate*.0005));
    const length=Math.min(mono.length-start,Math.round(buffer.sampleRate*.10));
    const prepared=context.createBuffer(1,length,buffer.sampleRate),out=prepared.getChannelData(0);
    const fade=Math.max(1,Math.round(buffer.sampleRate*.004));
    for(let i=0;i<length;i++)out[i]=mono[start+i]*(.64/peak)*Math.min(1,(i+1)/(buffer.sampleRate*.00018),(length-i)/fade);
    return prepared;
  }
  function tone(at,f0,f1,length,volume,type='sine'){
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(f0,at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30,f1),at+length);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+.003);
    gain.gain.exponentialRampToValueAtTime(.0001,at+length);
    oscillator.connect(gain);gain.connect(effects);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillator.start(at);oscillator.stop(at+length+.01);
  }
  function softImpact(at,weight,length,cutoff,volume){
    if(!noiseBuffer){
      noiseBuffer=context.createBuffer(1,Math.ceil(context.sampleRate*.25),context.sampleRate);
      const data=noiseBuffer.getChannelData(0);let seed=8317;
      for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
    }
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    source.buffer=noiseBuffer;filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.5;
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*weight),at+.002);
    gain.gain.exponentialRampToValueAtTime(.0001,at+length);
    source.connect(filter);filter.connect(gain);gain.connect(effects);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start(at);source.stop(at+length+.005);
  }
  function recordedClack(at,weight,kind){
    if(!recordings.length)return false;
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    source.buffer=recordings[lastBall++%recordings.length];
    const length=kind==='cue'?.065:.06+.02*weight;
    source.playbackRate.value=kind==='cue'?.96:.94+.12*weight;
    filter.type='lowpass';filter.frequency.value=kind==='cue'?3600:4300+5000*weight;
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.exponentialRampToValueAtTime((kind==='cue'?.44:.7)*weight,at+.00055);
    gain.gain.exponentialRampToValueAtTime(.0001,at+length);
    source.connect(filter);filter.connect(gain);gain.connect(effects);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start(at);source.stop(at+length+.005);
    return true;
  }
  function metalRing(at,weight){
    // A damped steel-liner sound without the previous piercing high-frequency edge.
    tone(at,760,650,.075,.034*weight,'triangle');
    tone(at+.001,1120,980,.058,.024*weight,'sine');
    tone(at+.003,1650,1420,.041,.014*weight,'sine');
    softImpact(at,weight,.025,3200,.04);
  }
  function fallbackImpact(kind,at,weight){
    if(!context)return;
    if(kind==='cue'){softImpact(at,weight,.035,3000,.13);tone(at,620,310,.04,.065*weight);tone(at,150,85,.05,.02*weight);}
    else if(kind==='ball'){softImpact(at,weight,.018,3000+1800*weight,.13);tone(at,720,560,.02,.018*weight,'sine');}
  }
  function duckMusic(){
    if(gameMusicMaster&&gameMusicWanted&&context){const now=context.currentTime;gameMusicMaster.gain.cancelScheduledValues(now);gameMusicMaster.gain.setTargetAtTime(.10,now,.018);gameMusicMaster.gain.setTargetAtTime(.20,now+.22,.055);}
  }
  function play(kind,impact=20){
    if(!(kind in effectStats))return;
    effectStats[kind]++;
    const hasContext=ensureContext();
    const weight=Math.pow(Math.max(0,Math.min(1,impact/90)),.65);
    if(weight<.025)return;
    const at=hasContext?context.currentTime:performance.now()/1000,gap=kind==='ball'?.009:kind==='rail'?.025:.02;
    // A soft contact must not suppress a much harder rack collision.
    if(at-lastEffect[kind]<gap&&weight<=lastWeight[kind]*1.4)return;
    lastEffect[kind]=at;lastWeight[kind]=weight;
    const native=bufferedEffect(kind,weight)?Promise.resolve():nativeEffect(kind,weight);
    if(kind==='cue'){
      native.catch(()=>fallbackImpact(kind,at,weight));duckMusic();
    }else if(kind==='ball'){
      native.catch(()=>fallbackImpact(kind,at,weight));
    }else if(kind==='rail'){
      if(hasContext){softImpact(at,weight,.06,650,.065);tone(at,145,70,.07,.045*weight);}
    }else{
      if(!bufferedEffect('pocket',weight,.112,true))nativeEffect('pocket',weight,112,true).catch(()=>{});
      if(hasContext){
        softImpact(at+.018,weight,.045,1050,.085);tone(at+.018,185,92,.058,.04*weight,'triangle');
        metalRing(at+.092,.68+.32*weight);softImpact(at+.19,weight,.075,520,.075);tone(at+.19,128,70,.09,.038*weight);metalRing(at+.215,.26+.2*weight);
      }
    }
  }
  function unlockAudio(){unlockNative();return ensureContext();}
  startButton?.addEventListener('pointerdown',()=>{unlockAudio();startIntroMusic();},{passive:true});
  const firstGesture=()=>{unlockAudio();if(!document.getElementById('startOverlay')?.classList?.contains('hidden')||!document.getElementById('menuOverlay')?.classList?.contains('hidden'))startIntroMusic();};
  document.addEventListener('pointerdown',firstGesture,{capture:true,passive:true});
  document.addEventListener('touchstart',firstGesture,{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){context?.suspend();introMusic.pause();}
    else{context?.resume().catch(()=>{});if(introWanted)startIntroMusic();}
  });
  window.addEventListener?.('load',()=>{ensureContext();startIntroMusic();});
  window.PoolAudio={play,unlock:unlockAudio,stats:effectStats,contextState:()=>context?.state||'native-html-audio',
    samplesReady:()=>recordings.length===3,effectsReady:()=>Object.values(decodedPools).every(pool=>pool.length),waitForSamples:()=>Promise.all([loading,effectLoading].filter(Boolean)),
    outputLevel:()=>{if(!meter)return 0;const samples=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(samples);return Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);},
    startIntro:startIntroMusic,stopIntro:stopIntroMusic,introPlaying:()=>!introMusic.paused,
    startGameMusic,stopGameMusic,gameMusicPlaying:()=>gameMusicWanted&&!!gameMusicMaster,
    musicInfo:()=>({source:'provided-local-audio',state:gameMusicWanted?'game':introWanted?'intro':'stopped'})};
})();

(() => {
  'use strict';
  const startButton=document.getElementById('startBtn');
  const musicButton=document.getElementById('musicBtn');
  const musicFile=document.getElementById('musicFile');
  const musicPanel=document.getElementById('musicPanel'),musicStatus=document.getElementById('musicStatus');
  const AudioEngine=window.AudioContext||window.webkitAudioContext;
  let context=null,effects=null,limiter=null,meter=null,recordings=[],loading=null;
  let music=null,musicUrl=null,enabled=false,lastBall=0,noiseBuffer=null,duckTimer=null;
  const effectStats={cue:0,ball:0,rail:0,pocket:0},lastEffect={cue:-1,ball:-1,rail:-1,pocket:-1};
  const lastWeight={cue:0,ball:0,rail:0,pocket:0};

  function ensureContext(){
    if(!AudioEngine)return false;
    if(!context){
      context=new AudioEngine();
      limiter=context.createDynamicsCompressor();limiter.threshold.value=-15;limiter.knee.value=10;
      limiter.ratio.value=4;limiter.attack.value=.005;limiter.release.value=.12;
      meter=context.createAnalyser();meter.fftSize=1024;limiter.connect(meter);meter.connect(context.destination);
      effects=context.createGain();effects.gain.value=.85;effects.connect(limiter);
      loading=Promise.all([1,2,3].map(async i=>{
        const response=await fetch(`./sounds/ball-clack-${i}.wav`);
        if(!response.ok)throw Error(`Pool sound ${i}: HTTP ${response.status}`);
        return context.decodeAudioData(await response.arrayBuffer());
      })).then(values=>{recordings=values.map(prepareClack);}).catch(error=>console.warn('台球录音未加载，使用柔和的合成回退音效。',error));
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
    for(let i=0;i<length;i++)out[i]=mono[start+i]*(.55/peak)*Math.min(1,(i+1)/(buffer.sampleRate*.0003),(length-i)/fade);
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
    source.playbackRate.value=kind==='cue'?.96:1;
    filter.type='lowpass';filter.frequency.value=kind==='cue'?3200:3500+3500*weight;
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.exponentialRampToValueAtTime((kind==='cue'?.38:.42)*weight,at+.001);
    gain.gain.exponentialRampToValueAtTime(.0001,at+length);
    source.connect(filter);filter.connect(gain);gain.connect(effects);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start(at);source.stop(at+length+.005);
    return true;
  }
  function play(kind,impact=20){
    if(!(kind in effectStats))return;
    effectStats[kind]++;
    if(!ensureContext())return;
    const weight=Math.pow(Math.max(0,Math.min(1,impact/90)),.65);
    if(weight<.025)return;
    const at=context.currentTime,gap=kind==='ball'?.012:kind==='rail'?.025:.02;
    // A soft contact must not suppress a much harder rack collision.
    if(at-lastEffect[kind]<gap&&weight<=lastWeight[kind]*1.4)return;
    lastEffect[kind]=at;lastWeight[kind]=weight;
    if(kind==='cue'){
      if(!recordedClack(at,weight,kind)){softImpact(at,weight,.035,3000,.11);tone(at,620,310,.04,.06*weight);}
      tone(at,150,85,.05,.018*weight);
      if(enabled){music.volume=.11;clearTimeout(duckTimer);duckTimer=setTimeout(()=>{music.volume=.20;},260);}
    }else if(kind==='ball'){
      if(!recordedClack(at,weight,kind)){
        softImpact(at,weight,.018,3500+3500*weight,.14);
        tone(at,1250,950,.022,.025*weight);
      }
    }else if(kind==='rail'){
      softImpact(at,weight,.055,850,.075);
      tone(at,170,75,.065,.055*weight);
    }else{
      // The ball rolls over the shelf, then meets the pocket lining below it.
      softImpact(at+.12,weight,.085,390,.065);
      tone(at+.12,96,72,.085,.026*weight);
      softImpact(at+.22,weight*.38,.05,700,.025);
    }
  }
  function updateMusicButton(){
    musicButton.textContent=enabled?'♫ 音乐开':'♫ 音乐关';
    musicButton.setAttribute('aria-pressed',String(enabled));
    musicButton.setAttribute('aria-label',enabled?'关闭背景音乐':'播放背景音乐');
  }
  let musicTicket=0,wanted=false,musicState='idle';
  let musicTitle='Gymnopedie No. 1',musicArtist='Kevin MacLeod';
  music=new Audio('./sounds/table-piano.mp3');music.loop=true;music.volume=.20;music.preload='auto';
  function message(text){if(musicStatus)musicStatus.textContent=text;updateMusicButton();}
  async function setMusic(on){
    const ticket=++musicTicket;wanted=on;
    if(!on){music.pause();enabled=false;musicState='paused';message('背景音乐已暂停');return;}
    try{
      musicState='loading';
      await music.play();
      if(ticket!==musicTicket){if(!wanted)music.pause();return;}
      enabled=true;musicState='playing';message(`${musicArtist} · ${musicTitle} · 本地循环播放`);
    }catch{
      if(ticket!==musicTicket)return;
      enabled=false;musicState='blocked';message('点击顶部音乐键开始播放');
    }
  }
  musicFile?.addEventListener('change',async()=>{
    const file=musicFile.files?.[0];if(!file)return;
    musicTicket++;music.pause();music.src='';
    if(musicUrl)URL.revokeObjectURL(musicUrl);
    musicUrl=URL.createObjectURL(file);music.src=musicUrl;musicTitle=file.name;musicArtist='本机音频';
    await setMusic(true);
  });
  musicButton.addEventListener('click',()=>{ensureContext();return setMusic(!wanted);});
  document.getElementById('closeMusic')?.addEventListener('click',()=>{musicPanel.hidden=true;});
  document.getElementById('localMusicBtn')?.addEventListener('click',()=>musicFile?.click());
  document.addEventListener('pointerdown',e=>{
    ensureContext();
    if(e.target?.id!=='musicBtn')setMusic(true);
  },{once:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){context?.suspend();music.pause();}
    else{context?.resume().catch(()=>{});if(wanted)setMusic(true);}
  });
  window.PoolAudio={play,unlock:ensureContext,stats:effectStats,contextState:()=>context?.state||'unavailable',
    samplesReady:()=>recordings.length===3,waitForSamples:()=>loading||Promise.resolve(),
    outputLevel:()=>{if(!meter)return 0;const samples=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(samples);return Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);},
    setMusic,musicEnabled:()=>enabled,musicInfo:()=>({source:musicUrl?'local-import':'bundled-local',state:musicState,title:musicTitle,artist:musicArtist})};
  message('Gymnopedie No. 1 · Kevin MacLeod · CC BY 4.0 · 本地音频');
})();

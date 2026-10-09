(() => {
  'use strict';
  const $=id=>document.getElementById(id),boot=$('boot'),bar=$('bootProgress'),percent=$('bootPercent'),track=$('bootTrack'),rocket=$('bootRocket'),skip=$('skipBoot'),status=$('bootStatus'),help=$('bootHelp');
  const tasks=new Set();let dismissed=false,engineFailed=false,stylesFailed=false,engineRetry=0;
  const preview=new URLSearchParams(location.search).get('test')==='loading';
  const essentialReady=()=>tasks.has('game')&&tasks.has('styles');
  const finish=()=>{if(dismissed||!essentialReady())return;dismissed=true;boot.classList.add('done');setTimeout(()=>boot.remove(),600);};
  const progress=()=>{
    const value=essentialReady()?100:5+(tasks.has('styles')?20:0)+(tasks.has('game')?65:0)+(tasks.has('photo')?5:0)+(tasks.has('audio')?5:0);
    bar.style.width=`${value}%`;rocket.style.setProperty('--flight',String(value/100));percent.textContent=`${value}%`;track.setAttribute('aria-valuenow',String(value));
    if(essentialReady()){
      engineFailed=false;stylesFailed=false;boot.classList.add('arrived');status.textContent=preview?'加载界面预览 · 已准备就绪':'赛场已就绪，准备入场';skip.textContent='进入赛场';help.textContent='欢迎来到浮光竞技馆';
      if(!preview)setTimeout(finish,700);
    }else if(!engineFailed&&!stylesFailed)status.textContent=tasks.has('game')?'正在整理赛场画面':'正在加载比赛引擎';
  };
  const ready=task=>{tasks.add(task);if(task==='styles'&&window.dispatchEvent&&typeof Event==='function')window.dispatchEvent(new Event('resize'));progress();};
  const failEngine=()=>{if(tasks.has('game'))return;engineFailed=true;status.textContent='比赛引擎连接失败';help.textContent='点击重试，只重新加载游戏，不会刷新整个页面';skip.textContent='重试加载';};
  const styleFailed=()=>{stylesFailed=true;status.textContent='赛场画面加载失败';skip.textContent='重试加载';help.textContent='点击重试加载赛场画面';};
  const retryEngine=()=>{
    if(!engineFailed||tasks.has('game'))return;
    engineFailed=false;status.textContent='正在重新连接比赛引擎';skip.textContent='继续等待';
    const old=$('gameEngine'),script=document.createElement('script');script.id='gameEngine';script.async=true;script.src='./game.js?v=20261009-quality-v5&retry='+String(++engineRetry);script.onerror=failEngine;old?.remove();document.body.appendChild(script);
  };
  window.PoolStartup={ready,engineFailed:failEngine,styleFailed};
  const stylesheet=$('siteStyle');if(stylesheet?.sheet)ready('styles');else if(stylesheet?.dataset?.failed==='true')styleFailed();
  const photo=document.querySelector('.welcome-photo');if(!photo||photo.complete)ready('photo');else{photo.addEventListener('load',()=>ready('photo'),{once:true});photo.addEventListener('error',()=>ready('photo'),{once:true});}
  skip.addEventListener('click',()=>{
    if(essentialReady()){finish();return;}
    if(engineFailed)retryEngine();
    if(stylesFailed){stylesFailed=false;stylesheet.href='./site.css?v=20261009-flight-v6&retry='+String(Date.now());status.textContent='正在重新加载赛场画面';skip.textContent='继续等待';}
    if(!engineFailed&&!stylesFailed)help.textContent='仍在等待网络响应，请保持此页打开，无需反复刷新';
  });
  setTimeout(()=>{if(dismissed||essentialReady())return;if(!engineFailed&&!stylesFailed){status.textContent='网络连接较慢，仍在等待';help.textContent='请保持此页打开；资源完成后会自动进入';}},12000);
  window.addEventListener('offline',()=>{if(!dismissed)help.textContent='网络已断开，恢复连接后可重试加载';});
  window.addEventListener('online',()=>{if(engineFailed)retryEngine();});
  window.addEventListener('pageshow',()=>{if(essentialReady()&&dismissed)boot.classList.add('done');});
  progress();
})();

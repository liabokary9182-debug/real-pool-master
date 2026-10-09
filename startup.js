(() => {
  'use strict';
  const boot=document.getElementById('boot'),bar=document.getElementById('bootProgress'),percent=document.getElementById('bootPercent'),track=document.getElementById('bootTrack'),skip=document.getElementById('skipBoot');
  const tasks=new Set();let dismissed=false;
  const finish=()=>{if(dismissed)return;dismissed=true;boot.classList.add('done');setTimeout(()=>boot.remove(),600);};
  const ready=task=>{
    tasks.add(task);const value=Math.round(tasks.size/3*100);
    bar.style.width=`${value}%`;percent.textContent=`${value}%`;track.setAttribute('aria-valuenow',String(value));
    if(tasks.size===3)setTimeout(finish,280);
  };
  window.PoolStartup={ready};
  const photo=document.querySelector('.welcome-photo');
  if(!photo||photo.complete)ready('photo');else{photo.addEventListener('load',()=>ready('photo'),{once:true});photo.addEventListener('error',()=>ready('photo'),{once:true});}
  skip.addEventListener('click',()=>{if(tasks.has('game'))finish();else location.reload();});
  // Audio and decorative imagery never prevent an otherwise playable entry.
  setTimeout(()=>{
    if(dismissed)return;
    if(tasks.has('game')){ready('photo');ready('audio');}
    else{percent.textContent='连接较慢，点击重试';skip.textContent='重新加载';}
  },5000);
  window.addEventListener('pageshow',()=>{if(tasks.has('game')&&dismissed)boot?.classList.add('done');});
})();

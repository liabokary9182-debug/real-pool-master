// Included only in the offline review export, never in the hosted game.
const reviewBoot=$('boot');
function showReviewPage(page){
  state.aiTicket++;state.aiThinking=false;state.aiPlan=null;state.drag=null;state.stroke=null;state.windup=0;state.practice=null;
  state.pocketAnimations=[];state.phase='menu';state.opponent='local';
  for(const b of live())b.vx=b.vy=b.rollVx=b.rollVy=b.spin=0;
  for(const id of ['startOverlay','menuOverlay','practiceOverlay','spinOverlay','rulesOverlay','resultOverlay'])$(id).classList.add('hidden');
  reviewBoot.style.display='none';
  if(page===0){if(!reviewBoot.isConnected)document.querySelector('.mobile-game-surface').appendChild(reviewBoot);reviewBoot.classList.remove('done');reviewBoot.style.display='flex';document.body.setAttribute('data-screen','welcome');return;}
  if(page===1){document.body.setAttribute('data-screen','welcome');$('startOverlay').classList.remove('hidden');window.PoolAudio?.stopGameMusic();window.PoolAudio?.startIntro();return;}
  if(page>=2&&page<=4){setupChoice='ai';setupRuleset='eight';openSetup(['mode','rules','difficulty'][page-2]);return;}
  if(page===5){init('eight');return;}
  if(page===6){startPractice('draw');openSpinEditor();return;}
  if(page===7){init('nine');openPracticeMenu('nine');return;}
  if(page===8){startPractice('pocket');return;}
  if(page===9){init('eight');state.phase='gameover';state.matchScores=[2,1];state.scores=[7,5];
    document.body.setAttribute('data-screen','result');$('resultTitle').textContent='玩家 1 获胜';$('resultReason').textContent='示例画面 · 合法打进黑八';$('resultMode').textContent='八球 · 双人同屏';$('resultRack').textContent='第 3 局结束';
    for(let i=0;i<2;i++){$('resultName'+i).textContent='玩家 '+(i+1);$('resultWins'+i).textContent=state.matchScores[i];$('resultPots'+i).textContent=state.scores[i];$('resultPlayer'+i).classList.toggle('is-winner',i===0);}
    $('resultOverlay').classList.remove('hidden');render();
  }
}
window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='pool-review-page')return;showReviewPage(event.data.page);});
parent.postMessage({type:'pool-review-ready'},'*');

(() => {
  const root = document.getElementById('mobile-pool-preview');
  const button = document.getElementById('fullBtn');
  const feedback = document.getElementById('fullscreenFeedback');
  const welcomeButton=document.getElementById('welcomeFullscreen'),welcomeFeedback=document.getElementById('welcomeFullStatus');
  let busy = false;
  function active() {
    return document.fullscreenElement === root || document.webkitFullscreenElement === root || root.classList.contains('is-fitted');
  }
  function sync() {
    const entered = active();
    if(welcomeFeedback){welcomeFeedback.hidden=true;welcomeFeedback.textContent='';}
    root.classList.toggle('is-fullscreen', entered);
    button.textContent = entered ? '退出适屏' : '全屏 ⛶';
    button.setAttribute('aria-pressed', String(entered));
    button.setAttribute('aria-label', entered ? '退出全屏预览' : '全屏预览游戏');
    if(welcomeButton){welcomeButton.textContent=entered?'⛶ 退出全屏':'⛶ 全屏体验';welcomeButton.setAttribute('aria-pressed',String(entered));}
    if (entered) { feedback.hidden = true; feedback.textContent = ''; }
    window.dispatchEvent(new Event('resize'));
  }
  async function toggle() {
    if (busy) return;
    busy = true;
    window.PoolAudio?.unlock?.();
    if(!document.getElementById('startOverlay')?.classList.contains('hidden'))window.PoolAudio?.startIntro?.();
    button.disabled = true;
    if(welcomeButton)welcomeButton.disabled=true;
    feedback.hidden = true;
    try {
      if (active()) {
        if(root.classList.contains('is-fitted')){root.classList.remove('is-fitted');sync();return;}
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (!exit) throw new Error('Fullscreen unavailable');
        await exit.call(document);
      } else {
        const enter = root.requestFullscreen || root.webkitRequestFullscreen;
        if (!enter) throw new Error('Fullscreen unavailable');
        await enter.call(root);
      }
      sync();
    } catch {
      root.classList.add('is-fitted');sync();
      feedback.textContent = '已适配当前可见区域；微信顶部栏由微信控制。';
      feedback.hidden = false;
      if(welcomeFeedback){welcomeFeedback.textContent=feedback.textContent;welcomeFeedback.hidden=false;}
    } finally {
      busy = false;
      button.disabled = false;
      if(welcomeButton)welcomeButton.disabled=false;
    }
  }
  welcomeButton?.addEventListener('click',toggle);
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  window.PoolPreviewFullscreen = { toggle };
  button.textContent = '全屏 ⛶';
  button.setAttribute('aria-pressed', 'false');
})();

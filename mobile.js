(() => {
  const root = document.getElementById('mobile-pool-preview');
  const button = document.getElementById('fullBtn');
  const feedback = document.getElementById('fullscreenFeedback');
  let busy = false;
  function active() {
    return document.fullscreenElement === root || document.webkitFullscreenElement === root || root.classList.contains('is-fitted');
  }
  function sync() {
    const entered = active();
    root.classList.toggle('is-fullscreen', entered);
    button.textContent = entered ? '退出适屏' : '全屏 ⛶';
    button.setAttribute('aria-pressed', String(entered));
    button.setAttribute('aria-label', entered ? '退出全屏预览' : '全屏预览游戏');
    if (entered) { feedback.hidden = true; feedback.textContent = ''; }
    window.dispatchEvent(new Event('resize'));
  }
  async function toggle() {
    if (busy) return;
    busy = true;
    button.disabled = true;
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
    } finally {
      busy = false;
      button.disabled = false;
    }
  }
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  window.PoolPreviewFullscreen = { toggle };
  button.textContent = '全屏 ⛶';
  button.setAttribute('aria-pressed', 'false');
})();

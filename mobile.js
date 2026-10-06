(() => {
  const root = document.getElementById('mobile-pool-preview');
  const button = document.getElementById('landscapeBtn');
  // CSS rotation works in mobile browsers without requiring orientation-lock.
  let landscape = (root.clientWidth || root.getBoundingClientRect().width) <= 700;
  function syncLayout() {
    const viewport=window.visualViewport;
    const availableWidth=Math.max(1,Math.min(root.clientWidth||Infinity,viewport?.width||window.innerWidth||root.clientWidth||360));
    const availableHeight=Math.max(1,viewport?.height||window.innerHeight||availableWidth*1.85);
    const compact=availableWidth>availableHeight&&availableHeight<=500;
    if(availableWidth>700)landscape=false;
    const height=landscape?availableWidth:availableHeight;
    const width=landscape?availableHeight:availableWidth;
    root.style.setProperty('--landscape-height', `${height}px`);
    root.style.setProperty('--landscape-width', `${width}px`);
    root.style.setProperty('--landscape-table-width', `${Math.max(1, height - 138) * 1400 / 790}px`);
    root.style.setProperty('--visible-height', `${availableHeight}px`);
    root.classList.toggle('is-landscape', landscape);
    root.classList.toggle('is-compact',compact&&!landscape);
    root.style.setProperty('--preview-header-height', `${document.getElementById('previewTopbar').offsetHeight || 124}px`);
    button.textContent = landscape ? '竖屏 ↶' : '横屏 ↷';
    button.setAttribute('aria-pressed', String(landscape));
    button.setAttribute('aria-label', landscape ? '返回竖屏显示' : '切换横屏显示');
  }
  button.addEventListener('click', () => { landscape = !landscape; syncLayout(); });
  window.addEventListener('resize', syncLayout);
  window.visualViewport?.addEventListener('resize',syncLayout);
  window.visualViewport?.addEventListener('scroll',syncLayout);
  if (typeof ResizeObserver !== 'undefined') {
    let lastWidth = -1;
    new ResizeObserver(() => {
      const width = root.clientWidth;
      if (width !== lastWidth) { lastWidth = width; syncLayout(); }
    }).observe(root);
  }
  syncLayout();
})();

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

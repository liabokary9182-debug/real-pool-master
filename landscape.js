(() => {
  const root = document.getElementById('mobile-pool-preview');
  const surface = root?.querySelector('.mobile-game-surface');
  const gate = document.getElementById('landscapeGate');
  if (!root || !surface || !gate) return;
  const coarse = window.matchMedia?.('(pointer: coarse)');
  const orientation = window.screen?.orientation;
  const isPhone = () => !!coarse?.matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || navigator.maxTouchPoints > 0;
  function portrait() {
    // Use the physical device orientation, not the dimensions of the preview iframe.
    if (typeof window.orientation === 'number') return Math.abs(window.orientation) % 180 === 0;
    if (orientation?.type) return orientation.type.startsWith('portrait');
    if (window.screen?.width && window.screen?.height) return window.screen.width < window.screen.height;
    return window.innerWidth < window.innerHeight;
  }
  function sync() {
    const phone = isPhone();
    const blocked = phone && portrait();
    if (blocked && !root.classList.contains('orientation-blocked')) {
      for (const id of ['game', 'cueMeter', 'angleRuler']) document.getElementById(id)?.dispatchEvent(new Event('pointercancel'));
    }
    root.classList.toggle('orientation-blocked', blocked);
    root.classList.toggle('phone-landscape', phone && !blocked);
    root.classList.remove('is-landscape');
    root.classList.toggle('is-compact', phone && !blocked);
    gate.hidden = !blocked;
    surface.inert = blocked;
    surface.setAttribute('aria-hidden', String(blocked));
    const viewport = window.visualViewport;
    const width = Math.max(1, Math.min(root.clientWidth || Infinity, viewport?.width || window.innerWidth || 360));
    const height = Math.max(1, viewport?.height || window.innerHeight || 390);
    const physicalHeight = Math.min(window.screen?.width || height, window.screen?.height || height);
    root.style.setProperty('--visible-height', `${height}px`);
    root.style.setProperty('--phone-height', `${root.classList.contains('inline-preview') ? Math.min(height, physicalHeight) : height}px`);
    root.style.setProperty('--landscape-width', `${width}px`);
    root.style.setProperty('--landscape-height', `${height}px`);
    const chrome = (root.querySelector('.topbar')?.offsetHeight || 48) + (root.querySelector('.scorebar')?.offsetHeight || 28) + (root.querySelector('.status')?.offsetHeight || 22);
    root.style.setProperty('--landscape-table-width', `${Math.max(1, height - chrome) * 1400 / 790}px`);
    root.style.setProperty('--preview-header-height', `${document.getElementById('previewTopbar')?.offsetHeight || 48}px`);
  }
  function blockInput(event) {
    if (!root.classList.contains('orientation-blocked')) return;
    if (event.type === 'keydown' || root.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  for (const name of ['click', 'pointerdown', 'keydown']) window.addEventListener(name, blockInput, true);
  for (const name of ['resize', 'orientationchange']) window.addEventListener(name, sync);
  orientation?.addEventListener?.('change', sync);
  coarse?.addEventListener?.('change', sync);
  window.visualViewport?.addEventListener('resize', sync);
  if (typeof ResizeObserver !== 'undefined') {
    let previousWidth = -1;
    new ResizeObserver(() => { if (root.clientWidth !== previousWidth) { previousWidth = root.clientWidth; sync(); } }).observe(root);
  }
  sync();
})();

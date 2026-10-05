(() => {
  const preloader = document.querySelector("[data-event-preloader]");
  if (!preloader) return;

  const progress = preloader.querySelector("[data-preloader-progress]");
  const percent = preloader.querySelector("[data-preloader-percent]");
  const portal = preloader.querySelector("[data-preloader-portal]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reducedMotion ? 360 : 2200;
  const startedAt = performance.now();
  let finishing = false;

  const setProgress = (value) => {
    const bounded = Math.max(0, Math.min(100, Math.round(value)));
    if (progress) progress.style.width = `${bounded}%`;
    if (percent) percent.textContent = `${bounded}%`;
  };

  const finish = (immediate = false) => {
    if (finishing) return;
    finishing = true;
    setProgress(100);
    document.documentElement.classList.add("home-is-entering");
    portal?.classList.add("is-pulsing");
    preloader.classList.add("is-exiting");
    const removeDelay = immediate ? 320 : 760;
    window.setTimeout(() => {
      preloader.remove();
      document.documentElement.classList.remove("is-preloading");
    }, removeDelay);
  };

  const tick = (now) => {
    if (finishing) return;
    const elapsed = now - startedAt;
    const normalized = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - normalized, 2.4);
    setProgress(eased * 100);
    if (normalized >= 1) {
      finish();
      return;
    }
    window.requestAnimationFrame(tick);
  };

  portal?.addEventListener("click", () => finish(true));
  document.documentElement.classList.add("is-preloading");

  if (reducedMotion) {
    setProgress(100);
    preloader.remove();
    document.documentElement.classList.remove("is-preloading");
    return;
  }

  window.requestAnimationFrame(tick);
})();

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.querySelector(".event-details-panel");
  if (!panel) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touchDevice = window.matchMedia("(pointer: coarse)").matches;
  const image = panel.querySelector(".event-details-image");
  const revealItems = panel.querySelectorAll(".event-details-hero, .event-details-section");

  revealItems.forEach((item, index) => {
    item.classList.add("details-reveal");
    item.style.setProperty("--reveal-delay", `${Math.min(index * 70, 280)}ms`);
  });

  if (reducedMotion) {
    revealItems.forEach((item) => item.classList.add("is-revealed"));
    return;
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8%" });

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-revealed"));
  }

  if (!image || touchDevice) return;

  let frameId = 0;
  let pendingPointer = null;

  const resetImage = () => {
    image.style.setProperty("--image-rotate-x", "0deg");
    image.style.setProperty("--image-rotate-y", "0deg");
    image.style.setProperty("--image-mouse-x", "50%");
    image.style.setProperty("--image-mouse-y", "50%");
    image.classList.remove("is-pointer-active");
  };

  image.addEventListener("pointermove", (event) => {
    const bounds = image.getBoundingClientRect();
    const clampPercent = (value) => Math.max(0, Math.min(100, value));
    pendingPointer = {
      x: clampPercent(((event.clientX - bounds.left) / bounds.width) * 100),
      y: clampPercent(((event.clientY - bounds.top) / bounds.height) * 100)
    };

    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      if (pendingPointer) {
        const { x, y } = pendingPointer;
        image.style.setProperty("--image-mouse-x", `${x}%`);
        image.style.setProperty("--image-mouse-y", `${y}%`);
        image.style.setProperty("--image-rotate-y", `${(x - 50) * 0.04}deg`);
        image.style.setProperty("--image-rotate-x", `${(50 - y) * 0.04}deg`);
        image.classList.add("is-pointer-active");
      }
      frameId = 0;
    });
  }, { passive: true });

  image.addEventListener("pointerleave", () => {
    pendingPointer = null;
    resetImage();
  }, { passive: true });
});

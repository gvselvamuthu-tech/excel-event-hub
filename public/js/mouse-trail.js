(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touchDevice = window.matchMedia("(pointer: coarse)").matches;

  if (reducedMotion || touchDevice) return;

  const particleCount = 8;
  const trail = document.createElement("div");
  trail.className = "cursor-trail";
  trail.setAttribute("aria-hidden", "true");
  trail.innerHTML = `
    <span class="cursor-trail__glow"></span>
    <span class="cursor-trail__ring"></span>
    <span class="cursor-trail__streak"></span>
    ${Array.from({ length: particleCount }, () => '<span class="cursor-trail__particle"></span>').join("")}
  `;
  document.body.appendChild(trail);

  const glow = trail.querySelector(".cursor-trail__glow");
  const ring = trail.querySelector(".cursor-trail__ring");
  const streak = trail.querySelector(".cursor-trail__streak");
  const particles = [...trail.querySelectorAll(".cursor-trail__particle")];
  const points = particles.map(() => ({ x: -100, y: -100 }));
  const target = { x: -100, y: -100 };
  let previous = { x: target.x, y: target.y };
  let direction = { x: 1, y: 0 };
  let speed = 0;
  let lastMove = 0;
  let active = false;
  let hoveringInteractive = false;
  const activePops = new Set();

  const createClickPop = (event) => {
    if (event.pointerType === "touch") return;

    if (activePops.size >= 6) {
      const oldestPop = activePops.values().next().value;
      oldestPop.remove();
      activePops.delete(oldestPop);
    }

    const pop = document.createElement("span");
    pop.className = "cursor-pop";
    pop.dataset.createdAt = String(performance.now());
    pop.style.left = `${event.clientX}px`;
    pop.style.top = `${event.clientY}px`;
    pop.innerHTML = '<span class="cursor-pop__ring"></span><i></i><i></i><i></i>';
    trail.appendChild(pop);
    activePops.add(pop);
    let removed = false;
    const removePop = () => {
      if (removed) return;
      removed = true;
      activePops.delete(pop);
      pop.remove();
    };
    pop.addEventListener("animationend", removePop, { once: true });
    window.setTimeout(removePop, 700);
  };

  const handleMove = (event) => {
    const deltaX = event.clientX - previous.x;
    const deltaY = event.clientY - previous.y;
    target.x = event.clientX;
    target.y = event.clientY;
    speed = Math.min(1, Math.hypot(deltaX, deltaY) / 42);
    if (speed > 0.02) direction = { x: deltaX, y: deltaY };
    previous.x = target.x;
    previous.y = target.y;
    lastMove = performance.now();
    active = true;

    const interactive = event.target instanceof Element
      ? event.target.closest(".btn, .link-btn, .event-card, a, button")
      : null;
    hoveringInteractive = Boolean(interactive);
    trail.classList.toggle("is-over-interactive", hoveringInteractive);
  };

  window.addEventListener("pointermove", handleMove, { passive: true });
  window.addEventListener("pointerdown", createClickPop, { passive: true });

  const animate = (now) => {
    activePops.forEach((pop) => {
      if (now - Number(pop.dataset.createdAt || now) >= 700) {
        pop.remove();
        activePops.delete(pop);
      }
    });

    const idleAmount = Math.min(1, Math.max(0, (now - lastMove - 180) / 850));
    const visibility = active ? 1 - idleAmount : 0;
    const easedSpeed = speed * (hoveringInteractive ? 1.18 : 1);

    points.forEach((point, index) => {
      const delay = index === 0 ? 0.34 : 0.18;
      point.x += (target.x - point.x) * delay;
      point.y += (target.y - point.y) * delay;
      const scale = Math.max(0.48, 1 - index * 0.07) * (hoveringInteractive ? 1.08 : 1);
      particles[index].style.transform = `translate3d(${point.x}px, ${point.y}px, 0) scale(${scale})`;
      particles[index].style.opacity = String(visibility * (0.72 - index * 0.065));
    });

    glow.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) translate(-50%, -50%) scale(${1 + easedSpeed * 0.22})`;
    glow.style.opacity = String(visibility * (hoveringInteractive ? 0.72 : 0.5));
    ring.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) translate(-50%, -50%) scale(${hoveringInteractive ? 1.18 : 1})`;
    ring.style.opacity = String(visibility * (hoveringInteractive ? 0.96 : 0.76));
    streak.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) rotate(${Math.atan2(direction.y, direction.x) * (180 / Math.PI)}deg) scaleX(${0.55 + easedSpeed * 1.35})`;
    streak.style.opacity = String(visibility * easedSpeed * 0.5);

    speed *= 0.9;
    if (idleAmount >= 1) active = false;
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
})();

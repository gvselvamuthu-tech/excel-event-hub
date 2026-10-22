(() => {
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotionQuery.matches) return;

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
  let isTouching = false;
  let activeTouchId = null;
  const activePops = new Set();

  const createClickPop = (clientX, clientY) => {
    if (activePops.size >= 6) {
      const oldestPop = activePops.values().next().value;
      oldestPop.remove();
      activePops.delete(oldestPop);
    }

    const pop = document.createElement("span");
    pop.className = "cursor-pop";
    pop.dataset.createdAt = String(performance.now());
    pop.style.left = `${clientX}px`;
    pop.style.top = `${clientY}px`;
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

  const updatePosition = (clientX, clientY, targetEl, isTouchStart = false) => {
    if (isTouchStart || target.x < -50) {
      target.x = clientX;
      target.y = clientY;
      previous.x = clientX;
      previous.y = clientY;
      points.forEach((p) => {
        p.x = clientX;
        p.y = clientY;
      });
      speed = 0.2;
    } else {
      const deltaX = clientX - previous.x;
      const deltaY = clientY - previous.y;
      target.x = clientX;
      target.y = clientY;
      speed = Math.min(1, Math.hypot(deltaX, deltaY) / 42);
      if (speed > 0.02) direction = { x: deltaX, y: deltaY };
      previous.x = target.x;
      previous.y = target.y;
    }

    lastMove = performance.now();
    active = true;

    const interactive = targetEl instanceof Element
      ? targetEl.closest(".btn, .link-btn, .event-card, a, button, input, select, textarea, [role='button']")
      : null;
    hoveringInteractive = Boolean(interactive);
    trail.classList.toggle("is-over-interactive", hoveringInteractive);
  };

  // Pointer event handlers for desktop mouse (and non-touch pointer devices)
  const handlePointerMove = (event) => {
    if (event.pointerType === "touch") return; // Touch handled by dedicated touch listeners
    updatePosition(event.clientX, event.clientY, event.target);
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === "touch") return;
    createClickPop(event.clientX, event.clientY);
  };

  // Touch event handlers for mobile/touch-screen devices (passive: true guarantees no scroll blocking)
  const handleTouchStart = (event) => {
    if (!event.touches.length) return;
    const touch = event.touches[0];
    activeTouchId = touch.identifier;
    isTouching = true;
    updatePosition(touch.clientX, touch.clientY, touch.target, true);
    createClickPop(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (event) => {
    let touch = null;
    for (let i = 0; i < event.touches.length; i++) {
      if (event.touches[i].identifier === activeTouchId) {
        touch = event.touches[i];
        break;
      }
    }
    if (!touch && event.touches.length > 0) touch = event.touches[0];
    if (!touch) return;

    updatePosition(touch.clientX, touch.clientY, touch.target);
  };

  const handleTouchEnd = (event) => {
    if (activeTouchId !== null) {
      let stillActive = false;
      for (let i = 0; i < event.touches.length; i++) {
        if (event.touches[i].identifier === activeTouchId) {
          stillActive = true;
          break;
        }
      }
      if (!stillActive) {
        isTouching = false;
        activeTouchId = null;
        lastMove = performance.now() - 600; // Trigger rapid smooth fade-out on touch lift
      }
    } else if (event.touches.length === 0) {
      isTouching = false;
      lastMove = performance.now() - 600;
    }
  };

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  window.addEventListener("touchstart", handleTouchStart, { passive: true });
  window.addEventListener("touchmove", handleTouchMove, { passive: true });
  window.addEventListener("touchend", handleTouchEnd, { passive: true });
  window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

  const animate = (now) => {
    activePops.forEach((pop) => {
      if (now - Number(pop.dataset.createdAt || now) >= 700) {
        pop.remove();
        activePops.delete(pop);
      }
    });

    // Idle amount calculation - if finger is lifted, fade out immediately
    let idleAmount = 0;
    if (activeTouchId !== null && isTouching) {
      idleAmount = Math.min(1, Math.max(0, (now - lastMove - 120) / 400));
    } else {
      idleAmount = Math.min(1, Math.max(0, (now - lastMove - 180) / 850));
    }

    const visibility = active ? Math.max(0, 1 - idleAmount) : 0;
    const easedSpeed = speed * (hoveringInteractive ? 1.18 : 1);

    points.forEach((point, index) => {
      const delay = index === 0 ? 0.38 : 0.22;
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

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const mouseTrailCode = fs.readFileSync(path.join(__dirname, "..", "public", "js", "mouse-trail.js"), "utf8");

function createMockEnvironment(options = {}) {
  const listeners = {};
  const createdElements = [];

  class MockElement {
    constructor(tagName) {
      this.tagName = tagName;
      this.className = "";
      this.attributes = {};
      this.dataset = {};
      this.style = {};
      this.children = [];
      this.classList = {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this._classes.has(c)) this._classes.delete(c);
            else this._classes.add(c);
          } else if (force) {
            this._classes.add(c);
          } else {
            this._classes.delete(c);
          }
        },
        contains(c) { return this._classes.has(c); }
      };
    }
    setAttribute(name, val) { this.attributes[name] = val; }
    getAttribute(name) { return this.attributes[name]; }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    querySelector(selector) {
      if (selector === ".cursor-trail__glow") return this.glow || (this.glow = new MockElement("span"));
      if (selector === ".cursor-trail__ring") return this.ring || (this.ring = new MockElement("span"));
      if (selector === ".cursor-trail__streak") return this.streak || (this.streak = new MockElement("span"));
      if (selector === ".cursor-pop") return this.children.find(c => c.className === "cursor-pop");
      return null;
    }
    querySelectorAll(selector) {
      if (selector === ".cursor-trail__particle") {
        if (!this.particles) {
          this.particles = Array.from({ length: 8 }, () => new MockElement("span"));
        }
        return this.particles;
      }
      return [];
    }
    remove() {}
    addEventListener(name, handler) {}
    closest(selector) {
      if (this.isInteractive) return this;
      return null;
    }
  }

  const documentMock = {
    body: new MockElement("body"),
    createElement(tagName) {
      const el = new MockElement(tagName);
      createdElements.push(el);
      return el;
    }
  };

  const windowMock = {
    matchMedia(query) {
      return {
        matches: options.prefersReducedMotion && query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null
      };
    },
    addEventListener(event, handler, opts) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push({ handler, opts });
    },
    dispatchEvent(event) {
      const list = listeners[event.type] || [];
      list.forEach(item => item.handler(event));
    },
    setTimeout(fn, delay) { return setTimeout(fn, delay); },
    clearTimeout(id) { clearTimeout(id); },
    requestAnimationFrame(fn) {
      if (options.runAnimationFrame) fn(100);
      return 1;
    }
  };

  const sandbox = {
    window: windowMock,
    document: documentMock,
    Element: MockElement,
    performance: { now: () => Date.now() },
    Math,
    Array,
    String,
    Number,
    Boolean,
    Set,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: windowMock.requestAnimationFrame
  };

  vm.createContext(sandbox);
  return { sandbox, windowMock, documentMock, listeners, createdElements, MockElement };
}

test("Desktop pointer events properly register and update cursor trail", () => {
  const env = createMockEnvironment({ prefersReducedMotion: false });
  vm.runInContext(mouseTrailCode, env.sandbox);

  const trail = env.documentMock.body.children.find(c => c.className === "cursor-trail");
  assert.ok(trail, "Trail element should be appended to document.body");
  assert.equal(trail.getAttribute("aria-hidden"), "true");

  // Verify pointer event listeners registered with passive: true
  assert.ok(env.listeners["pointermove"], "pointermove listener registered");
  assert.ok(env.listeners["pointerdown"], "pointerdown listener registered");
  assert.equal(env.listeners["pointermove"][0].opts.passive, true);

  // Trigger pointer move on desktop
  const btn = new env.MockElement("button");
  btn.isInteractive = true;
  env.windowMock.dispatchEvent({
    type: "pointermove",
    clientX: 120,
    clientY: 180,
    pointerType: "mouse",
    target: btn
  });

  assert.ok(trail.classList.contains("is-over-interactive"), "Interactive element triggers is-over-interactive class");

  // Trigger pointerdown (click)
  env.windowMock.dispatchEvent({
    type: "pointerdown",
    clientX: 120,
    clientY: 180,
    pointerType: "mouse",
    target: btn
  });

  const pop = trail.children.find(c => c.className === "cursor-pop");
  assert.ok(pop, "Click pop created on pointerdown");
  assert.equal(pop.style.left, "120px");
  assert.equal(pop.style.top, "180px");
});

test("Mobile touch events smoothly track finger and do not block gestures", () => {
  const env = createMockEnvironment({ prefersReducedMotion: false });
  vm.runInContext(mouseTrailCode, env.sandbox);

  const trail = env.documentMock.body.children.find(c => c.className === "cursor-trail");
  assert.ok(trail, "Trail element initialized on touch-capable device");

  // Verify all touch listeners are registered with passive: true so scrolling is NEVER blocked
  ["touchstart", "touchmove", "touchend", "touchcancel"].forEach(event => {
    assert.ok(env.listeners[event], `${event} listener registered`);
    assert.equal(env.listeners[event][0].opts.passive, true, `${event} must be passive to allow native smooth scrolling`);
  });

  const interactiveCard = new env.MockElement("div");
  interactiveCard.isInteractive = true;

  // Touchstart
  env.windowMock.dispatchEvent({
    type: "touchstart",
    touches: [{ identifier: 1, clientX: 200, clientY: 300, target: interactiveCard }]
  });

  assert.ok(trail.classList.contains("is-over-interactive"), "Touch over button/card triggers interactive state");
  const touchPop = trail.children.find(c => c.className === "cursor-pop");
  assert.ok(touchPop, "Touch generates subtle interactive pop");

  // Touchmove (finger moves across screen)
  const plainDiv = new env.MockElement("div");
  plainDiv.isInteractive = false;
  env.windowMock.dispatchEvent({
    type: "touchmove",
    touches: [{ identifier: 1, clientX: 220, clientY: 350, target: plainDiv }]
  });

  assert.ok(!trail.classList.contains("is-over-interactive"), "Moving off interactive elements clears hover class");

  // Touchend (user lifts finger)
  env.windowMock.dispatchEvent({
    type: "touchend",
    touches: []
  });

  // Verify pointer events with pointerType: 'touch' are ignored so they don't fight with touch handlers
  const initialPopCount = trail.children.filter(c => c.className === "cursor-pop").length;
  env.windowMock.dispatchEvent({
    type: "pointerdown",
    pointerType: "touch",
    clientX: 99,
    clientY: 99
  });
  const afterPopCount = trail.children.filter(c => c.className === "cursor-pop").length;
  assert.equal(initialPopCount, afterPopCount, "Pointerdown with pointerType touch should be ignored to avoid duplicates");
});

test("prefers-reduced-motion respects accessibility setting and creates no trail", () => {
  const env = createMockEnvironment({ prefersReducedMotion: true });
  vm.runInContext(mouseTrailCode, env.sandbox);

  const trail = env.documentMock.body.children.find(c => c.className === "cursor-trail");
  assert.equal(trail, undefined, "No trail element should be appended when prefers-reduced-motion is true");
  assert.equal(Object.keys(env.listeners).length, 0, "No listeners should be attached when prefers-reduced-motion is true");
});

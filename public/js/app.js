document.addEventListener("DOMContentLoaded", async () => {
  const college = window.COLLEGE_CONFIG;
  await window.fetchLatestEventData?.().catch(() => window.getEventData?.() || window.EVENT_DATA || { technical: [], nonTechnical: [] });
  const events = window.getEventData ? window.getEventData() : (window.EVENT_DATA || { technical: [], nonTechnical: [] });

  const setText = (selector, text) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  };

  setText("[data-college-name]", college.name);
  setText("[data-college-location]", `${college.city}, ${college.district}, ${college.state}, ${college.country}`);

  const whatsappGroupLink = document.querySelector("[data-whatsapp-group-link]");
  if (whatsappGroupLink && college.whatsappGroupUrl) {
    whatsappGroupLink.href = college.whatsappGroupUrl;
  }

  const whatsappFooterLink = document.querySelector("[data-whatsapp-footer-link]");
  if (whatsappFooterLink && college.whatsappGroupUrl) {
    whatsappFooterLink.href = college.whatsappGroupUrl;
  }

  const heroImage = document.querySelector("[data-hero-image]");
  if (heroImage && college.heroImagePath) {
    heroImage.style.backgroundImage = `linear-gradient(135deg, rgba(9, 17, 32, 0.68), rgba(11, 31, 58, 0.72)), url('${college.heroImagePath}')`;
    heroImage.setAttribute("aria-label", "Excel Engineering College campus building");
  }

  const renderHomeCategories = () => {
    const target = document.querySelector("[data-home-categories]");
    if (!target) return;

    const categories = [...events.technical, ...events.nonTechnical]
      .map((item) => item.category)
      .filter(Boolean)
      .filter((category, index, list) => list.indexOf(category) === index);

    target.innerHTML = categories
      .map((category) => `<a class="home-category" href="events.html?category=${encodeURIComponent(category.toLowerCase().replace(/[^a-z]/g, ""))}">${category}<span aria-hidden="true">↗</span></a>`)
      .join("");
  };

  const renderHomeStats = () => {
    const statsWrap = document.querySelector("[data-home-stats]");
    if (!statsWrap) return;

    const stats = college.stats || [
      { value: "10+", label: "Events" },
      { value: "500+", label: "Participants" },
      { value: "₹50K+", label: "Prize Pool" },
      { value: "1", label: "Campus" }
    ];

    statsWrap.innerHTML = stats
      .map(
        (item) => `
          <div class="stat-box">
            <strong>${item.value}</strong>
            <span>${item.label}</span>
          </div>
        `
      )
      .join("");
  };

  const updateFooterContact = () => {
    const emailNode = document.querySelector("[data-college-email]");
    const phoneNode = document.querySelector("[data-college-phone]");

    if (emailNode) {
      emailNode.textContent = college.contact.email || "Official contact email to be verified";
    }

    if (phoneNode) {
      phoneNode.textContent = college.contact.phone || "Official contact phone to be verified";
    }
  };

  renderHomeCategories();
  renderHomeStats();
  updateFooterContact();

  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");

  const handleScroll = () => {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 30);
  };

  handleScroll();
  window.addEventListener("scroll", handleScroll);

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }
});

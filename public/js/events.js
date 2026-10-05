document.addEventListener("DOMContentLoaded", async () => {
  const fallbackEventList = window.EVENT_DATA || { technical: [], nonTechnical: [] };
  const liveEventList = await window.fetchLatestEventData?.().catch(() => fallbackEventList) || fallbackEventList;
  const eventList = liveEventList && (Array.isArray(liveEventList.technical) || Array.isArray(liveEventList.nonTechnical)) ? liveEventList : fallbackEventList;

  const allEvents = [...(eventList.technical || []), ...(eventList.nonTechnical || [])];
  const queryString = new URLSearchParams(window.location.search);
  const eventId = queryString.get("id");
  const fallbackImage = window.EVENT_IMAGE_FALLBACK || "assets/images/event-placeholder.svg";
  const resolveEventImage = window.resolveEventImage;

  const normalizeCategory = (category) => String(category || "").toLowerCase().replace(/[^a-z]/g, "");
  const requestedCategory = normalizeCategory(queryString.get("category") || window.location.hash.slice(1));
  const availableCategories = new Set(allEvents.map((event) => normalizeCategory(event.category)));
  const initialCategory = availableCategories.has(requestedCategory) ? requestedCategory : "all";
  const renderEventCards = (items) => {
    const target = document.getElementById("events-grid");
    if (!target) return;

    if (!items.length) {
      target.innerHTML = `
        <div class="empty-state">
          <h3>No events found</h3>
          <p>Try another keyword or switch the category filter.</p>
        </div>
      `;
      return;
    }

    target.innerHTML = items
      .map((item) => {
        const eventStatus = String(item.status || "Open").trim().toLowerCase();
        const status = eventStatus.toUpperCase();
        const registrationClosed = eventStatus === "closed";
        const image = resolveEventImage(item.image, item.id);
        const shortDescription = item.shortDescription || item.description || "Sample event details to be announced.";
        const registrationAction = registrationClosed
          ? '<span class="btn btn--secondary" aria-disabled="true">Registration Closed</span>'
          : `<a href="event-details.html?id=${item.id}" class="btn btn--primary">Register Now</a>`;

        return `
          <article class="event-card" aria-label="${item.title}">
            <div class="event-card__media">
              <img src="${image}" alt="${item.title}" class="event-card__image" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'" />
            </div>
            <div class="event-card__body">
              <div class="event-card__meta">
                <span class="pill">${item.category}</span>
                <span class="status-badge status-badge--${eventStatus}">${status}</span>
              </div>
              <h3>${item.title}</h3>
              <p>${shortDescription}</p>
              <div class="event-card__info">
                <span>📅 ${item.date}</span>
                <span>⏰ ${item.time}</span>
                <span>📍 ${item.venue}</span>
                <span>💰 ${item.registrationFee}</span>
              </div>
              <div class="event-card__footer">
                <span>${item.teamSize || "Team Event"}</span>
                <div class="event-card__actions">
                  <a href="event-details.html?id=${item.id}" class="link-btn">VIEW DETAILS</a>
                  ${registrationAction}
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  };

  const setupCardInteraction = (target) => {
    if (!target) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touchDevice = window.matchMedia("(pointer: coarse)").matches;
    if (reducedMotion || touchDevice) return;

    let activeCard = null;
    let pendingPointer = null;
    let frameId = 0;

    const resetCard = (card) => {
      if (!card) return;
      card.style.setProperty("--mouse-x", "50%");
      card.style.setProperty("--mouse-y", "50%");
      card.style.setProperty("--card-rotate-x", "0deg");
      card.style.setProperty("--card-rotate-y", "0deg");
      card.classList.remove("is-pointer-active");
    };

    target.addEventListener("pointermove", (event) => {
      const card = event.target instanceof Element ? event.target.closest(".event-card") : null;
      if (!card || !target.contains(card)) {
        resetCard(activeCard);
        activeCard = null;
        pendingPointer = null;
        return;
      }

      if (activeCard && activeCard !== card) resetCard(activeCard);
      activeCard = card;
      const bounds = card.getBoundingClientRect();
      const clampPercent = (value) => Math.max(0, Math.min(100, value));
      pendingPointer = {
        card,
        x: clampPercent(((event.clientX - bounds.left) / bounds.width) * 100),
        y: clampPercent(((event.clientY - bounds.top) / bounds.height) * 100)
      };

      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        if (pendingPointer) {
          const { card: pendingCard, x, y } = pendingPointer;
          pendingCard.style.setProperty("--mouse-x", `${x}%`);
          pendingCard.style.setProperty("--mouse-y", `${y}%`);
          pendingCard.style.setProperty("--card-rotate-y", `${(x - 50) * 0.05}deg`);
          pendingCard.style.setProperty("--card-rotate-x", `${(50 - y) * 0.05}deg`);
          pendingCard.classList.add("is-pointer-active");
        }
        frameId = 0;
      });
    }, { passive: true });

    target.addEventListener("pointerleave", () => {
      pendingPointer = null;
      resetCard(activeCard);
      activeCard = null;
    }, { passive: true });
  };

  setupCardInteraction(document.getElementById("events-grid"));

  const updateFilterButtons = (buttonGroupSelector, activeValue, valueKey) => {
    document.querySelectorAll(buttonGroupSelector).forEach((button) => {
      const isActive = button.dataset[valueKey] === activeValue;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  };

  const eventState = {
    category: initialCategory,
    status: "all",
    search: ""
  };

  const applyEventFilters = () => {
    const query = eventState.search.trim().toLowerCase();

    const filteredEvents = allEvents.filter((event) => {
      const matchesCategory = eventState.category === "all" || normalizeCategory(event.category) === eventState.category;
      const matchesStatus = eventState.status === "all" || String(event.status || "Open").trim().toLowerCase() === eventState.status;
      const searchText = `${event.title} ${event.description} ${event.category} ${event.venue} ${event.fullDescription || ""}`.toLowerCase();
      const matchesSearch = query.length === 0 || searchText.includes(query);

      return matchesCategory && matchesStatus && matchesSearch;
    });

    renderEventCards(filteredEvents);
  };

  document.querySelectorAll("[data-category-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      eventState.category = button.dataset.categoryFilter;
      updateFilterButtons("[data-category-filter]", eventState.category, "categoryFilter");
      applyEventFilters();
    });
  });

  document.querySelectorAll("[data-status-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      eventState.status = button.dataset.statusFilter;
      updateFilterButtons("[data-status-filter]", eventState.status, "statusFilter");
      applyEventFilters();
    });
  });

  const searchInput = document.getElementById("event-search");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      eventState.search = event.target.value;
      applyEventFilters();
    });
  }

  if (!eventId) {
    updateFilterButtons("[data-category-filter]", eventState.category, "categoryFilter");
    applyEventFilters();
    return;
  }

  const currentEvent = allEvents.find((event) => event.id === eventId);
  const container = document.getElementById("event-details-card");
  const title = document.getElementById("event-title");

  if (!currentEvent || !container || !title) return;

  title.textContent = currentEvent.title;

  const rules = Array.isArray(currentEvent.rules) && currentEvent.rules.length ? currentEvent.rules : ["Rules will be announced soon."];
  const prizes = Array.isArray(currentEvent.prizes) && currentEvent.prizes.length ? currentEvent.prizes : [currentEvent.prize || "Prize details to be announced."];
  const eventStatus = String(currentEvent.status || "Open").trim().toLowerCase();
  const status = eventStatus.toUpperCase();
  const registrationClosed = eventStatus === "closed";
  const eventImage = resolveEventImage(currentEvent.image, currentEvent.id);
  const registrationAction = registrationClosed
    ? '<span class="btn btn--secondary" aria-disabled="true">Registration Closed</span>'
    : `<a href="register.html?event=${currentEvent.id}" class="btn btn--primary">Register Now</a>`;

  container.innerHTML = `
    <article class="event-details-panel">
      <div class="event-details-hero">
        <img src="${eventImage}" alt="${currentEvent.title}" class="event-details-image" />
        <div class="event-details-summary">
          <div class="event-details-meta">
            <span class="pill">${currentEvent.category}</span>
            <span class="status-badge status-badge--${eventStatus}">${status}</span>
          </div>
          <h2>${currentEvent.title}</h2>
          <p>${currentEvent.shortDescription || currentEvent.description}</p>
          <div class="event-details-actions">
            ${registrationAction}
          </div>
        </div>
      </div>

      <div class="event-details-section">
        <h3>ABOUT THE EVENT</h3>
        <p>${currentEvent.fullDescription || currentEvent.description}</p>
      </div>

      <div class="event-details-grid">
        <div class="event-details-section">
          <h3>EVENT INFORMATION</h3>
          <ul class="info-list">
            <li><strong>📅 Date:</strong> ${currentEvent.date}</li>
            <li><strong>⏰ Time:</strong> ${currentEvent.time}</li>
            <li><strong>📍 Venue:</strong> ${currentEvent.venue}</li>
            <li><strong>💰 Registration Fee:</strong> ${currentEvent.registrationFee}</li>
            <li><strong>👥 Team Size:</strong> ${currentEvent.teamSize}</li>
            <li><strong>👤 Maximum Participants:</strong> ${currentEvent.maxParticipants}</li>
          </ul>
        </div>

        <div class="event-details-section">
          <h3>PRIZES</h3>
          <ul class="info-list info-list--compact">
            ${prizes.map((prize) => `<li>${prize}</li>`).join("")}
          </ul>
        </div>
      </div>

      <div class="event-details-section">
        <h3>RULES & GUIDELINES</h3>
        <ol class="rules-list">
          ${rules.map((rule) => `<li>${rule}</li>`).join("")}
        </ol>
      </div>

      <div class="event-details-section event-details-status">
        <h3>STATUS</h3>
        <span class="status-badge status-badge--${eventStatus}">${status}</span>
      </div>

    </article>
  `;
});

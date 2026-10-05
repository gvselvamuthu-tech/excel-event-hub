document.addEventListener("DOMContentLoaded", () => {
  const config = window.collegeData;

  if (!config) {
    return;
  }

  const heroStats = document.getElementById("hero-stats");
  if (heroStats) {
    heroStats.innerHTML = config.stats
      .slice(0, 4)
      .map(
        (item) => `
          <div class="stat-item">
            <strong>${item.value}</strong>
            <span>${item.label}</span>
          </div>
        `
      )
      .join("");
  }

  const stripGrid = document.getElementById("college-stats");
  if (stripGrid) {
    stripGrid.innerHTML = config.stats
      .map(
        (item) => `
          <div class="info-item">
            <strong>${item.value}</strong>
            <span>${item.label}</span>
          </div>
        `
      )
      .join("");
  }

  const renderEvents = (containerId, events) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = events
      .map(
        (event) => `
          <article class="event-card">
            <div class="event-visual">${event.badge}</div>
            <div class="event-content">
              <h3>${event.name}</h3>
              <p>${event.description}</p>
              <div class="event-meta">
                <span>${event.badge}</span>
                <span class="event-detail">View Details</span>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  };

  renderEvents("technical-events", config.technicalEvents);
  renderEvents("non-technical-events", config.nonTechnicalEvents);

  const heroSection = document.querySelector(".hero-section");
  if (heroSection && config.college.heroImage) {
    heroSection.style.backgroundImage = `linear-gradient(135deg, rgba(15, 23, 42, 0.78), rgba(15, 23, 42, 0.64)), url('${config.college.heroImage}')`;
  }
});

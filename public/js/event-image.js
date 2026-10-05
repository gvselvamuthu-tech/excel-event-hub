(() => {
  const fallbackImage = "../assets/images/event-placeholder.svg";
  const eventImageSources = {
    "coding-challenge": "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "debugging-challenge": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "paper-presentation": "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "project-expo": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "web-designing": "https://images.unsplash.com/photo-1547658719-da2b51169166?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "technical-quiz": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "general-quiz": "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "photography": "https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "treasure-hunt": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "dance": "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "music": "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral",
    "short-film": "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=82&utm_source=excel-event-hub&utm_medium=referral"
  };

  const toEventList = (value) => {
    const data = value && typeof value === "object" ? value : { technical: [], nonTechnical: [] };
    return {
      technical: Array.isArray(data.technical) ? data.technical : [],
      nonTechnical: Array.isArray(data.nonTechnical) ? data.nonTechnical : []
    };
  };

  const normalizeEventData = (value) => {
    const base = toEventList(value);
    const events = [...base.technical, ...base.nonTechnical];
    return {
      technical: base.technical
        .map((event) => ({ ...event, category: String(event.category || "Technical") }))
        .filter((event) => event && event.id),
      nonTechnical: base.nonTechnical
        .map((event) => ({ ...event, category: String(event.category || "Non-Technical") }))
        .filter((event) => event && event.id)
    };
  };

  const getLatestEventData = () => {
    const source = window.EVENT_DATA || { technical: [], nonTechnical: [] };
    return normalizeEventData(source);
  };

  window.EVENT_IMAGE_FALLBACK = fallbackImage;
  window.getEventData = () => normalizeEventData(window.EVENT_DATA || { technical: [], nonTechnical: [] });
  window.getAllEvents = () => {
    const data = window.getEventData();
    return [...(data.technical || []), ...(data.nonTechnical || [])];
  };
  window.getEventById = (eventId) => {
    const normalizedId = String(eventId || "").trim();
    if (!normalizedId) return null;
    return window.getAllEvents().find((event) => String(event.id) === normalizedId) || null;
  };
  window.resolveEventAsset = (assetPath) => {
    const resolvedPath = String(assetPath || "").trim();
    if (!resolvedPath) return "";
    if (/^(https?:|data:|blob:|\/)/i.test(resolvedPath) || resolvedPath.startsWith("../") || resolvedPath.startsWith("./")) {
      return resolvedPath;
    }
    return window.location.pathname.includes("/pages/") ? `../${resolvedPath}` : resolvedPath;
  };
  window.isEventRegistrationOpen = (event) => String(event?.status || "Open").trim().toLowerCase() !== "closed";
  window.isEventQrScannerEnabled = (event) => {
    if (event?.scannerEnabled !== undefined && event.scannerEnabled !== null && String(event.scannerEnabled).trim() !== "") {
      return ["true", "1", "yes"].includes(String(event.scannerEnabled).trim().toLowerCase());
    }
    return /\bseminar\b/i.test(`${event?.id || ""} ${event?.title || ""}`);
  };
  window.clearEventDataOverride = () => {
    try { localStorage.removeItem("excel_admin_events"); } catch (error) {}
  };
  window.fetchLatestEventData = async () => {
    try {
      const response = await fetch("/api/events", { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Failed to fetch live event data");
      const payload = await response.json();
      if (payload && (Array.isArray(payload.technical) || Array.isArray(payload.nonTechnical))) {
        window.EVENT_DATA = normalizeEventData(payload);
        window.clearEventDataOverride();
        return window.EVENT_DATA;
      }
    } catch (error) {
      console.warn("Using cached event data because live fetch failed.", error);
    }
    return window.getEventData();
  };

  window.resolveEventImage = (imagePath, eventId) => {
    const resolvedPath = imagePath || "";
    const isPlaceholder = !resolvedPath || resolvedPath.endsWith("event-placeholder.svg");
    if (isPlaceholder && eventImageSources[eventId]) return eventImageSources[eventId];
    if (!resolvedPath) return fallbackImage;
    if (resolvedPath.startsWith("http") || resolvedPath.startsWith("../") || resolvedPath.startsWith("./")) return resolvedPath;
    return window.location.pathname.includes("/pages/") ? `../${resolvedPath}` : resolvedPath;
  };
})();

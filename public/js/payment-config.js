(function (root, factory) {
  const paymentConfig = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = paymentConfig;
  }
  if (root) {
    Object.assign(root, paymentConfig);
  }
})(typeof window !== "undefined" ? window : null, function () {
  const PAYMENT_CONFIG = {
    upiId: "suba.arni@okaxis",
    payeeName: "Excel Event Hub"
  };

  const normalizeAmount = (amount) => {
    if (!Number.isFinite(amount) || amount < 0) return null;
    const cents = Math.round(amount * 100);
    if (!Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 1e-9) return null;
    return cents / 100;
  };

  const parseRegistrationFee = (value) => {
    if (value === undefined || value === null) return 0;
    if (String(value).trim() === "") return null;
    if (typeof value === "number") return normalizeAmount(value);

    const match = /^(?:₹\s*)?((?:\d{1,3}(?:,\d{2})*,\d{3})|(?:\d+(?:,\d{3})*)|\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
    if (!match) return null;
    const amount = Number(`${match[1].replace(/,/g, "")}${match[2] ? `.${match[2]}` : ""}`);
    return normalizeAmount(amount);
  };

  const formatRegistrationFee = (value) => {
    const amount = parseRegistrationFee(value && typeof value === "object" ? value.registrationFee : value);
    if (amount === null) return "Registration fee unavailable";
    const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    return `₹${formatted}`;
  };

  const buildEventUpiPaymentLink = (event) => {
    const details = new URLSearchParams({
      pa: PAYMENT_CONFIG.upiId,
      pn: PAYMENT_CONFIG.payeeName,
      cu: "INR",
      tn: `Excel Event Hub - ${event?.title || ""} (${event?.id || ""})`
    });
    const amount = parseRegistrationFee(event?.registrationFee);
    if (amount === null) throw new Error("A valid event registration fee is required to create a UPI payment link.");
    if (amount > 0) {
      const formattedAmount = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
      details.set("am", formattedAmount);
    }
    return `upi://pay?${details.toString()}`;
  };

  const getEventPaymentQrUrl = (event) => {
    const eventId = String(event?.id || "").trim();
    return eventId ? `/api/events/${encodeURIComponent(eventId)}/payment-qr` : "";
  };

  return {
    PAYMENT_CONFIG,
    parseRegistrationFee,
    formatRegistrationFee,
    buildEventUpiPaymentLink,
    getEventPaymentQrUrl
  };
});

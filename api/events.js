const handler = require("./index");

module.exports = (req, res) => {
  const url = req.url || "";
  const match = /\/payment-qr\b|\bpayment-qr/.test(url);
  if (match) {
    const eventIdMatch = /\/events\/([^/]+)\/payment-qr/.exec(url) || /([^/]+)\/payment-qr/.exec(url);
    const eventId = eventIdMatch ? eventIdMatch[1] : "";
    req.url = `/api/events/${eventId}/payment-qr`;
  } else {
    req.url = "/api/events";
  }
  return handler(req, res);
};

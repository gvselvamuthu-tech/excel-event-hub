const handler = require("./index");

module.exports = async function (req, res) {
  // If invoked via dynamic route /api/events/[eventId]/payment-qr or rewritten /api/events/:eventId/payment-qr
  return handler(req, res);
};

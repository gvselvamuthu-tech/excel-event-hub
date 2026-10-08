const handler = require("./index");

module.exports = (req, res) => {
  const url = req.url || "";
  if (url.includes("/download")) {
    req.url = "/api/payments/download";
  } else if (url.includes("/clear")) {
    req.url = "/api/payments/clear";
  } else {
    req.url = "/api/payments";
  }
  return handler(req, res);
};

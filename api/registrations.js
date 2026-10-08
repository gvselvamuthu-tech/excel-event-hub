const handler = require("./index");

module.exports = (req, res) => {
  const url = req.url || "";
  if (url.includes("/download")) {
    req.url = "/api/registrations/download";
  } else {
    req.url = "/api/registrations";
  }
  return handler(req, res);
};

const handler = require('./index');

module.exports = (req, res) => {
  req.url = '/api/admin/verify';
  return handler(req, res);
};

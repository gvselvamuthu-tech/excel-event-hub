const { timingSafeEqual } = require("node:crypto");

const DEFAULT_ADMIN_CREDENTIALS = {
  username: "admin",
  email: "admin@excel.edu",
  password: "Admin@123"
};

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyAdminCredentials(identity, password, environment = process.env) {
  const username = environment.ADMIN_USERNAME || DEFAULT_ADMIN_CREDENTIALS.username;
  const email = environment.ADMIN_EMAIL || DEFAULT_ADMIN_CREDENTIALS.email;
  const configuredPassword = environment.ADMIN_PASSWORD || DEFAULT_ADMIN_CREDENTIALS.password;
  const suppliedIdentity = String(identity || "").trim();
  const identityMatches = secureEqual(suppliedIdentity.toLowerCase(), username.toLowerCase())
    || secureEqual(suppliedIdentity.toLowerCase(), email.toLowerCase());
  const passwordMatches = secureEqual(password || "", configuredPassword);
  return identityMatches && passwordMatches;
}

module.exports = { verifyAdminCredentials };

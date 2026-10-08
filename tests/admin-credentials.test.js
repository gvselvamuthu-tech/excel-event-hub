const assert = require("node:assert/strict");
const test = require("node:test");
const { verifyAdminCredentials } = require("../lib/admin-credentials");

test("admin credentials are checked using the existing defaults", () => {
  assert.equal(verifyAdminCredentials("admin", "Admin@123"), true);
  assert.equal(verifyAdminCredentials("ADMIN@EXCEL.EDU", "Admin@123"), true);
  assert.equal(verifyAdminCredentials("admin", "wrong"), false);
  assert.equal(verifyAdminCredentials("unknown", "Admin@123"), false);
});

test("configured environment credentials replace the demo defaults", () => {
  const environment = {
    ADMIN_USERNAME: "staff",
    ADMIN_EMAIL: "staff@example.edu",
    ADMIN_PASSWORD: "a-strong-password"
  };

  assert.equal(verifyAdminCredentials("staff", "a-strong-password", environment), true);
  assert.equal(verifyAdminCredentials("admin", "Admin@123", environment), false);
});

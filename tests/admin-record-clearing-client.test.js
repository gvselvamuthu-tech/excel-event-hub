const assert = require("node:assert/strict");
const test = require("node:test");
const { verifyAndClearAdminRecords } = require("../public/js/admin-record-clearing");

test("wrong credentials stop before the confirmation or payment clear request", async () => {
  const requests = [];
  let confirmationRequested = false;

  await assert.rejects(
    verifyAndClearAdminRecords(
      "payments",
      { username: "admin", password: "wrong" },
      () => {
        confirmationRequested = true;
        return true;
      },
      async (path) => {
        requests.push(path);
        throw new Error("Invalid admin username or password.");
      }
    ),
    /Invalid admin/
  );

  assert.deepEqual(requests, ["/admin/verify"]);
  assert.equal(confirmationRequested, false);
});

test("canceling the second confirmation sends no clear request", async () => {
  const requests = [];
  const result = await verifyAndClearAdminRecords(
    "payments",
    { username: "admin", password: "Admin@123" },
    (message) => {
      assert.equal(message, "Are you sure you want to delete ALL payment records? This action cannot be undone.");
      return false;
    },
    async (path, payload) => {
      requests.push({ path, payload });
      return { verified: true };
    }
  );

  assert.equal(result.cancelled, true);
  assert.deepEqual(requests.map((request) => request.path), ["/admin/verify"]);
});

test("confirming payment deletion uses its protected POST endpoint and confirmation data", async () => {
  const requests = [];
  const result = await verifyAndClearAdminRecords(
    "payments",
    { username: "admin", password: "Admin@123" },
    () => true,
    async (path, payload) => {
      requests.push({ path, payload });
      return { success: true };
    }
  );

  assert.deepEqual(requests.map((request) => request.path), [
    "/admin/verify",
    "/payments/clear"
  ]);
  assert.equal(requests[1].payload.confirmed, true);
  assert.equal(result.success, true);
});

test("confirming all-registration-payments deletion uses /records/clear endpoint", async () => {
  const requests = [];
  const result = await verifyAndClearAdminRecords(
    "all-registration-payments",
    { username: "admin", password: "Admin@123" },
    (msg) => {
      assert.match(msg, /ALL registration and payment records/);
      return true;
    },
    async (path, payload) => {
      requests.push({ path, payload });
      return { success: true, message: "All registration and payment records cleared successfully." };
    }
  );

  assert.deepEqual(requests.map((request) => request.path), [
    "/admin/verify",
    "/records/clear"
  ]);
  assert.equal(requests[1].payload.confirmed, true);
  assert.equal(requests[1].payload.dataset, "all-registration-payments");
  assert.equal(result.success, true);
});

test("canceling all-registration-payments deletion leaves records intact without clear call", async () => {
  const requests = [];
  const result = await verifyAndClearAdminRecords(
    "all-registration-payments",
    { username: "admin", password: "Admin@123" },
    () => false,
    async (path, payload) => {
      requests.push({ path, payload });
      return { verified: true };
    }
  );

  assert.equal(result.cancelled, true);
  assert.deepEqual(requests.map((r) => r.path), ["/admin/verify"]);
});

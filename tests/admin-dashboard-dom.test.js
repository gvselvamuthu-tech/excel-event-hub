const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("admin-dashboard.html contains all required elements for dashboard and event CRUD operations", () => {
  const htmlPath = path.join(__dirname, "..", "public", "admin-dashboard.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const requiredIds = [
    "overview-stats",
    "stat-events",
    "stat-registrations",
    "stat-payments",
    "stat-today",
    "events-table",
    "add-event-btn",
    "registrations-table",
    "reg-search",
    "reg-filter-event",
    "reg-filter-payment",
    "refresh-workbook-data",
    "downloadRegistrationsBtn",
    "downloadPaymentsBtn",
    "clear-records-btn",
    "event-modal",
    "event-form",
    "modal-title",
    "cancel-modal",
    "admin-toast",
    "clear-records-dialog",
    "logout-confirm-dialog"
  ];

  requiredIds.forEach((id) => {
    assert.ok(
      html.includes(`id="${id}"`) || html.includes(`id='${id}'`),
      `Expected admin-dashboard.html to contain element with id="${id}"`
    );
  });
});

test("admin-dashboard.html event-modal contains all required form fields", () => {
  const htmlPath = path.join(__dirname, "..", "public", "admin-dashboard.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const requiredFields = [
    'name="title"',
    'name="id"',
    'name="category"',
    'name="status"',
    'name="date"',
    'name="time"',
    'name="venue"',
    'name="registrationFee"',
    'name="registrationDeadline"',
    'name="image"',
    'name="assignedQrId"',
    'name="scannerEnabled"',
    'name="teamSize"',
    'name="maxParticipants"',
    'name="shortDescription"',
    'name="description"',
    'name="fullDescription"',
    'name="organizer"',
    'name="rules"',
    'name="prizes"'
  ];

  requiredFields.forEach((field) => {
    assert.ok(
      html.includes(field),
      `Expected event-modal form to contain input with ${field}`
    );
  });
});

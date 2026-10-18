const assert = require("node:assert/strict");
const test = require("node:test");
const AdminSettingsModal = require("../public/js/admin-settings-modal");

test("admin settings menu defines all required navigation items in order", () => {
  const sections = AdminSettingsModal.SETTINGS_SECTIONS;
  const labels = sections.map((s) => s.label);

  assert.deepEqual(labels, [
    "Profile Settings",
    "Screen Settings",
    "User Management",
    "Permission Settings", // under user management
    "Event Management",
    "Payment Info",
    "Permission Settings", // main menu item
    "Logout"
  ]);

  const permSub = sections.find((s) => s.id === "permissions-sub");
  assert.equal(permSub.parent, "user-mgmt");

  const logoutItem = sections.find((s) => s.id === "logout");
  assert.equal(logoutItem.isAction, true);
});

test("getActiveSection returns fallback to profile for unknown section", () => {
  assert.equal(AdminSettingsModal.getActiveSection("unknown-id"), "profile");
  assert.equal(AdminSettingsModal.getActiveSection("screen"), "screen");
  assert.equal(AdminSettingsModal.getActiveSection("payment"), "payment");
});

test("getSectionTitle resolves the correct display title for each section", () => {
  assert.equal(AdminSettingsModal.getSectionTitle("profile"), "Profile Settings");
  assert.equal(AdminSettingsModal.getSectionTitle("events"), "Event Management");
  assert.equal(AdminSettingsModal.getSectionTitle("payment"), "Payment Info");
  assert.equal(AdminSettingsModal.getSectionTitle("non-existent"), "Settings");
});

test("profile preference storage validates save and retrieval behavior", () => {
  // Mock localStorage
  const mockStorage = new Map();
  global.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key)
  };

  const defaultProfile = AdminSettingsModal.getStoredProfile();
  assert.equal(defaultProfile.role, "Super Admin");
  assert.equal(defaultProfile.username, "admin");

  const custom = {
    displayName: "Lead Coordinator",
    username: "admin",
    email: "lead@excel.edu",
    role: "Super Admin",
    department: "Computer Science & Engineering",
    contactNumber: "+91 94444 12345"
  };

  const saveRes = AdminSettingsModal.saveStoredProfile(custom);
  assert.equal(saveRes.success, true);

  const retrieved = AdminSettingsModal.getStoredProfile();
  assert.equal(retrieved.displayName, "Lead Coordinator");
  assert.equal(retrieved.email, "lead@excel.edu");
  assert.equal(retrieved.department, "Computer Science & Engineering");

  delete global.localStorage;
});

test("theme and density settings apply and store preferences correctly", () => {
  const mockStorage = new Map();
  global.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key)
  };

  AdminSettingsModal.applyTheme("high-contrast");
  assert.equal(AdminSettingsModal.getStoredTheme(), "high-contrast");

  AdminSettingsModal.applyDensity("compact");
  assert.equal(AdminSettingsModal.getStoredDensity(), "compact");

  delete global.localStorage;
});

test("branding and role permissions storage validates save and retrieval behavior", () => {
  const mockStorage = new Map();
  global.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key)
  };

  const defaultBranding = AdminSettingsModal.getStoredBranding();
  assert.equal(defaultBranding.websiteName, "Excel Event Hub");
  assert.equal(defaultBranding.primaryColor, "#1e3a8a");

  AdminSettingsModal.applyBranding({
    websiteName: "Campus Tech Hub",
    primaryColor: "#2563eb",
    theme: "light",
    density: "spacious"
  });
  const savedBranding = AdminSettingsModal.getStoredBranding();
  assert.equal(savedBranding.websiteName, "Campus Tech Hub");
  assert.equal(savedBranding.primaryColor, "#2563eb");

  const defaultPerms = AdminSettingsModal.getStoredPermissions();
  assert.equal(defaultPerms.hod.viewDashboard, true);
  assert.equal(defaultPerms.student.viewDashboard, false);
  assert.equal(defaultPerms.student.onlineRegistration, true);

  const customPerms = {
    hod: { ...defaultPerms.hod, addEvents: true },
    student: { ...defaultPerms.student, viewDashboard: true }
  };
  const permRes = AdminSettingsModal.saveStoredPermissions(customPerms);
  assert.equal(permRes.success, true);
  const updatedPerms = AdminSettingsModal.getStoredPermissions();
  assert.equal(updatedPerms.hod.addEvents, true);
  assert.equal(updatedPerms.student.viewDashboard, true);

  delete global.localStorage;
});

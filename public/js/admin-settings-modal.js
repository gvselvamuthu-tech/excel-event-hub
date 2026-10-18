(function (root, factory) {
  const adminSettingsModal = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = adminSettingsModal;
  }
  if (root) {
    root.AdminSettingsModal = adminSettingsModal;
  }
})(typeof window !== "undefined" ? window : null, function () {
  const SETTINGS_SECTIONS = [
    { id: "profile", label: "Profile Settings", icon: "👤", parent: null },
    { id: "screen", label: "Screen Settings", icon: "🖥️", parent: null },
    { id: "user-mgmt", label: "User Management", icon: "👥", parent: null },
    { id: "permissions-sub", label: "Permission Settings", icon: "🛡️", parent: "user-mgmt" },
    { id: "events", label: "Event Management", icon: "📅", parent: null },
    { id: "payment", label: "Payment Info", icon: "💳", parent: null },
    { id: "permissions", label: "Permission Settings", icon: "🔐", parent: null },
    { id: "logout", label: "Logout", icon: "🚪", isAction: true, parent: null }
  ];

  function getActiveSection(currentId) {
    const found = SETTINGS_SECTIONS.find((s) => s.id === currentId);
    return found ? found.id : "profile";
  }

  function getSectionTitle(sectionId) {
    const s = SETTINGS_SECTIONS.find((item) => item.id === sectionId);
    return s ? s.label : "Settings";
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem("excel_admin_theme") || "dark";
    } catch (e) {
      return "dark";
    }
  }

  function applyTheme(theme) {
    try {
      localStorage.setItem("excel_admin_theme", theme);
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.setAttribute("data-admin-theme", theme);
      }
    } catch (e) {
      // storage unavailable
    }
    return theme;
  }

  function getStoredDensity() {
    try {
      return localStorage.getItem("excel_admin_density") || "comfortable";
    } catch (e) {
      return "comfortable";
    }
  }

  function applyDensity(density) {
    try {
      localStorage.setItem("excel_admin_density", density);
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.setAttribute("data-admin-density", density);
      }
    } catch (e) {
      // storage unavailable
    }
    return density;
  }

  function getStoredProfile() {
    try {
      const saved = localStorage.getItem("excel_admin_custom_profile");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // fallback
    }
    let username = "admin";
    try {
      const identity = sessionStorage.getItem("excel_admin_identity");
      if (identity) username = identity;
    } catch (e) {}
    return {
      displayName: "Administrator",
      username: username,
      email: username.includes("@") ? username : "admin@excel.edu",
      role: "Super Admin",
      department: "Event Coordination Cell",
      contactNumber: "+91 98765 43210"
    };
  }

  function saveStoredProfile(profile) {
    try {
      localStorage.setItem("excel_admin_custom_profile", JSON.stringify(profile));
      return { success: true, profile };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  function getStoredBranding() {
    try {
      const saved = localStorage.getItem("excel_admin_branding");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      websiteName: "Excel Event Hub",
      logoDataUrl: "",
      theme: "dark",
      primaryColor: "#1e3a8a",
      density: "comfortable"
    };
  }

  function applyBranding(branding) {
    if (!branding || typeof branding !== "object") return;
    try {
      localStorage.setItem("excel_admin_branding", JSON.stringify(branding));
    } catch (e) {}

    if (typeof document !== "undefined") {
      if (branding.websiteName) {
        document.querySelectorAll("[data-college-name], .brand-text").forEach((el) => {
          el.textContent = branding.websiteName;
        });
      }
      if (branding.primaryColor && document.documentElement) {
        document.documentElement.style.setProperty("--primary", branding.primaryColor);
        document.documentElement.style.setProperty("--primary-dark", branding.primaryColor);
        document.documentElement.style.setProperty("--accent", branding.primaryColor);
      }
      if (branding.theme) {
        applyTheme(branding.theme);
      }
      if (branding.density) {
        applyDensity(branding.density);
      }
      if (branding.logoDataUrl) {
        document.querySelectorAll(".brand-mark").forEach((el) => {
          el.innerHTML = `<img src="${branding.logoDataUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;" />`;
        });
      }
    }
  }

  const DEFAULT_PERMISSIONS = {
    hod: {
      viewDashboard: true,
      viewEvents: true,
      addEvents: false,
      editEvents: false,
      deleteEvents: false,
      viewRegistrations: true,
      viewRegistrationCounts: true,
      viewParticipantDetails: true,
      onlineRegistration: true,
      offlineRegistration: true,
      viewPaymentInfo: false,
      managePaymentQrs: false,
      viewReports: true,
      manageUsers: false,
      manageBranding: false
    },
    student: {
      viewDashboard: false,
      viewEvents: true,
      addEvents: false,
      editEvents: false,
      deleteEvents: false,
      viewRegistrations: false,
      viewRegistrationCounts: false,
      viewParticipantDetails: false,
      onlineRegistration: true,
      offlineRegistration: false,
      viewPaymentInfo: false,
      managePaymentQrs: false,
      viewReports: false,
      manageUsers: false,
      manageBranding: false
    }
  };

  function getStoredPermissions() {
    try {
      const saved = localStorage.getItem("excel_admin_permissions");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_PERMISSIONS;
  }

  function saveStoredPermissions(perms) {
    try {
      localStorage.setItem("excel_admin_permissions", JSON.stringify(perms));
      return { success: true, permissions: perms };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  return {
    SETTINGS_SECTIONS,
    DEFAULT_PERMISSIONS,
    getActiveSection,
    getSectionTitle,
    getStoredTheme,
    applyTheme,
    getStoredDensity,
    applyDensity,
    getStoredProfile,
    saveStoredProfile,
    getStoredBranding,
    applyBranding,
    getStoredPermissions,
    saveStoredPermissions
  };
});

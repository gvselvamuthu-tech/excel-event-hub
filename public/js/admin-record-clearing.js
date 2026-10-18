(function (root, factory) {
  const recordClearing = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = recordClearing;
  }
  if (root) {
    Object.assign(root, recordClearing);
  }
})(typeof window !== "undefined" ? window : null, function () {
  const datasets = new Set(["payments", "registrations", "all-registration-payments"]);

  async function verifyAndClearAdminRecords(dataset, credentials, confirmClear, sendRequest) {
    if (!datasets.has(dataset)) {
      throw new Error("Only registration and payment records can be cleared here.");
    }

    await sendRequest("/admin/verify", credentials);
    const confirmMessage = dataset === "all-registration-payments"
      ? "Are you sure you want to delete ALL registration and payment records? This action permanently clears all participant registrations and payments and cannot be undone."
      : dataset === "registrations"
        ? "Are you sure you want to delete ALL registration records? This action cannot be undone."
        : "Are you sure you want to delete ALL payment records? This action cannot be undone.";

    if (!confirmClear(confirmMessage)) {
      return { cancelled: true };
    }

    const endpoint = dataset === "all-registration-payments"
      ? "/records/clear"
      : dataset === "registrations"
        ? "/registrations/clear"
        : "/payments/clear";

    return sendRequest(endpoint, { ...credentials, confirmed: true, dataset });
  }

  return { verifyAndClearAdminRecords };
});

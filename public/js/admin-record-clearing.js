(function (root, factory) {
  const recordClearing = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = recordClearing;
  }
  if (root) {
    Object.assign(root, recordClearing);
  }
})(typeof window !== "undefined" ? window : null, function () {
  const datasets = new Set(["payments"]);

  async function verifyAndClearAdminRecords(dataset, credentials, confirmClear, sendRequest) {
    if (!datasets.has(dataset)) {
      throw new Error("Only payment records can be cleared here.");
    }

    await sendRequest("/admin/verify", credentials);
    if (!confirmClear("Are you sure you want to delete ALL payment records? This action cannot be undone.")) {
      return { cancelled: true };
    }
    return sendRequest("/payments/clear", { ...credentials, confirmed: true });
  }

  return { verifyAndClearAdminRecords };
});

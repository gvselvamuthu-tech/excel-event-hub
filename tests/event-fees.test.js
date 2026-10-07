const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeLegacyRegistrationFee } = require("../lib/event-fees");

test("legacy events with missing or invalid registration fees normalize to zero", () => {
  for (const value of [undefined, null, Number.NaN, "", "  ", "invalid", -20, 20.123]) {
    assert.equal(normalizeLegacyRegistrationFee(value), 0, `expected ${String(value)} to normalize to zero`);
  }
});

test("valid legacy registration fees remain unchanged", () => {
  for (const fee of [20, 50, 100, 250]) {
    assert.equal(normalizeLegacyRegistrationFee(fee), fee);
  }

  assert.equal(normalizeLegacyRegistrationFee("₹1,250.50"), 1250.5);
});

test("legacy Seminar fee remains encoded in the dynamic payment URI", () => {
  const { buildEventUpiPaymentLink } = require("../public/js/payment-config");
  const paymentUri = new URL(buildEventUpiPaymentLink({
    id: "seminar",
    title: "Seminar",
    registrationFee: normalizeLegacyRegistrationFee(20)
  }));

  assert.equal(paymentUri.searchParams.get("am"), "20");
});

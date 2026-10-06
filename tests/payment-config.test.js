const assert = require("node:assert/strict");
const test = require("node:test");
const QRCode = require("qrcode");
const {
  PAYMENT_CONFIG,
  buildEventUpiPaymentLink,
  formatRegistrationFee,
  parseRegistrationFee
} = require("../public/js/payment-config");

test("event UPI links use the configured payee and each event fee", () => {
  const seminar = new URL(buildEventUpiPaymentLink({
    id: "seminar",
    title: "Seminar",
    registrationFee: 20
  }));
  const workshop = new URL(buildEventUpiPaymentLink({
    id: "workshop",
    title: "Workshop",
    registrationFee: 50
  }));

  assert.equal(seminar.protocol, "upi:");
  assert.equal(seminar.searchParams.get("pa"), PAYMENT_CONFIG.upiId);
  assert.equal(seminar.searchParams.get("am"), "20");
  assert.equal(seminar.searchParams.get("cu"), "INR");
  assert.equal(workshop.searchParams.get("am"), "50");
});

test("registration fees accept existing INR strings and reject invalid values", () => {
  assert.equal(parseRegistrationFee("₹1,250.50"), 1250.5);
  assert.equal(parseRegistrationFee("₹1,00,000"), 100000);
  assert.equal(parseRegistrationFee(-20), null);
  assert.equal(parseRegistrationFee(20.123), null);
  assert.equal(parseRegistrationFee(1e308), null);
  assert.equal(parseRegistrationFee("abc"), null);
  assert.equal(parseRegistrationFee(""), null);
  assert.equal(formatRegistrationFee(20), "₹20");
  assert.equal(formatRegistrationFee("₹50.50"), "₹50.50");
});

test("events without a saved fee retain a valid UPI URI without an invalid zero amount", () => {
  const paymentUri = new URL(buildEventUpiPaymentLink({ id: "legacy", title: "Legacy" }));

  assert.equal(paymentUri.searchParams.get("pa"), PAYMENT_CONFIG.upiId);
  assert.equal(paymentUri.searchParams.get("am"), null);
});

test("payment QR generation returns a PNG for the event-specific UPI URI", async () => {
  const paymentUri = buildEventUpiPaymentLink({
    id: "seminar",
    title: "Seminar",
    registrationFee: 20
  });
  const image = await QRCode.toBuffer(paymentUri, { type: "png", errorCorrectionLevel: "H" });

  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(image.length > 100);
});

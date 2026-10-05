window.PAYMENT_CONFIG = {
  upiId: "suba.arni@okaxis",
  payeeName: "Excel Event Hub"
};

window.buildEventUpiPaymentLink = (event) => {
  const config = window.PAYMENT_CONFIG;
  const amount = Number(String(event?.registrationFee || "").replace(/[^\d.]/g, "")) || 0;
  const details = new URLSearchParams({
    pa: config.upiId,
    pn: config.payeeName,
    am: String(amount),
    cu: "INR",
    tn: `Excel Event Hub - ${event?.title || ""} (${event?.id || ""})`
  });
  return `upi://pay?${details.toString()}`;
};

window.getEventPaymentQrUrl = (event) => {
  const qrCode = String(event?.qrCode || "").trim();
  if (qrCode && qrCode.toLowerCase() !== "upi:auto") {
    return window.resolveEventAsset ? window.resolveEventAsset(qrCode) : qrCode;
  }

  const defaultQrImage = "assets/images/payment-qr.jpe";
  return window.resolveEventAsset ? window.resolveEventAsset(defaultQrImage) : defaultQrImage;
};

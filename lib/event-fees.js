const { parseRegistrationFee } = require("../public/js/payment-config");

function normalizeLegacyRegistrationFee(value) {
  const registrationFee = parseRegistrationFee(value);
  return registrationFee === null ? 0 : registrationFee;
}

module.exports = { normalizeLegacyRegistrationFee };

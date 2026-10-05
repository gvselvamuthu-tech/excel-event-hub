document.addEventListener("DOMContentLoaded", async () => {
  const paymentForm = document.getElementById("payment-form");
  const paymentMessage = document.getElementById("payment-message");
  const qrCodeContainer = document.getElementById("upi-qr-code");
  const qrScanTrigger = document.getElementById("qr-scan-trigger");
  const qrScannerModal = document.getElementById("qr-scanner-modal");
  const qrScannerStatus = document.getElementById("qr-scanner-status");
  const qrVideo = document.getElementById("qr-video");
  const qrScannerCloseButton = document.getElementById("close-qr-scanner");
  const upiLinkButton = document.getElementById("upi-pay-link");
  const upiIdField = document.getElementById("upi-id");
  const amountField = document.getElementById("amount");
  const completePaymentButton = document.getElementById("complete-payment-btn");
  const formWrapper = document.getElementById("payment-form-wrapper");
  const confirmationWrapper = document.getElementById("payment-confirmation");
  let qrCameraStream = null;
  let qrScanTimer = null;
  let qrScanResolved = false;

  if (!paymentForm) return;

  if (qrScanTrigger) {
    qrScanTrigger.addEventListener("click", openQrScanner);
  }

  if (qrScannerCloseButton) {
    qrScannerCloseButton.addEventListener("click", stopQrScanner);
  }

  if (qrScannerModal) {
    qrScannerModal.addEventListener("click", (event) => {
      if (event.target === qrScannerModal || event.target instanceof HTMLElement && event.target.matches("[data-close-qr-scanner]")) {
        stopQrScanner();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && qrScannerModal && !qrScannerModal.hidden) {
      stopQrScanner();
    }
  });

  await window.fetchLatestEventData?.().catch(() => window.getEventData?.() || window.EVENT_DATA || { technical: [], nonTechnical: [] });
  const allEvents = window.getAllEvents ? window.getAllEvents() : [...(window.EVENT_DATA?.technical || []), ...(window.EVENT_DATA?.nonTechnical || [])];
  const storedRegistrationData = JSON.parse(localStorage.getItem("excelEventRegistration") || "null");
  const storedPaymentRecord = JSON.parse(localStorage.getItem("excelEventPayment") || "null");
  const requestedEventId = new URLSearchParams(window.location.search).get("event");
  const savedEventId = requestedEventId || storedPaymentRecord?.eventId || storedRegistrationData?.eventId || allEvents[0]?.id;
  const selectedEvent = allEvents.find((event) => String(event.id) === String(savedEventId));
  const registrationData = selectedEvent && String(storedRegistrationData?.eventId || "") === String(selectedEvent.id)
    ? storedRegistrationData
    : null;
  const paymentRecord = selectedEvent && String(storedPaymentRecord?.eventId || "") === String(selectedEvent.id)
    ? storedPaymentRecord
    : null;

  const buildUpiPaymentLink = () => {
    return window.buildEventUpiPaymentLink(selectedEvent);
  };

  const renderQrCode = () => {
    if (!qrCodeContainer) return;
    const qrImage = document.createElement("img");
    qrImage.alt = `${selectedEvent?.title || "Selected event"} QR code`;
    qrImage.width = 170;
    qrImage.height = 170;
    const assignedQr = selectedEvent?.qrCode && String(selectedEvent.qrCode).toLowerCase() !== "upi:auto";
    if (assignedQr) {
      qrImage.onerror = () => {
        qrImage.onerror = null;
        qrImage.src = window.getEventPaymentQrUrl({ ...selectedEvent, qrCode: "upi:auto" });
      };
    }
    qrImage.src = window.getEventPaymentQrUrl(selectedEvent);
    qrCodeContainer.replaceChildren(qrImage);
  };

  const setScannerStatus = (message, isError = false) => {
    if (!qrScannerStatus) return;
    qrScannerStatus.textContent = message;
    qrScannerStatus.style.color = isError ? "#ff9aae" : "#d9f7ff";
  };

  function stopQrScanner() {
    if (qrScanTimer) {
      window.clearInterval(qrScanTimer);
      qrScanTimer = null;
    }

    if (qrCameraStream) {
      qrCameraStream.getTracks().forEach((track) => track.stop());
      qrCameraStream = null;
    }

    if (qrVideo) {
      qrVideo.pause();
      qrVideo.srcObject = null;
    }

    if (qrScannerModal) {
      qrScannerModal.hidden = true;
      qrScannerModal.setAttribute("aria-hidden", "true");
    }

    document.body.classList.remove("modal-open");
    qrScanResolved = false;
  }

  async function openQrScanner() {
    if (!qrScannerModal || !qrVideo) return;

    qrScannerModal.hidden = false;
    qrScannerModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    qrScanResolved = false;
    setScannerStatus("Requesting camera access...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScannerStatus("This browser does not support camera scanning. Please use the UPI app pay link instead.", true);
      return;
    }

    try {
      qrCameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      qrVideo.srcObject = qrCameraStream;
      await qrVideo.play().catch(() => undefined);

      const supportsBarcodeDetector = "BarcodeDetector" in window;
      if (!supportsBarcodeDetector) {
        setScannerStatus("Camera is ready, but this browser does not support in-browser QR decoding. Please scan manually with the UPI app or use the direct pay link.", true);
        return;
      }

      const decoder = new BarcodeDetector({ formats: ["qr_code"] });
      setScannerStatus("Scanning for QR code...");

      qrScanTimer = window.setInterval(async () => {
        if (qrScanResolved || !qrVideo || qrVideo.readyState < 2) return;

        try {
          const detectionResults = await decoder.detect(qrVideo);
          const detectedBarcode = detectionResults.find((barcode) => barcode?.rawValue);

          if (!detectedBarcode) return;

          qrScanResolved = true;
          const scannedValue = detectedBarcode.rawValue;
          setScannerStatus(`QR code scanned successfully. ${scannedValue}`);
          setMessage("QR scan succeeded. Complete payment in your UPI app and then enter the UTR/transaction ID.", "success");
          window.clearInterval(qrScanTimer);
          qrScanTimer = null;
          window.setTimeout(() => stopQrScanner(), 1800);
        } catch (error) {
          setScannerStatus("Scanning for QR code...");
        }
      }, 550);
    } catch (error) {
      setScannerStatus("Camera access was denied or unavailable. Please allow access or use the direct UPI pay link.", true);
    }
  }

  const setMessage = (message, type = "success") => {
    if (!paymentMessage) return;
    paymentMessage.hidden = false;
    paymentMessage.className = "message-box";
    paymentMessage.classList.add(type === "error" ? "error-box" : "success-box");
    paymentMessage.textContent = message;
  };

  const generateReferenceId = () => {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `REG-${stamp}-${random}`;
  };

  const renderSummary = (record) => {
    const eventNameNode = document.getElementById("summary-event-name");
    const participantNameNode = document.getElementById("summary-participant-name");
    const amountNode = document.getElementById("summary-amount");
    const statusNode = document.getElementById("summary-status");
    const eventName = record?.eventName || selectedEvent?.title || "Selected Event";
    const participantName = record?.fullName || registrationData?.fullName || "Participant";
    const amount = record?.amount || selectedEvent?.registrationFee || "₹0";
    const paymentStatus = (record?.paymentStatus || "Pending").toLowerCase() === "submitted" ? "Submitted" : record?.paymentStatus || "Pending";

    if (eventNameNode) eventNameNode.textContent = eventName;
    if (participantNameNode) participantNameNode.textContent = participantName;
    if (amountNode) amountNode.textContent = amount;
    if (statusNode) statusNode.textContent = paymentStatus;
  };

  const renderConfirmation = (record) => {
    if (formWrapper) formWrapper.hidden = true;
    if (confirmationWrapper) confirmationWrapper.hidden = false;

    const eventNameNode = document.getElementById("confirmation-event-name");
    const participantNameNode = document.getElementById("confirmation-participant-name");
    const referenceIdNode = document.getElementById("confirmation-reference-id");
    const amountNode = document.getElementById("confirmation-amount");
    const statusNode = document.getElementById("confirmation-status");

    if (eventNameNode) eventNameNode.textContent = record?.eventName || selectedEvent?.title || "Selected Event";
    if (participantNameNode) participantNameNode.textContent = record?.fullName || registrationData?.fullName || "Participant";
    if (referenceIdNode) referenceIdNode.textContent = record?.referenceId || "Pending";
    if (amountNode) amountNode.textContent = record?.amount || selectedEvent?.registrationFee || "₹0";
    if (statusNode) statusNode.textContent = record?.paymentStatus || "Submitted";
  };

  if (!selectedEvent) {
    setMessage("The selected event could not be found. Please go back and choose a valid event.", "error");
    return;
  }

  const scannerEnabled = window.isEventQrScannerEnabled
    ? window.isEventQrScannerEnabled(selectedEvent)
    : (selectedEvent.scannerEnabled !== undefined
      ? ["true", "1", "yes"].includes(String(selectedEvent.scannerEnabled).trim().toLowerCase())
      : /\bseminar\b/i.test(`${selectedEvent.id || ""} ${selectedEvent.title || ""}`));
  if (qrScanTrigger) {
    qrScanTrigger.disabled = !scannerEnabled;
    qrScanTrigger.setAttribute("aria-label", scannerEnabled ? "Scan QR Code" : "QR scanner unavailable for this event");
  }

  const registrationMatchesEvent = Boolean(registrationData);
  const paymentMatchesEvent = Boolean(paymentRecord);
  const registrationOpen = window.isEventRegistrationOpen
    ? window.isEventRegistrationOpen(selectedEvent)
    : String(selectedEvent.status || "Open").trim().toLowerCase() !== "closed";

  const config = window.PAYMENT_CONFIG || { upiId: "YOUR_UPI_ID_HERE", payeeName: "Excel Event Hub" };
  const upiId = String(config.upiId || "").trim();
  const payeeName = String(config.payeeName || "Excel Event Hub").trim();

  const eventNameNode = document.getElementById("payment-event-name");
  const eventFeeNode = document.getElementById("payment-event-fee");
  const eventDateNode = document.getElementById("payment-event-date");
  const eventTimeNode = document.getElementById("payment-event-time");
  const eventVenueNode = document.getElementById("payment-event-venue");
  const eventImageNode = document.getElementById("payment-event-image");
  const registrationNameNode = document.getElementById("payment-student-name");
  const registrationIdNode = document.getElementById("payment-student-id");

  if (eventNameNode) eventNameNode.textContent = selectedEvent.title;
  if (eventFeeNode) eventFeeNode.textContent = selectedEvent.registrationFee;
  if (eventDateNode) eventDateNode.textContent = selectedEvent.date.replace(/^Sample:\s*/i, "");
  if (eventTimeNode) eventTimeNode.textContent = selectedEvent.time.replace(/^Sample:\s*/i, "");
  if (eventVenueNode) eventVenueNode.textContent = selectedEvent.venue.replace(/^Sample:\s*/i, "");
  if (eventImageNode) {
    eventImageNode.onerror = () => {
      eventImageNode.onerror = null;
      eventImageNode.src = window.EVENT_IMAGE_FALLBACK || "../assets/images/event-placeholder.svg";
    };
    eventImageNode.src = window.resolveEventImage(selectedEvent.image, selectedEvent.id);
  }
  if (registrationNameNode) registrationNameNode.textContent = registrationData?.fullName || "Student details not available";
  if (registrationIdNode) registrationIdNode.textContent = registrationData?.registerNumber || "Register number pending";

  const hasValidUpiId = Boolean(upiId && upiId !== "YOUR_UPI_ID_HERE");

  if (upiIdField) upiIdField.value = hasValidUpiId ? upiId : "YOUR_UPI_ID_HERE";
  if (amountField) amountField.value = selectedEvent.registrationFee;

  renderQrCode();

  if (upiLinkButton) {
    const upiLink = hasValidUpiId ? buildUpiPaymentLink() : "#";

    upiLinkButton.href = upiLink;
    upiLinkButton.classList.toggle("is-disabled", !hasValidUpiId);
    upiLinkButton.textContent = hasValidUpiId ? "Pay via UPI App" : "UPI placeholder";
    upiLinkButton.setAttribute("aria-disabled", String(!hasValidUpiId));
  }

  renderSummary(paymentRecord || registrationData || { paymentStatus: "Pending" });

  if (paymentRecord?.paymentStatus === "submitted" && paymentMatchesEvent) {
    renderConfirmation(paymentRecord);
    return;
  }

  if (!registrationOpen && !registrationMatchesEvent && !paymentMatchesEvent) {
    if (formWrapper) formWrapper.hidden = true;
    setMessage("Registration Closed — this event is still available to view, but new registrations and payments are not being accepted.", "error");
    return;
  }

  if (!hasValidUpiId) {
    setMessage("UPI payment is ready for testing with a placeholder ID. Replace YOUR_UPI_ID_HERE when you want a real payment link.", "success");
  }

  completePaymentButton?.addEventListener("click", async (event) => {
    event.preventDefault();

    const utRNumber = document.getElementById("utr-number")?.value.trim();
    const isValidUtr = /^[A-Za-z0-9]{8,25}$/.test(utRNumber || "");

    if (!utRNumber || !isValidUtr) {
      setMessage("Please enter a valid UTR or transaction ID before continuing.", "error");
      const field = document.getElementById("utr-number");
      if (field) {
        field.setAttribute("aria-invalid", "true");
      }
      return;
    }

    const field = document.getElementById("utr-number");
    if (field) {
      field.setAttribute("aria-invalid", "false");
    }

    const referenceId = registrationData?.referenceId || generateReferenceId();
    const paymentRecordToSave = {
      ...registrationData,
      eventId: selectedEvent.id,
      eventName: selectedEvent.title,
      fullName: registrationData?.fullName || "Participant",
      amount: selectedEvent.registrationFee,
      paymentStatus: "Submitted",
      paymentMethod: "UPI",
      utrNumber: utRNumber,
      referenceId,
      paymentDate: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceId,
          eventId: selectedEvent.id,
          eventName: selectedEvent.title,
          participantName: paymentRecordToSave.fullName,
          email: registrationData?.email || "",
          phone: registrationData?.mobile || "",
          department: registrationData?.department || "",
          year: registrationData?.year || "",
          team: registrationData?.teamName || registrationData?.participationType || "",
          amount: paymentRecordToSave.amount,
          paymentTransactionId: utRNumber,
          paymentStatus: paymentRecordToSave.paymentStatus,
          registrationDateTime: paymentRecordToSave.paymentDate,
          paymentMethod: paymentRecordToSave.paymentMethod,
          paymentDate: paymentRecordToSave.paymentDate
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    } catch (error) {
      setMessage(`Payment could not be saved. Start the local server and try again. ${error.message}`, "error");
      return;
    }

    localStorage.setItem("excelEventPayment", JSON.stringify(paymentRecordToSave));
    setMessage(`Registration Submitted Successfully. Reference ID: ${referenceId}`, "success");
    renderConfirmation(paymentRecordToSave);
    paymentForm.reset();
  });
});

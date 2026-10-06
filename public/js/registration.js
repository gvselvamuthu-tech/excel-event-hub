document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("registration-form");
  const messageBox = document.getElementById("registration-message");

  if (!form) return;

  await window.fetchLatestEventData?.().catch(() => window.getEventData?.() || window.EVENT_DATA || { technical: [], nonTechnical: [] });
  const allEvents = window.getAllEvents ? window.getAllEvents() : [...(window.EVENT_DATA?.technical || []), ...(window.EVENT_DATA?.nonTechnical || [])];
  const urlParams = new URLSearchParams(window.location.search);
  const requestedEventId = urlParams.get("event");
  const eventId = requestedEventId || allEvents[0]?.id;
  const selectedEvent = allEvents.find((event) => String(event.id) === String(eventId));
  const eventNameInput = document.getElementById("event-name");
  const teamFields = document.getElementById("team-fields");
  const teamMembersWrap = document.getElementById("team-members");
  const teamSizeInput = document.getElementById("team-size");
  const qrWrap = document.getElementById("reg-event-qr-wrap");
  const qrImage = document.getElementById("reg-event-qr");
  const registrationOpen = selectedEvent && (window.isEventRegistrationOpen
    ? window.isEventRegistrationOpen(selectedEvent)
    : String(selectedEvent.status || "Open").trim().toLowerCase() !== "closed");

  const setText = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  };

  const parseMaxTeamSize = (teamSizeText) => {
    if (!teamSizeText) return 1;
    if (String(teamSizeText).toLowerCase() === "individual") return 1;
    const matches = String(teamSizeText).match(/(\d+)(?:\s*[-–]\s*(\d+))?/i);
    if (!matches) return 1;
    const maxValue = matches[2] ? Number(matches[2]) : Number(matches[1]);
    return Number.isFinite(maxValue) ? maxValue : 1;
  };

  const setSelectedEvent = () => {
    if (!selectedEvent) return;

    const image = document.getElementById("reg-event-image");
    const name = document.getElementById("reg-event-name");
    const category = document.getElementById("reg-event-category");
    const fee = document.getElementById("reg-event-fee");
    const date = document.getElementById("reg-event-date");
    const time = document.getElementById("reg-event-time");
    const venue = document.getElementById("reg-event-venue");

    if (image) {
      image.onerror = () => {
        image.onerror = null;
        image.src = window.EVENT_IMAGE_FALLBACK || "../assets/images/event-placeholder.svg";
      };
      image.src = window.resolveEventImage(selectedEvent.image, selectedEvent.id);
    }
    if (name) name.textContent = selectedEvent.title;
    if (category) category.textContent = selectedEvent.category + " Event";
    if (fee) fee.textContent = window.formatRegistrationFee(selectedEvent.registrationFee);
    if (date) date.textContent = selectedEvent.date.replace(/^Sample:\s*/i, "");
    if (time) time.textContent = selectedEvent.time.replace(/^Sample:\s*/i, "");
    if (venue) venue.textContent = selectedEvent.venue.replace(/^Sample:\s*/i, "");
    if (eventNameInput) eventNameInput.value = selectedEvent.title;
    if (qrWrap && qrImage) {
      qrImage.onerror = () => {
        qrImage.onerror = null;
        qrImage.hidden = true;
        const errorMessage = document.createElement("p");
        errorMessage.className = "event-qr-card__error";
        errorMessage.setAttribute("role", "alert");
        errorMessage.textContent = "The payment QR code could not be generated.";
        qrImage.after(errorMessage);
      };
      qrImage.src = window.getEventPaymentQrUrl(selectedEvent);
      qrWrap.hidden = !registrationOpen;
    }
  };

  const renderTeamMembers = () => {
    const maxTeamSize = parseMaxTeamSize(selectedEvent?.teamSize || "1");
    const participationType = form.querySelector('input[name="participationType"]:checked')?.value || "Individual";
    const shouldShowTeamFields = participationType === "Team" && maxTeamSize > 1;

    teamFields.classList.toggle("is-hidden", !shouldShowTeamFields);
    if (!teamMembersWrap) return;

    if (!shouldShowTeamFields) {
      teamMembersWrap.innerHTML = "";
      if (teamSizeInput) teamSizeInput.value = "";
      return;
    }

    if (teamSizeInput) teamSizeInput.value = `${maxTeamSize} members`;

    const teamMemberFields = Array.from({ length: maxTeamSize }, (_, index) => {
      const number = index + 1;
      return `
        <div class="team-member-row">
          <div class="team-member-row__header">Team Member ${number}</div>
          <div class="form-row">
            <div class="form-field">
              <label for="member-${number}-name">Name</label>
              <input id="member-${number}-name" name="member${number}Name" type="text" placeholder="Enter team member ${number} name" />
            </div>
            <div class="form-field">
              <label for="member-${number}-register">Register Number</label>
              <input id="member-${number}-register" name="member${number}RegisterNumber" type="text" placeholder="Enter register number" />
            </div>
          </div>
        </div>
      `;
    }).join("");

    teamMembersWrap.innerHTML = teamMemberFields;
  };

  const getFieldError = (fieldName) => document.querySelector(`[data-error-for="${fieldName}"]`);

  const showError = (fieldName, message) => {
    const errorNode = getFieldError(fieldName);
    if (errorNode) errorNode.textContent = message;
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (field) field.setAttribute("aria-invalid", "true");
  };

  const clearError = (fieldName) => {
    const errorNode = getFieldError(fieldName);
    if (errorNode) errorNode.textContent = "";
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (field) field.setAttribute("aria-invalid", "false");
  };

  const validateField = (fieldName, value) => {
    switch (fieldName) {
      case "fullName":
        if (!value || value.trim().length < 3) {
          showError("fullName", "Please enter a valid full name with at least 3 characters.");
          return false;
        }
        break;
      case "registerNumber":
        if (!value || !value.trim()) {
          showError("registerNumber", "Please enter your register number.");
          return false;
        }
        break;
      case "collegeName":
        if (!value || !value.trim()) {
          showError("collegeName", "Please enter your college name.");
          return false;
        }
        break;
      case "department":
        if (!value || !value.trim()) {
          showError("department", "Please enter your department.");
          return false;
        }
        break;
      case "year":
        if (!value) {
          showError("year", "Please select your academic year.");
          return false;
        }
        break;
      case "email":
        if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          showError("email", "Please enter a valid email address.");
          return false;
        }
        break;
      case "mobile":
        if (!value || !/^[6-9]\d{9}$/.test(value.replace(/\s+/g, ""))) {
          showError("mobile", "Please enter a valid 10-digit mobile number.");
          return false;
        }
        break;
      case "terms":
        if (!value) {
          showError("terms", "Please confirm the information before submitting.");
          return false;
        }
        break;
      default:
        break;
    }

    clearError(fieldName);
    return true;
  };

  const validateTeamMembers = () => {
    const participationType = form.querySelector('input[name="participationType"]:checked')?.value || "Individual";
    if (participationType !== "Team") return true;

    const maxTeamSize = parseMaxTeamSize(selectedEvent?.teamSize || "1");
    let valid = true;

    for (let index = 1; index <= maxTeamSize; index += 1) {
      const nameField = form.querySelector(`[name="member${index}Name"]`);
      const registerField = form.querySelector(`[name="member${index}RegisterNumber"]`);

      if (!nameField || !registerField) continue;

      const nameValue = nameField.value.trim();
      const regValue = registerField.value.trim();
      if (!nameValue || !regValue) {
        valid = false;
        if (!nameValue) showError(`member${index}Name`, "Please enter team member name.");
        if (!regValue) showError(`member${index}RegisterNumber`, "Please enter team member register number.");
      } else {
        clearError(`member${index}Name`);
        clearError(`member${index}RegisterNumber`);
      }
    }

    return valid;
  };

  if (!selectedEvent) {
    if (form) form.hidden = true;
    if (messageBox) {
      messageBox.hidden = false;
      messageBox.className = "message-box error-box";
      messageBox.textContent = "Event not found. Please return to the events page and select a valid event.";
    }
    return;
  }

  setSelectedEvent();
  if (!registrationOpen) {
    form.hidden = true;
    if (qrWrap) qrWrap.hidden = true;
    if (messageBox) {
      messageBox.hidden = false;
      messageBox.className = "message-box error-box";
      messageBox.textContent = "Registration Closed — this event is still available to view, but new registrations are not being accepted.";
    }
    return;
  }
  renderTeamMembers();

  form.querySelectorAll('input[name="participationType"]').forEach((radio) => {
    radio.addEventListener("change", renderTeamMembers);
  });

  form.querySelectorAll("input, select").forEach((field) => {
    const fieldName = field.name;
    if (!fieldName) return;

    field.addEventListener("blur", () => {
      if (field.type === "checkbox") {
        validateField(fieldName, field.checked);
        return;
      }
      validateField(fieldName, field.value);
    });

    field.addEventListener("input", () => {
      if (field.type === "checkbox") {
        clearError(fieldName);
        return;
      }
      if (fieldName === "mobile") {
        field.value = field.value.replace(/\D/g, "").slice(0, 10);
      }
      clearError(fieldName);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!registrationOpen) {
      if (messageBox) {
        messageBox.hidden = false;
        messageBox.className = "message-box error-box";
        messageBox.textContent = "Registration for this event is closed.";
      }
      return;
    }

    // Prevent multiple submissions
    const submitButton = form.querySelector('button[type="submit"]');

    if (form.dataset.submitting === "true") {
      return;
    }

    form.dataset.submitting = "true";

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    const fieldsToValidate = [
      "fullName",
      "registerNumber",
      "collegeName",
      "department",
      "year",
      "email",
      "mobile",
      "terms"
    ];

    let isValid = true;

    fieldsToValidate.forEach((fieldName) => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      const value = field ? (field.type === "checkbox" ? field.checked : field.value.trim()) : "";
      if (!validateField(fieldName, value)) {
        isValid = false;
      }
    });

    const teamValidity = validateTeamMembers();
    if (!teamValidity) isValid = false;

    if (!isValid) {
  form.dataset.submitting = "false";

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "Submit Registration";
  }

  if (messageBox) {
    messageBox.hidden = false;
    messageBox.textContent = "Please correct the highlighted fields before submitting your registration.";
    messageBox.className = "message-box error-box";
  }

  return;
}

    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    values.eventId = selectedEvent?.id || eventId;
    values.eventName = selectedEvent?.title || eventNameInput?.value || "Selected Event";
    const now = new Date().toISOString();
    const stamp = now.slice(0, 10).replace(/-/g, "");
    values.referenceId = `REG-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    values.registrationDateTime = now;

    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    } catch (error) {
      form.dataset.submitting = "false";
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Registration";
      }
      if (messageBox) {
        messageBox.hidden = false;
        messageBox.className = "message-box error-box";
        messageBox.textContent = `Registration could not be saved. Start the local server and try again. ${error.message}`;
      }
      return;
    }

    window.localStorage.setItem("excelEventRegistration", JSON.stringify(values));
    window.localStorage.removeItem("excelEventPayment");

    if (messageBox) {
      messageBox.hidden = false;
      messageBox.className = "message-box success-box";
      messageBox.textContent = `Registration submitted successfully for ${values.eventName}. Redirecting to payment...`;
    }

    form.reset();
    if (eventNameInput) eventNameInput.value = selectedEvent?.title || "";
    const defaultType = form.querySelector('input[name="participationType"][value="Individual"]');
    if (defaultType) defaultType.checked = true;
    renderTeamMembers();

    window.setTimeout(() => {
      window.location.href = `payment.html?event=${encodeURIComponent(values.eventId)}`;
    }, 300);
  });
});

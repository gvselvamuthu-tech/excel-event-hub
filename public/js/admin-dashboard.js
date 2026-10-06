document.addEventListener('DOMContentLoaded', function () {
  // Basic auth guard
  try {
    if (sessionStorage.getItem('excel_admin_logged_in') !== '1') {
      window.location.href = 'admin-login.html';
      return;
    }
  } catch (e) {
    window.location.href = 'admin-login.html';
    return;
  }

  const apiUrl = (path) => `/api/${path}`;
  const logoutBtn = document.getElementById('admin-logout');
  const refreshBtn = document.getElementById('refresh-data');
  const refreshWorkbookBtn = document.getElementById('refresh-workbook-data');
  const exportBtn = document.getElementById('export-data');

  let eventsData = { technical: [], nonTechnical: [] };

  const eventsTableBody = document.querySelector('#events-table tbody');
  const registrationsTableBody = document.querySelector('#registrations-table tbody');
  const paymentsTableBody = document.querySelector('#payments-table tbody');
  const statEvents = document.getElementById('stat-events');
  const statRegistrations = document.getElementById('stat-registrations');
  const statPayments = document.getElementById('stat-payments');
  const statToday = document.getElementById('stat-today');
  const regSearch = document.getElementById('reg-search');
  const regFilter = document.getElementById('reg-filter-event');
  const regFilterPayment = document.getElementById('reg-filter-payment');
  const recentRegistrationsList = document.getElementById('recent-registrations-list');
  const dashboardError = document.getElementById('admin-dashboard-error');
  const eventModal = document.getElementById('event-modal');
  const eventForm = document.getElementById('event-form');
  const modalTitle = document.getElementById('modal-title');
  const toastEl = document.getElementById('admin-toast');

  const dashboardState = { registrations: [], payments: [], loading: false, previousScrollY: 0 };

  const suppressBackgroundScroll = (event) => {
    if (!eventModal || eventModal.style.display === 'none') return;
    const target = event.target;
    const modalContent = eventModal.querySelector('.event-modal__content');
    if (target && typeof target.closest === 'function' && target.closest('.event-modal__content')) {
      const content = target.closest('.event-modal__content');
      const atTop = content.scrollTop <= 0 && event.deltaY < 0;
      const atBottom = content.scrollTop + content.clientHeight >= content.scrollHeight && event.deltaY > 0;
      if (atTop || atBottom) {
        event.preventDefault();
      }
      return;
    }

    if (modalContent && event.type === 'touchmove') {
      event.preventDefault();
      return;
    }

    event.preventDefault();
  };

  const suppressBackgroundKeyboardScroll = (event) => {
    if (!eventModal || eventModal.style.display === 'none') return;
    if (event.target && typeof event.target.closest === 'function' && event.target.closest('.event-modal__content')) return;
    const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Space', ' ']);
    if (scrollKeys.has(event.key)) {
      event.preventDefault();
    }
    if (event.key === 'Escape') {
      setModalVisible(false);
    }
  };

  function lockPageScroll() {
    dashboardState.previousScrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${dashboardState.previousScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    document.addEventListener('wheel', suppressBackgroundScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', suppressBackgroundScroll, { passive: false, capture: true });
    document.addEventListener('keydown', suppressBackgroundKeyboardScroll, { capture: true });
  }

  function unlockPageScroll() {
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    document.documentElement.style.scrollBehavior = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.removeEventListener('wheel', suppressBackgroundScroll, { capture: true });
    document.removeEventListener('touchmove', suppressBackgroundScroll, { capture: true });
    document.removeEventListener('keydown', suppressBackgroundKeyboardScroll, { capture: true });
    window.scrollTo({ top: dashboardState.previousScrollY, behavior: 'auto' });
  }

  function setModalVisible(isVisible) {
    eventModal.style.display = isVisible ? 'flex' : 'none';
    eventModal.setAttribute('aria-hidden', String(!isVisible));
    if (isVisible) {
      lockPageScroll();
      setTimeout(() => {
        const firstInput = eventModal.querySelector('input, select, textarea, button');
        if (firstInput) firstInput.focus();
      }, 0);
    } else {
      unlockPageScroll();
    }
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  }

  function showToast(message, timeout = 3000) {
    try {
      if (!toastEl) return;
      toastEl.textContent = message || '';
      toastEl.classList.add('show');
      clearTimeout(window.__admin_toast_timeout);
      window.__admin_toast_timeout = setTimeout(() => {
        toastEl.classList.remove('show');
      }, timeout);
    } catch (e) { console.warn(e); }
  }

  function setDashboardError(message) {
    if (!dashboardError) return;
    if (!message) {
      dashboardError.textContent = '';
      dashboardError.style.display = 'none';
      return;
    }
    dashboardError.textContent = message;
    dashboardError.style.display = 'block';
  }

  function normalizeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = normalizeDate(value);
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function normalizePaymentStatus(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return 'pending';
    if (['submitted', 'paid', 'success', 'successful', 'completed', 'complete'].includes(value)) return 'submitted';
    if (['pending', 'in-progress', 'in progress', 'awaiting'].includes(value)) return 'pending';
    return value;
  }

  function registrationRows() {
    return dashboardState.registrations.map((registration) => {
      const payment = dashboardState.payments.find((row) => String(row.referenceId) === String(registration.referenceId));
      return {
        ...registration,
        participantName: registration.participantName || registration.fullName || '',
        phone: registration.phone || registration.mobile || '',
        amount: payment?.amount || registration.amount || '',
        paymentTransactionId: payment?.paymentTransactionId || payment?.utrNumber || '',
        paymentStatus: payment?.paymentStatus || registration.paymentStatus || '',
        registrationDate: registration.registrationDate || registration.registrationDateTime || registration.createdAt || ''
      };
    });
  }

  function getUniqueEventNames() {
    const names = new Set();
    [...eventsData.technical, ...eventsData.nonTechnical].forEach((event) => names.add(event.title));
    registrationRows().forEach((row) => {
      if (row.eventName) names.add(row.eventName);
    });
    return Array.from(names).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  function populateRegFilter() {
    const options = ['all', ...getUniqueEventNames()];
    regFilter.innerHTML = options.map((name) => {
      const value = name === 'all' ? 'all' : name;
      const label = name === 'all' ? 'All events' : name;
      return `<option value="${value}">${label}</option>`;
    }).join('');

    if (regFilter.value && regFilter.querySelector(`option[value="${regFilter.value}"]`)) {
      regFilter.value = regFilter.value;
    }
  }

  function renderOverview() {
    const totalEvents = eventsData.technical.length + eventsData.nonTechnical.length;
    const rows = registrationRows();

    statEvents.textContent = totalEvents;
    statRegistrations.textContent = rows.length;
    statPayments.textContent = dashboardState.payments.length;

    const todayCount = rows.filter((row) => {
      const date = normalizeDate(row.registrationDate || row.registrationDateTime);
      if (!date) return false;
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }).length;

    statToday.textContent = todayCount;
  }

  function renderRecentRegistrations() {
    if (!recentRegistrationsList) return;

    const sorted = registrationRows().slice().sort((a, b) => {
      const dateA = normalizeDate(a.registrationDate || a.registrationDateTime) || new Date(0);
      const dateB = normalizeDate(b.registrationDate || b.registrationDateTime) || new Date(0);
      return dateB.getTime() - dateA.getTime();
    }).slice(0, 5);

    if (!sorted.length) {
      recentRegistrationsList.innerHTML = '<li class="small">No recent registrations yet.</li>';
      return;
    }

    recentRegistrationsList.innerHTML = sorted.map((row) => `
      <li style="padding:0.7rem 0.8rem; border:1px solid var(--border); border-radius:12px; background: rgba(11,31,58,0.02);">
        <div style="font-weight:700; margin-bottom:0.2rem;">${row.participantName || 'Participant'}</div>
        <div class="small">${row.eventName || 'Event'} • ${formatDate(row.registrationDate || row.registrationDateTime)}</div>
      </li>
    `).join('');
  }

  function renderRegistrationTable() {
    const tbody = registrationsTableBody;
    if (!tbody) return;

    const searchValue = (regSearch && regSearch.value || '').trim().toLowerCase();
    const eventValue = (regFilter && regFilter.value) || 'all';
    const paymentValue = (regFilterPayment && regFilterPayment.value) || 'all';

    const filteredRows = registrationRows().filter((row) => {
      const matchesSearch = !searchValue || [
        row.referenceId,
        row.eventName,
        row.participantName,
        row.email,
        row.phone,
        row.department,
        row.paymentTransactionId
      ].some((value) => String(value || '').toLowerCase().includes(searchValue));

      const matchesEvent = eventValue === 'all' || String(row.eventName || '').toLowerCase() === String(eventValue).toLowerCase();
      const matchesPayment = paymentValue === 'all' || normalizePaymentStatus(row.paymentStatus) === paymentValue;
      return matchesSearch && matchesEvent && matchesPayment;
    });

    if (dashboardState.loading) {
      tbody.innerHTML = '<tr><td colspan="10" class="small" style="padding:1rem; text-align:center;">Loading registrations…</td></tr>';
      return;
    }

    if (!filteredRows.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="padding:1.5rem 0.5rem; text-align:center; color:var(--text-soft);">No registrations match the current filters.</td></tr>';
      return;
    }

    tbody.innerHTML = filteredRows.map((row) => `
      <tr>
        <td>${row.referenceId || '—'}</td>
        <td>${row.eventName || '—'}</td>
        <td>${row.participantName || '—'}</td>
        <td>${row.email || '—'}</td>
        <td>${row.phone || '—'}</td>
        <td>${row.department || '—'}</td>
        <td>${row.year || '—'}</td>
        <td>${typeof row.amount === 'number' ? `₹${row.amount}` : row.amount || '—'}</td>
        <td>${row.paymentTransactionId || '—'}</td>
        <td>${formatDate(row.registrationDate || row.registrationDateTime)}</td>
      </tr>
    `).join('');
  }

  function populateEventsTable() {
    const rows = [];
    eventsData.technical.forEach((event) => rows.push({ ...event, category: 'Technical' }));
    eventsData.nonTechnical.forEach((event) => rows.push({ ...event, category: 'Non-Technical' }));

    eventsTableBody.innerHTML = rows.map((item) => `
      <tr data-id="${item.id}"><td>${item.title}</td><td>${item.category}</td><td>₹${item.registrationFee ?? 0}</td>
      <td><button class="btn btn--secondary edit-event">Edit</button> <button class="btn btn--ghost delete-event">Delete</button></td></tr>
    `).join('');

    document.querySelectorAll('.edit-event').forEach((btn) => btn.addEventListener('click', (e) => {
      const id = e.target.closest('tr').dataset.id;
      openEditEvent(id);
    }));

    document.querySelectorAll('.delete-event').forEach((btn) => btn.addEventListener('click', (e) => {
      const id = e.target.closest('tr').dataset.id;
      deleteEvent(id);
    }));
  }

  function populatePaymentsTable() {
    const pays = dashboardState.payments.slice();
    paymentsTableBody.innerHTML = pays.map((p) => `
      <tr><td>${p.referenceId || '—'}</td><td>${p.participantName || p.fullName || '—'}</td><td>${p.eventName || '—'}</td><td>${p.amount || '—'}</td><td>${p.paymentTransactionId || p.utrNumber || '—'}</td><td>${p.paymentStatus || '—'}</td></tr>
    `).join('');

    if (!pays.length) {
      paymentsTableBody.innerHTML = '<tr><td colspan="6" style="padding:1.5rem 0.5rem; text-align:center; color:var(--text-soft);">No payment records.</td></tr>';
    }
  }

  function refreshAll() {
    renderOverview();
    populateEventsTable();
    populateRegFilter();
    renderRegistrationTable();
    renderRecentRegistrations();
    populatePaymentsTable();
  }

  async function loadWorkbookData() {
    dashboardState.loading = true;
    renderRegistrationTable();
    setDashboardError('');

    try {
      const [events, registrations, payments] = await Promise.all([
        apiRequest('events'),
        apiRequest('registrations'),
        apiRequest('payments')
      ]);
      eventsData = events;
      dashboardState.registrations = registrations;
      dashboardState.payments = payments;
      refreshAll();
      setDashboardError('');
      showToast('Excel data refreshed.');
    } catch (error) {
      dashboardState.registrations = [];
      dashboardState.payments = [];
      renderOverview();
      renderRegistrationTable();
      renderRecentRegistrations();
      populatePaymentsTable();
      setDashboardError(`Excel data could not be loaded. Start the local server and refresh. ${error.message || ''}`);
    } finally {
      dashboardState.loading = false;
      renderRegistrationTable();
    }
  }

  // Event CRUD is persisted by the local workbook API.
  function openAddEvent() {
    modalTitle.textContent = 'Add Event';
    eventForm.reset();
    eventForm.elements.namedItem('id').readOnly = false;
    eventForm.dataset.mode = 'add';
    setModalVisible(true);
  }

  function parseLines(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return String(value)
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function isScannerEnabledForEvent(event) {
    if (event.scannerEnabled !== undefined && event.scannerEnabled !== null && String(event.scannerEnabled).trim() !== '') {
      return ['true', '1', 'yes'].includes(String(event.scannerEnabled).trim().toLowerCase());
    }
    return /\bseminar\b/i.test(`${event.id || ''} ${event.title || ''}`);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('The selected QR image could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadEventQr(file, eventId) {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await apiRequest(`event-qr/${encodeURIComponent(eventId)}`, {
      method: 'POST',
      body: JSON.stringify({ dataUrl })
    });
    return result.qrCode;
  }

  function openEditEvent(id) {
    const all = eventsData.technical.concat(eventsData.nonTechnical);
    const item = all.find((x) => x.id === id);
    if (!item) return alert('Event not found');
    modalTitle.textContent = 'Edit Event';
    eventForm.dataset.mode = 'edit';
    eventForm.dataset.editId = id;
    eventForm.elements.namedItem('id').readOnly = true;
    setModalVisible(true);
    const formFields = eventForm.elements;
    formFields.namedItem('title').value = item.title || '';
    formFields.namedItem('id').value = item.id || '';
    formFields.namedItem('category').value = item.category || 'Technical';
    formFields.namedItem('status').value = String(item.status || 'Open').trim().toLowerCase() === 'closed' ? 'Closed' : 'Open';
    formFields.namedItem('scannerEnabled').checked = isScannerEnabledForEvent(item);
    formFields.namedItem('qrCode').value = item.qrCode || '';
    formFields.namedItem('qrImageUpload').value = '';
    formFields.namedItem('date').value = item.date || '';
    formFields.namedItem('time').value = item.time || '';
    formFields.namedItem('venue').value = item.venue || '';
    formFields.namedItem('registrationFee').value = item.registrationFee ?? 0;
    formFields.namedItem('registrationDeadline').value = item.registrationDeadline || '';
    formFields.namedItem('image').value = item.image || '';
    formFields.namedItem('teamSize').value = item.teamSize || '';
    formFields.namedItem('maxParticipants').value = item.maxParticipants || '';
    formFields.namedItem('shortDescription').value = item.shortDescription || '';
    formFields.namedItem('description').value = item.description || '';
    formFields.namedItem('fullDescription').value = item.fullDescription || '';
    formFields.namedItem('organizer').value = item.organizer || '';
    formFields.namedItem('rules').value = parseLines(item.rules).join('\n');
    formFields.namedItem('prizes').value = parseLines(item.prizes).join('\n');
  }

  async function saveEvents(nextEvents, successMessage) {
    try {
      eventsData = await apiRequest('events', {
        method: 'PUT',
        body: JSON.stringify(nextEvents)
      });
      refreshAll();
      showToast(successMessage);
      return true;
    } catch (error) {
      setDashboardError(`Event changes could not be saved. ${error.message}`);
      return false;
    }
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    const all = eventsData.technical.concat(eventsData.nonTechnical).filter((event) => event.id !== id);
    await saveEvents({
      technical: all.filter((event) => String(event.category).toLowerCase() === 'technical'),
      nonTechnical: all.filter((event) => String(event.category).toLowerCase() === 'non-technical')
    }, 'Event deleted');
  }

  eventForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const feeField = eventForm.elements.namedItem('registrationFee');
    const registrationFee = feeField.valueAsNumber;
    if (!feeField.value.trim() || !Number.isFinite(registrationFee) || registrationFee < 0) {
      return alert('Registration Fee must be a non-negative number.');
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(feeField.value.trim())) {
      return alert('Registration Fee can have at most two decimal places.');
    }
    const values = {
      id: (eventForm.elements.namedItem('id').value || '').trim(),
      title: (eventForm.elements.namedItem('title').value || '').trim(),
      category: (eventForm.elements.namedItem('category').value || 'Technical').trim(),
      status: (eventForm.elements.namedItem('status').value || 'Open').trim(),
      scannerEnabled: eventForm.elements.namedItem('scannerEnabled').checked,
      date: (eventForm.elements.namedItem('date').value || '').trim(),
      time: (eventForm.elements.namedItem('time').value || '').trim(),
      venue: (eventForm.elements.namedItem('venue').value || '').trim(),
      registrationFee,
      registrationDeadline: (eventForm.elements.namedItem('registrationDeadline').value || '').trim(),
      image: (eventForm.elements.namedItem('image').value || '').trim(),
      qrCode: (eventForm.elements.namedItem('qrCode').value || '').trim(),
      teamSize: (eventForm.elements.namedItem('teamSize').value || '').trim(),
      maxParticipants: (eventForm.elements.namedItem('maxParticipants').value || '').trim(),
      shortDescription: (eventForm.elements.namedItem('shortDescription').value || '').trim(),
      description: (eventForm.elements.namedItem('description').value || '').trim(),
      fullDescription: (eventForm.elements.namedItem('fullDescription').value || '').trim(),
      organizer: (eventForm.elements.namedItem('organizer').value || '').trim(),
      rules: parseLines(eventForm.elements.namedItem('rules').value),
      prizes: parseLines(eventForm.elements.namedItem('prizes').value)
    };
    if (!values.id || !values.title) return alert('Please provide id and title');

    const all = eventsData.technical.concat(eventsData.nonTechnical);
    const editingId = eventForm.dataset.mode === 'edit' ? eventForm.dataset.editId : null;
    const existing = all.find((event) => event.id === editingId) || {};
    if (all.some((event) => event.id === values.id && event.id !== editingId)) {
      return alert('An event with this id already exists.');
    }
    const qrFile = eventForm.elements.namedItem('qrImageUpload').files[0];
    if (qrFile) {
      try {
        values.qrCode = await uploadEventQr(qrFile, values.id);
      } catch (error) {
        setDashboardError(`Event QR code could not be uploaded. ${error.message}`);
        return;
      }
    }
    const updatedEvent = {
      ...existing,
      ...values,
      id: values.id,
      title: values.title,
      category: values.category,
      status: values.status,
      registrationFee: values.registrationFee,
      image: values.image || existing.image || 'assets/images/event-placeholder.svg'
    };
    const filtered = all.filter((event) => event.id !== editingId);
    const nextEvents = {
      technical: filtered.filter((event) => String(event.category).toLowerCase() === 'technical').concat(updatedEvent.category === 'Technical' ? [updatedEvent] : []),
      nonTechnical: filtered.filter((event) => String(event.category).toLowerCase() === 'non-technical').concat(updatedEvent.category === 'Non-Technical' ? [updatedEvent] : [])
    };
    const saved = await saveEvents(nextEvents, 'Saved successfully');
    if (saved) {
      setModalVisible(false);
      eventForm.reset();
      delete eventForm.dataset.mode;
      delete eventForm.dataset.editId;
    }
  });

  document.getElementById('add-event-btn').addEventListener('click', openAddEvent);
  document.getElementById('cancel-modal').addEventListener('click', () => { setModalVisible(false); });

  eventModal.addEventListener('click', (event) => {
    if (event.target === eventModal) {
      setModalVisible(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && eventModal && eventModal.style.display !== 'none') {
      setModalVisible(false);
    }
  });

  eventModal.addEventListener('wheel', (event) => {
    const dialog = eventModal.querySelector('.event-modal__content');
    const atTop = dialog.scrollTop <= 0 && event.deltaY < 0;
    const atBottom = dialog.scrollTop + dialog.clientHeight >= dialog.scrollHeight && event.deltaY > 0;
    if (atTop || atBottom) {
      event.preventDefault();
    }
  }, { passive: false });

  eventModal.addEventListener('touchmove', (event) => {
    const dialog = eventModal.querySelector('.event-modal__content');
    const atTop = dialog.scrollTop <= 0 && event.touches[0].clientY < 0;
    const atBottom = dialog.scrollTop + dialog.clientHeight >= dialog.scrollHeight && event.touches[0].clientY > 0;
    if (atTop || atBottom) {
      event.preventDefault();
    }
  }, { passive: false });

  regSearch.addEventListener('input', () => renderRegistrationTable());
  regFilter.addEventListener('change', () => renderRegistrationTable());
  regFilterPayment.addEventListener('change', () => renderRegistrationTable());

  refreshBtn.addEventListener('click', loadWorkbookData);
  refreshWorkbookBtn.addEventListener('click', loadWorkbookData);

  exportBtn.addEventListener('click', function () {
    const payload = {
      events: eventsData,
      registration: (function () { try { return JSON.parse(localStorage.getItem('excelEventRegistration') || 'null'); } catch (e) { return null; } })(),
      payment: (function () { try { return JSON.parse(localStorage.getItem('excelEventPayment') || 'null'); } catch (e) { return null; } })(),
      registrations: dashboardState.registrations,
      payments: dashboardState.payments
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'excel-admin-data.json'; a.click(); URL.revokeObjectURL(url);
  });

  function doLogout() {
    try { sessionStorage.removeItem('excel_admin_logged_in'); sessionStorage.removeItem('excel_admin_identity'); localStorage.removeItem('excel_admin_events'); } catch (e) {}
    window.location.href = 'admin-login.html';
  }

  logoutBtn.addEventListener('click', doLogout);

  // initial render
  refreshAll();
  loadWorkbookData();
});

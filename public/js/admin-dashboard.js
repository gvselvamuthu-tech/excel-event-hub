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
  const downloadRegistrationsBtn = document.getElementById('downloadRegistrationsBtn');
  const downloadPaymentsBtn = document.getElementById('downloadPaymentsBtn');
  const clearRecordsBtn = document.getElementById('clear-records-btn') || document.getElementById('clear-payments-btn');
  const clearPaymentsBtn = document.getElementById('clear-payments-btn');
  const clearRecordsDialog = document.getElementById('clear-records-dialog');
  const clearRecordsForm = document.getElementById('clear-records-form');
  const clearRecordsError = document.getElementById('clear-records-error');
  const clearRecordsDescription = document.getElementById('clear-records-description');
  const cancelClearRecordsBtn = document.getElementById('cancel-clear-records');
  const verifyClearRecordsBtn = document.getElementById('verify-clear-records');
  const exportBtn = document.getElementById('export-data');

  let eventsData = { technical: [], nonTechnical: [] };
  let datasetToClear = '';

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

  function isAnyModalOpen() {
    const isEventOpen = eventModal && eventModal.style.display !== 'none';
    const settingsModal = document.getElementById('admin-settings-modal');
    const isSettingsOpen = settingsModal && settingsModal.style.display !== 'none';
    return isEventOpen || isSettingsOpen;
  }

  const suppressBackgroundScroll = (event) => {
    if (!isAnyModalOpen()) return;
    const target = event.target;
    const isInsideEvent = target && typeof target.closest === 'function' && target.closest('.event-modal__content');
    const isInsideSettings = target && typeof target.closest === 'function' && target.closest('.settings-body, .settings-menu, .settings-table-container');

    if (isInsideEvent) {
      const content = target.closest('.event-modal__content');
      const atTop = content.scrollTop <= 0 && event.deltaY < 0;
      const atBottom = content.scrollTop + content.clientHeight >= content.scrollHeight && event.deltaY > 0;
      if (atTop || atBottom) event.preventDefault();
      return;
    }

    if (isInsideSettings) {
      const scrollable = target.closest('.settings-body, .settings-menu, .settings-table-container');
      const atTop = scrollable.scrollTop <= 0 && event.deltaY < 0;
      const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight && event.deltaY > 0;
      if (atTop || atBottom) event.preventDefault();
      return;
    }

    event.preventDefault();
  };

  const suppressBackgroundKeyboardScroll = (event) => {
    if (!isAnyModalOpen()) return;
    const isInsideEvent = event.target && typeof event.target.closest === 'function' && event.target.closest('.event-modal__content');
    const isInsideSettings = event.target && typeof event.target.closest === 'function' && event.target.closest('.settings-modal-card');
    if (isInsideEvent || isInsideSettings) {
      if (event.key === 'Escape') {
        if (eventModal && eventModal.style.display !== 'none') setModalVisible(false);
        const settingsModal = document.getElementById('admin-settings-modal');
        if (settingsModal && settingsModal.style.display !== 'none') closeAdminSettingsModal();
      }
      return;
    }

    const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Space', ' ']);
    if (scrollKeys.has(event.key)) {
      event.preventDefault();
    }
    if (event.key === 'Escape') {
      if (eventModal && eventModal.style.display !== 'none') setModalVisible(false);
      const settingsModal = document.getElementById('admin-settings-modal');
      if (settingsModal && settingsModal.style.display !== 'none') closeAdminSettingsModal();
    }
  };

  function lockPageScroll() {
    if (document.body.classList.contains('modal-open')) return;
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
    if (isAnyModalOpen()) return;
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

  async function downloadWorkbook(path, filename, label) {
    setDashboardError('');
    try {
      const response = await fetch(apiUrl(path));
      if (!response.ok) {
        let result = {};
        try {
          result = await response.json();
        } catch (error) {
          result = {};
        }
        throw new Error(result.error || `Request failed (${response.status}).`);
      }
      const workbook = await response.blob();
      const downloadUrl = URL.createObjectURL(workbook);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
      setDashboardError(`${label} could not be downloaded. ${error.message || 'Please try again.'}`);
    }
  }

  const downloadRegistrations = () => downloadWorkbook('registrations/download', 'registrations.xlsx', 'Registrations');
  const downloadPayments = () => downloadWorkbook('payments/download', 'payments.xlsx', 'Payments');

  function openClearRecordsDialog(dataset) {
    datasetToClear = dataset;
    clearRecordsForm.reset();
    clearRecordsError.hidden = true;
    clearRecordsError.classList.remove('is-visible');
    clearRecordsError.textContent = '';
    clearRecordsDescription.textContent = 'Enter your admin credentials to continue.';
    clearRecordsDialog.showModal();
    clearRecordsForm.elements.namedItem('username').focus();
  }

  function closeClearRecordsDialog() {
    clearRecordsDialog.close();
    clearRecordsForm.reset();
    clearRecordsError.hidden = true;
    clearRecordsError.classList.remove('is-visible');
    clearRecordsError.textContent = '';
    datasetToClear = '';
  }

  async function sendClearRecordsRequest(path, payload) {
    const response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  }

  if (clearRecordsBtn) {
    clearRecordsBtn.addEventListener('click', () => openClearRecordsDialog('all-registration-payments'));
  } else if (clearPaymentsBtn) {
    clearPaymentsBtn.addEventListener('click', () => openClearRecordsDialog('payments'));
  }
  if (cancelClearRecordsBtn) {
    cancelClearRecordsBtn.addEventListener('click', closeClearRecordsDialog);
  }
  if (clearRecordsDialog) {
    clearRecordsDialog.addEventListener('click', (event) => {
      if (event.target === clearRecordsDialog) closeClearRecordsDialog();
    });
    clearRecordsDialog.addEventListener('close', () => {
      clearRecordsForm.reset();
      clearRecordsError.hidden = true;
      clearRecordsError.classList.remove('is-visible');
      clearRecordsError.textContent = '';
      datasetToClear = '';
    });
  }
  clearRecordsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearRecordsError.hidden = true;
    clearRecordsError.classList.remove('is-visible');
    verifyClearRecordsBtn.disabled = true;
    const credentials = {
      username: clearRecordsForm.elements.namedItem('username').value.trim(),
      password: clearRecordsForm.elements.namedItem('password').value
    };
    const dataset = datasetToClear;

    try {
      const result = await window.verifyAndClearAdminRecords(
        dataset,
        credentials,
        (message) => window.confirm(message),
        sendClearRecordsRequest
      );
      if (result.cancelled) {
        closeClearRecordsDialog();
        return;
      }

      closeClearRecordsDialog();
      await loadWorkbookData();
      showToast(result.message || 'All payment records cleared successfully.', 7000);
    } catch (error) {
      clearRecordsError.textContent = error.message === 'Invalid admin credentials'
        ? error.message
        : error.message || 'Payment records could not be cleared.';
      clearRecordsError.hidden = false;
      clearRecordsError.classList.add('is-visible');
      clearRecordsForm.elements.namedItem('password').value = '';
      clearRecordsForm.elements.namedItem('password').focus();
    } finally {
      verifyClearRecordsBtn.disabled = false;
    }
  });

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
      const amountVal = (payment && payment.amount !== undefined && payment.amount !== null && payment.amount !== '')
        ? payment.amount
        : (registration.amount !== undefined && registration.amount !== null ? registration.amount : '');
      const txnVal = payment?.paymentTransactionId || payment?.utrNumber || registration.paymentTransactionId || '';
      const statusVal = payment?.paymentStatus || registration.paymentStatus || 'Pending';
      const regType = registration.registrationType || registration.participationType || 'Online';

      return {
        ...registration,
        participantName: registration.participantName || registration.fullName || '',
        phone: registration.phone || registration.mobile || '',
        registrationType: regType,
        amount: amountVal,
        paymentTransactionId: txnVal,
        paymentStatus: statusVal,
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
        row.registrationType,
        row.paymentTransactionId,
        row.paymentStatus
      ].some((value) => String(value || '').toLowerCase().includes(searchValue));

      const matchesEvent = eventValue === 'all' || String(row.eventName || '').toLowerCase() === String(eventValue).toLowerCase();
      const matchesPayment = paymentValue === 'all' || normalizePaymentStatus(row.paymentStatus) === paymentValue;
      return matchesSearch && matchesEvent && matchesPayment;
    });

    if (dashboardState.loading) {
      tbody.innerHTML = '<tr><td colspan="12" class="small" style="padding:1rem; text-align:center;">Loading registrations…</td></tr>';
      return;
    }

    if (!filteredRows.length) {
      tbody.innerHTML = '<tr><td colspan="12" style="padding:1.5rem 0.5rem; text-align:center; color:var(--text-soft);">No registrations match the current filters.</td></tr>';
      return;
    }

    tbody.innerHTML = filteredRows.map((row) => {
      const formattedAmount = (row.amount !== '' && row.amount !== null && row.amount !== undefined)
        ? (typeof row.amount === 'number' ? `₹${row.amount}` : (String(row.amount).startsWith('₹') ? row.amount : `₹${row.amount}`))
        : '—';
      const statusBadgeClass = normalizePaymentStatus(row.paymentStatus) === 'submitted'
        ? 'badge badge-success'
        : normalizePaymentStatus(row.paymentStatus) === 'pending'
          ? 'badge badge-warning'
          : 'badge badge-info';

      return `
        <tr>
          <td><strong class="mono">${row.referenceId || '—'}</strong></td>
          <td>${row.participantName || '—'}</td>
          <td>${row.email || '—'}</td>
          <td>${row.phone || '—'}</td>
          <td>${row.department || '—'}</td>
          <td>${row.year || '—'}</td>
          <td>${row.eventName || '—'}</td>
          <td><span class="badge badge-info">${row.registrationType || 'Online'}</span></td>
          <td>${formatDate(row.registrationDate || row.registrationDateTime)}</td>
          <td>${formattedAmount}</td>
          <td><span class="mono">${row.paymentTransactionId || '—'}</span></td>
          <td><span class="${statusBadgeClass}">${row.paymentStatus || 'Pending'}</span></td>
        </tr>
      `;
    }).join('');
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
    if (!paymentsTableBody) return;
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
    formFields.namedItem('date').value = item.date || '';
    formFields.namedItem('time').value = item.time || '';
    formFields.namedItem('venue').value = item.venue || '';
    formFields.namedItem('registrationFee').value = item.registrationFee ?? 0;
    formFields.namedItem('registrationDeadline').value = item.registrationDeadline || '';
    formFields.namedItem('image').value = item.image || '';
    if (formFields.namedItem('assignedQrId')) {
      formFields.namedItem('assignedQrId').value = item.assignedQrId || '';
    }
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
      populateSettingsEvents();
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
      assignedQrId: (eventForm.elements.namedItem('assignedQrId')?.value || '').trim(),
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
    const updatedEvent = {
      ...existing,
      ...values,
      id: values.id,
      title: values.title,
      category: values.category,
      status: values.status,
      registrationFee: values.registrationFee,
      assignedQrId: values.assignedQrId || undefined,
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

  const addEventBtn = document.getElementById('add-event-btn');
  if (addEventBtn) addEventBtn.addEventListener('click', openAddEvent);
  const cancelModalBtn = document.getElementById('cancel-modal');
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => { setModalVisible(false); });

  if (eventModal) {
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
      if (!dialog) return;
      const atTop = dialog.scrollTop <= 0 && event.deltaY < 0;
      const atBottom = dialog.scrollTop + dialog.clientHeight >= dialog.scrollHeight && event.deltaY > 0;
      if (atTop || atBottom) {
        event.preventDefault();
      }
    }, { passive: false });

    eventModal.addEventListener('touchmove', (event) => {
      const dialog = eventModal.querySelector('.event-modal__content');
      if (!dialog) return;
      const atTop = dialog.scrollTop <= 0 && event.touches[0].clientY < 0;
      const atBottom = dialog.scrollTop + dialog.clientHeight >= dialog.scrollHeight && event.touches[0].clientY > 0;
      if (atTop || atBottom) {
        event.preventDefault();
      }
    }, { passive: false });
  }

  if (regSearch) regSearch.addEventListener('input', () => renderRegistrationTable());
  if (regFilter) regFilter.addEventListener('change', () => renderRegistrationTable());
  if (regFilterPayment) regFilterPayment.addEventListener('change', () => renderRegistrationTable());

  if (refreshBtn) refreshBtn.addEventListener('click', loadWorkbookData);
  if (refreshWorkbookBtn) refreshWorkbookBtn.addEventListener('click', loadWorkbookData);
  if (downloadRegistrationsBtn) downloadRegistrationsBtn.addEventListener('click', downloadRegistrations);
  if (downloadPaymentsBtn) downloadPaymentsBtn.addEventListener('click', downloadPayments);

  if (exportBtn) {
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
  }

  function doLogout() {
    if (!confirm('Are you sure you want to log out of the admin session?')) return;
    try {
      sessionStorage.removeItem('excel_admin_logged_in');
      sessionStorage.removeItem('excel_admin_identity');
      localStorage.removeItem('excel_admin_events');
    } catch (e) {}
    window.location.href = 'admin-login.html';
  }

  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
  // ==========================================
  // ADMIN SETTINGS MODAL INTERACTION LOGIC
  // ==========================================
  const settingsModalEl = document.getElementById('admin-settings-modal');
  const settingsBackdropEl = document.getElementById('settings-backdrop');
  const settingsCardEl = document.getElementById('settings-card');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const openSettingsNavBtn = document.getElementById('open-settings-nav-btn');
  const openSettingsPanelBtn = document.getElementById('open-settings-panel-btn');
  const dashboardSidebarSettingsBtn = document.getElementById('dashboard-sidebar-settings-btn');
  const dashNavUsersBtn = document.getElementById('dash-nav-users');
  const dashSidebarAdminName = document.getElementById('dash-sidebar-admin-name');
  const dashSidebarAvatar = document.getElementById('dash-sidebar-avatar');

  const settingsNavItems = document.querySelectorAll('.settings-nav-item[data-section]');
  const settingsLogoutNavBtn = document.getElementById('tab-logout');
  const settingsPanelTitle = document.getElementById('settings-panel-title');
  const settingsPanelDesc = document.getElementById('settings-panel-desc');

  // Profile
  const profileForm = document.getElementById('profile-settings-form');
  const profileDisplayName = document.getElementById('profile-display-name');
  const profileUsername = document.getElementById('profile-username');
  const profileEmail = document.getElementById('profile-email');
  const profilePhone = document.getElementById('profile-phone');
  const profileDepartment = document.getElementById('profile-department');
  const resetProfileBtn = document.getElementById('reset-profile-btn');
  const profileAvatarPreview = document.getElementById('profile-avatar-preview');
  const profilePhotoInput = document.getElementById('profile-photo-input');
  const profileCardName = document.getElementById('profile-card-name');
  const profileCardSessionId = document.getElementById('profile-card-session-id');
  const sidebarAdminName = document.getElementById('settings-sidebar-admin-name');

  // Screen
  const screenWebsiteName = document.getElementById('screen-website-name');
  const screenLogoUpload = document.getElementById('screen-logo-upload');
  const screenLogoPreview = document.getElementById('screen-logo-preview');
  const resetLogoBtn = document.getElementById('reset-logo-btn');
  const screenPrimaryColor = document.getElementById('screen-primary-color');
  const screenPrimaryColorHex = document.getElementById('screen-primary-color-hex');
  const screenDensitySelect = document.getElementById('screen-density-select');
  const screenMouseTrailToggle = document.getElementById('screen-mouse-trail-toggle');
  const saveScreenSettingsBtn = document.getElementById('save-screen-settings-btn');

  // Users & Permissions
  const usersRoleFilter = document.getElementById('users-role-filter');
  const usersSearchInput = document.getElementById('users-search-input');
  const modalRefreshUsersBtn = document.getElementById('modal-refresh-users-btn');
  const settingsUsersTable = document.querySelector('#settings-users-table tbody');
  const permissionsMatrixTable = document.getElementById('permissions-matrix-table');
  const savePermissionsBtn = document.getElementById('save-permissions-btn');
  const resetPermissionsBtn = document.getElementById('reset-permissions-btn');

  // Events & QR
  const modalAddEventBtn = document.getElementById('modal-add-event-btn');
  const settingsEventsTable = document.querySelector('#settings-events-table tbody');
  const eventAssignedQrSelect = document.getElementById('event-assigned-qr');

  // Payment QR Manager
  const addNewQrBtn = document.getElementById('add-new-qr-btn');
  const qrEditFormWrap = document.getElementById('qr-edit-form-wrap');
  const paymentQrForm = document.getElementById('payment-qr-form');
  const qrFormTitle = document.getElementById('qr-form-title');
  const qrFormId = document.getElementById('qr-form-id');
  const qrFormName = document.getElementById('qr-form-name');
  const qrFormProvider = document.getElementById('qr-form-provider');
  const qrFormImage = document.getElementById('qr-form-image');
  const qrFormPreviewBox = document.getElementById('qr-form-preview-box');
  const qrFormPreviewImg = document.getElementById('qr-form-preview-img');
  const qrFormActive = document.getElementById('qr-form-active');
  const cancelQrFormBtn = document.getElementById('cancel-qr-form-btn');
  const savedQrsGrid = document.getElementById('saved-qrs-grid');
  const savedQrsCount = document.getElementById('saved-qrs-count');

  // Payment Gateway stats
  const settingsUpiId = document.getElementById('settings-upi-id');
  const settingsPayeeName = document.getElementById('settings-payee-name');
  const settingsTotalPayments = document.getElementById('settings-total-payments');
  const settingsPaymentsTable = document.querySelector('#settings-payments-table tbody');
  const modalDownloadPaymentsBtn = document.getElementById('modal-download-payments-btn');

  // Logout dialog
  const logoutConfirmDialog = document.getElementById('logout-confirm-dialog');
  const logoutCancelBtn = document.getElementById('logout-cancel-btn');
  const logoutConfirmBtn = document.getElementById('logout-confirm-btn');

  // Local state for QR codes and temporary logo/avatar
  let savedQrCodes = [];
  let tempAvatarDataUrl = '';
  let tempLogoDataUrl = '';
  let tempQrImageDataUrl = '';

  const SECTION_DESCRIPTIONS = {
    profile: 'Manage your administrator account credentials, contact info, and profile photo.',
    screen: 'Customize website branding, top-left brand name, logo, theme mode, and accent colors.',
    'user-mgmt': 'Manage administrators, HODs, and student participants with role-based access.',
    'permissions-sub': 'Configure granular feature permissions for HOD and Student roles.',
    events: 'Manage existing events without changing event IDs or losing registrations.',
    payment: 'Manage multiple named payment QR codes and inspect payment reconciliation logs.',
    permissions: 'Comprehensive overview and audit of role-based authorization security.'
  };

  function openAdminSettingsModal(defaultSection = 'profile') {
    if (!settingsModalEl) return;
    settingsModalEl.style.display = 'flex';
    settingsModalEl.setAttribute('aria-hidden', 'false');
    lockPageScroll();
    switchSettingsSection(defaultSection);
    populateSettingsData();
    setTimeout(() => {
      if (settingsCardEl) settingsCardEl.focus();
    }, 50);
  }

  function closeAdminSettingsModal() {
    if (!settingsModalEl) return;
    settingsModalEl.style.display = 'none';
    settingsModalEl.setAttribute('aria-hidden', 'true');
    unlockPageScroll();
  }

  function switchSettingsSection(sectionId) {
    settingsNavItems.forEach((btn) => {
      const match = btn.dataset.section === sectionId;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', String(match));
    });

    const panels = document.querySelectorAll('.settings-panel');
    panels.forEach((p) => {
      const active = p.id === `panel-${sectionId}`;
      p.classList.toggle('active', active);
      p.hidden = !active;
    });

    if (settingsPanelTitle) {
      const activeItem = Array.from(settingsNavItems).find((btn) => btn.dataset.section === sectionId);
      const label = activeItem ? activeItem.querySelector('.settings-nav-label')?.textContent : 'Settings';
      settingsPanelTitle.textContent = label || 'Settings';
    }

    if (settingsPanelDesc) {
      settingsPanelDesc.textContent = SECTION_DESCRIPTIONS[sectionId] || 'Admin Settings';
    }
  }

  // --- Profile Settings ---
  function loadProfileSettings() {
    const profile = window.AdminSettingsModal ? window.AdminSettingsModal.getStoredProfile() : {
      displayName: 'Administrator',
      username: 'admin',
      email: 'admin@excel.edu',
      department: 'Event Coordination Cell',
      contactNumber: '+91 98765 43210'
    };

    if (profileDisplayName) profileDisplayName.value = profile.displayName || 'Administrator';
    if (profileUsername) profileUsername.value = profile.username || 'admin';
    if (profileEmail) profileEmail.value = profile.email || 'admin@excel.edu';
    if (profilePhone) profilePhone.value = profile.contactNumber || '';
    if (profileDepartment) profileDepartment.value = profile.department || '';

    if (profile.avatarDataUrl) {
      tempAvatarDataUrl = profile.avatarDataUrl;
      if (profileAvatarPreview) {
        profileAvatarPreview.innerHTML = `<img src="${profile.avatarDataUrl}" alt="Admin Avatar" />`;
      }
      if (dashSidebarAvatar) {
        dashSidebarAvatar.innerHTML = `<img src="${profile.avatarDataUrl}" alt="Admin Avatar" />`;
      }
    } else {
      const initials = (profile.displayName || 'AD')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'AD';
      if (profileAvatarPreview) profileAvatarPreview.textContent = initials;
      if (dashSidebarAvatar) dashSidebarAvatar.textContent = initials;
    }

    if (profileCardName) profileCardName.textContent = profile.displayName || 'Administrator';
    if (profileCardSessionId) profileCardSessionId.textContent = profile.email || profile.username || 'admin@excel.edu';
    if (sidebarAdminName) sidebarAdminName.textContent = profile.displayName || 'Administrator';
    if (dashSidebarAdminName) dashSidebarAdminName.textContent = profile.displayName || 'Administrator';
  }

  // --- Screen / Branding Settings ---
  function loadScreenSettings() {
    const branding = window.AdminSettingsModal ? window.AdminSettingsModal.getStoredBranding() : {
      websiteName: 'Excel Event Hub',
      primaryColor: '#1e3a8a',
      theme: 'dark',
      density: 'comfortable'
    };

    if (screenWebsiteName) screenWebsiteName.value = branding.websiteName || 'Excel Event Hub';
    if (screenPrimaryColor) screenPrimaryColor.value = branding.primaryColor || '#1e3a8a';
    if (screenPrimaryColorHex) screenPrimaryColorHex.value = branding.primaryColor || '#1e3a8a';

    if (branding.logoDataUrl) {
      tempLogoDataUrl = branding.logoDataUrl;
      if (screenLogoPreview) {
        screenLogoPreview.innerHTML = `<img src="${branding.logoDataUrl}" alt="Website Logo" />`;
      }
    } else {
      if (screenLogoPreview) {
        screenLogoPreview.innerHTML = `<span class="brand-mark-preview">E</span>`;
      }
    }

    const currentTheme = branding.theme || 'dark';
    const radio = document.querySelector(`input[name="screenTheme"][value="${currentTheme}"]`);
    if (radio) radio.checked = true;

    if (screenDensitySelect) screenDensitySelect.value = branding.density || 'comfortable';
  }

  // --- User Management Table ---
  function populateSettingsUsers() {
    if (!settingsUsersTable) return;
    const registrations = registrationRows();
    const roleFilter = usersRoleFilter ? usersRoleFilter.value : 'all';
    const query = usersSearchInput ? usersSearchInput.value.trim().toLowerCase() : '';

    // Generate list including Head Mam/Sir, HOD accounts, and Student participants
    const userList = [
      {
        name: 'Head Administrator',
        email: 'admin@excel.edu',
        role: 'Head Mam/Sir',
        department: 'Principal Secretariat',
        status: 'Active (Full Admin)'
      },
      {
        name: 'CSE Department HOD',
        email: 'hod.cse@excel.edu',
        role: 'HOD',
        department: 'Computer Science & Engg',
        status: 'Active (Department)'
      },
      {
        name: 'Mech Department HOD',
        email: 'hod.mech@excel.edu',
        role: 'HOD',
        department: 'Mechanical Engineering',
        status: 'Active (Department)'
      }
    ];

    registrations.forEach((r) => {
      userList.push({
        name: r.participantName || 'Participant',
        email: r.email || '—',
        role: 'Student',
        department: r.department || 'General',
        status: 'Registered Participant',
        refId: r.referenceId
      });
    });

    const filtered = userList.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (query && !u.name.toLowerCase().includes(query) && !u.email.toLowerCase().includes(query)) return false;
      return true;
    });

    if (!filtered.length) {
      settingsUsersTable.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No users matching search criteria.</td></tr>';
      return;
    }

    settingsUsersTable.innerHTML = filtered.slice(0, 60).map((u) => {
      const roleBadge = u.role === 'Head Mam/Sir' ? 'badge-primary' : (u.role === 'HOD' ? 'badge-success' : 'badge-info');
      return `
        <tr>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td><span class="badge ${roleBadge}">${u.role}</span></td>
          <td>${u.department}</td>
          <td><span class="small" style="color:var(--text-soft);">${u.status}</span></td>
          <td>
            ${u.role === 'Head Mam/Sir' ? '<span class="text-muted small">Protected</span>' : `
              <select class="settings-select user-role-change" data-email="${u.email}" style="font-size:0.78rem; padding:0.2rem 0.4rem;">
                <option value="HOD" ${u.role === 'HOD' ? 'selected' : ''}>HOD</option>
                <option value="Student" ${u.role === 'Student' ? 'selected' : ''}>Student</option>
              </select>
            `}
          </td>
        </tr>
      `;
    }).join('');

    settingsUsersTable.querySelectorAll('.user-role-change').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        showToast(`Role updated to ${e.target.value} for ${e.target.dataset.email}.`);
      });
    });
  }

  // --- Permission Matrix ---
  function loadPermissionsMatrix() {
    const perms = window.AdminSettingsModal ? window.AdminSettingsModal.getStoredPermissions() : window.AdminSettingsModal?.DEFAULT_PERMISSIONS;
    if (!perms) return;

    document.querySelectorAll('.perm-check').forEach((cb) => {
      const role = cb.dataset.role;
      const permKey = cb.dataset.perm;
      if (perms[role] && perms[role][permKey] !== undefined) {
        cb.checked = Boolean(perms[role][permKey]);
      }
    });
  }

  // --- Payment QR Management ---
  async function loadPaymentQrs() {
    try {
      const res = await fetch('/api/payment-qrs');
      if (res.ok) {
        savedQrCodes = await res.json();
      } else {
        savedQrCodes = [];
      }
    } catch (e) {
      savedQrCodes = [];
    }
    renderSavedQrs();
    populateAssignedQrDropdown();
  }

  function renderSavedQrs() {
    if (savedQrsCount) savedQrsCount.textContent = savedQrCodes.length;
    if (!savedQrsGrid) return;

    if (!savedQrCodes.length) {
      savedQrsGrid.innerHTML = `
        <div class="text-center text-muted" style="grid-column: 1 / -1; padding: 1.5rem; background:#ffffff; border-radius:8px; border:1px dashed #cbd5e1;">
          No custom payment QR codes added yet.<br>
          <small>Click <strong>+ Add New QR Code</strong> to upload and name custom QR codes (e.g., QR 1, QR 2).</small>
        </div>
      `;
      return;
    }

    savedQrsGrid.innerHTML = savedQrCodes.map((qr) => `
      <div class="qr-card" data-qr-id="${qr.id}">
        <div class="qr-card-img-wrap">
          <img src="${qr.dataUrl}" alt="${qr.name}" />
        </div>
        <div class="qr-card-info">
          <h6 class="qr-card-title">${qr.name}</h6>
          <span class="qr-card-meta">${qr.provider || 'UPI Gateway'} • <strong style="color:${qr.active ? '#16a34a' : '#94a3b8'};">${qr.active ? 'Active' : 'Inactive'}</strong></span>
        </div>
        <div class="qr-card-actions">
          <button type="button" class="btn btn--secondary edit-qr-btn" data-qr-id="${qr.id}" style="font-size:0.78rem; padding:0.25rem 0.55rem;">Edit</button>
          <button type="button" class="btn btn--danger delete-qr-btn" data-qr-id="${qr.id}" style="font-size:0.78rem; padding:0.25rem 0.55rem;">Delete</button>
        </div>
      </div>
    `).join('');

    savedQrsGrid.querySelectorAll('.edit-qr-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qr = savedQrCodes.find((q) => q.id === btn.dataset.qrId);
        if (qr) openQrEditForm(qr);
      });
    });

    savedQrsGrid.querySelectorAll('.delete-qr-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const qrId = btn.dataset.qrId;
        const qr = savedQrCodes.find((q) => q.id === qrId);
        if (!confirm(`Delete payment QR code "${qr?.name || qrId}"? Events assigned to this QR will automatically fall back to the dynamic UPI payment QR.`)) return;

        try {
          const res = await fetch(`/api/payment-qrs/${encodeURIComponent(qrId)}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('QR code deleted successfully.');
            await loadPaymentQrs();
            await loadWorkbookData();
          } else {
            alert('Failed to delete QR code.');
          }
        } catch (e) {
          alert('Error deleting QR code: ' + e.message);
        }
      });
    });
  }

  function openQrEditForm(qr = null) {
    if (!qrEditFormWrap || !paymentQrForm) return;
    qrEditFormWrap.style.display = 'block';

    if (qr) {
      if (qrFormTitle) qrFormTitle.textContent = `Edit Payment QR Code — ${qr.name}`;
      if (qrFormId) qrFormId.value = qr.id;
      if (qrFormName) qrFormName.value = qr.name;
      if (qrFormProvider) qrFormProvider.value = qr.provider || '';
      if (qrFormActive) qrFormActive.checked = qr.active !== false;
      tempQrImageDataUrl = qr.dataUrl || '';
      if (qrFormPreviewImg && qrFormPreviewBox) {
        qrFormPreviewImg.src = qr.dataUrl;
        qrFormPreviewBox.style.display = 'block';
      }
    } else {
      if (qrFormTitle) qrFormTitle.textContent = 'Add New Payment QR Code';
      paymentQrForm.reset();
      if (qrFormId) qrFormId.value = '';
      if (qrFormActive) qrFormActive.checked = true;
      tempQrImageDataUrl = '';
      if (qrFormPreviewBox) qrFormPreviewBox.style.display = 'none';
    }
  }

  function closeQrEditForm() {
    if (qrEditFormWrap) qrEditFormWrap.style.display = 'none';
    if (paymentQrForm) paymentQrForm.reset();
    tempQrImageDataUrl = '';
  }

  function populateAssignedQrDropdown() {
    if (!eventAssignedQrSelect) return;
    const currentVal = eventAssignedQrSelect.value;
    eventAssignedQrSelect.innerHTML = '<option value="">Default Dynamic UPI QR (Auto-Generated)</option>' +
      savedQrCodes.map((qr) => `<option value="${qr.id}">${qr.name} (${qr.provider || 'UPI'})</option>`).join('');
    if (currentVal) eventAssignedQrSelect.value = currentVal;
  }

  // --- Events in Modal ---
  function populateSettingsEvents() {
    if (!settingsEventsTable) return;
    const rows = [];
    eventsData.technical.forEach((e) => rows.push({ ...e, category: 'Technical' }));
    eventsData.nonTechnical.forEach((e) => rows.push({ ...e, category: 'Non-Technical' }));

    if (!rows.length) {
      settingsEventsTable.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No events found.</td></tr>';
      return;
    }

    settingsEventsTable.innerHTML = rows.map((e) => {
      const assignedQr = savedQrCodes.find((q) => q.id === e.assignedQrId);
      const qrLabel = assignedQr ? assignedQr.name : 'Dynamic UPI QR';
      return `
        <tr data-id="${e.id}">
          <td><code>${e.id}</code></td>
          <td><strong>${e.title}</strong></td>
          <td><span class="badge ${e.category === 'Technical' ? 'badge-primary' : 'badge-info'}">${e.category}</span></td>
          <td>₹${e.registrationFee ?? 0}</td>
          <td><span class="badge ${assignedQr ? 'badge-success' : 'badge-ghost'}" style="font-size:0.75rem;">${qrLabel}</span></td>
          <td><span class="badge ${String(e.status || 'Open').toLowerCase() === 'closed' ? 'badge-warning' : 'badge-success'}">${e.status || 'Open'}</span></td>
          <td>
            <button class="btn btn--secondary settings-edit-event" type="button" style="padding:0.25rem 0.6rem; font-size:0.8rem;">Edit</button>
          </td>
        </tr>
      `;
    }).join('');

    settingsEventsTable.querySelectorAll('.settings-edit-event').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        const id = event.target.closest('tr')?.dataset.id;
        if (id) {
          closeAdminSettingsModal();
          openEditEvent(id);
        }
      });
    });
  }

  // --- Payments in Modal ---
  function populateSettingsPayments() {
    if (settingsTotalPayments) settingsTotalPayments.textContent = dashboardState.payments.length;
    if (window.PAYMENT_CONFIG) {
      if (settingsUpiId) settingsUpiId.textContent = window.PAYMENT_CONFIG.upiId || 'suba.arni@okaxis';
      if (settingsPayeeName) settingsPayeeName.textContent = window.PAYMENT_CONFIG.payeeName || 'Excel Event Hub';
    }

    if (!settingsPaymentsTable) return;
    const pays = dashboardState.payments.slice();
    if (!pays.length) {
      settingsPaymentsTable.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No payment records found.</td></tr>';
      return;
    }
    settingsPaymentsTable.innerHTML = pays.slice(0, 50).map((p) => `
      <tr>
        <td><code>${p.referenceId || '—'}</code></td>
        <td>${p.participantName || p.fullName || '—'}</td>
        <td>${p.eventName || '—'}</td>
        <td><strong>${typeof p.amount === 'number' ? `₹${p.amount}` : p.amount || '—'}</strong></td>
        <td><code>${p.paymentTransactionId || p.utrNumber || '—'}</code></td>
        <td><span class="badge badge-success">${p.paymentStatus || 'Submitted'}</span></td>
      </tr>
    `).join('');
  }

  function populateSettingsData() {
    loadProfileSettings();
    loadScreenSettings();
    populateSettingsUsers();
    loadPermissionsMatrix();
    loadPaymentQrs();
    populateSettingsEvents();
    populateSettingsPayments();
  }

  // ==========================================
  // EVENT LISTENERS FOR SETTINGS MODAL
  // ==========================================

  // Nav open/close
  if (openSettingsNavBtn) {
    openSettingsNavBtn.addEventListener('click', () => openAdminSettingsModal('profile'));
  }
  if (openSettingsPanelBtn) {
    openSettingsPanelBtn.addEventListener('click', () => openAdminSettingsModal('profile'));
  }
  if (dashboardSidebarSettingsBtn) {
    dashboardSidebarSettingsBtn.addEventListener('click', () => openAdminSettingsModal('profile'));
  }
  if (dashNavUsersBtn) {
    dashNavUsersBtn.addEventListener('click', () => openAdminSettingsModal('user-mgmt'));
  }
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', closeAdminSettingsModal);
  }
  if (settingsBackdropEl) {
    settingsBackdropEl.addEventListener('click', closeAdminSettingsModal);
  }

  settingsNavItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.section;
      if (sectionId) switchSettingsSection(sectionId);
    });
  });

  // Logout with confirmation dialog
  if (settingsLogoutNavBtn) {
    settingsLogoutNavBtn.addEventListener('click', () => {
      if (logoutConfirmDialog) {
        logoutConfirmDialog.showModal();
      } else {
        doLogout();
      }
    });
  }

  if (logoutCancelBtn) {
    logoutCancelBtn.addEventListener('click', () => {
      if (logoutConfirmDialog) logoutConfirmDialog.close();
    });
  }

  if (logoutConfirmBtn) {
    logoutConfirmBtn.addEventListener('click', () => {
      if (logoutConfirmDialog) logoutConfirmDialog.close();
      closeAdminSettingsModal();
      try {
        sessionStorage.removeItem('excel_admin_logged_in');
        sessionStorage.removeItem('excel_admin_identity');
        localStorage.removeItem('excel_admin_events');
      } catch (e) {}
      window.location.href = 'admin-login.html';
    });
  }

  // Profile photo upload preview
  if (profilePhotoInput) {
    profilePhotoInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('Profile photo must be smaller than 2 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        tempAvatarDataUrl = ev.target.result;
        if (profileAvatarPreview) {
          profileAvatarPreview.innerHTML = `<img src="${tempAvatarDataUrl}" alt="Avatar Preview" />`;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Profile Form Submit
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const profile = {
        displayName: (profileDisplayName?.value || '').trim() || 'Administrator',
        username: profileUsername?.value || 'admin',
        email: (profileEmail?.value || '').trim() || 'admin@excel.edu',
        contactNumber: (profilePhone?.value || '').trim(),
        department: (profileDepartment?.value || '').trim(),
        avatarDataUrl: tempAvatarDataUrl || '',
        role: 'Head Mam/Sir'
      };

      if (window.AdminSettingsModal) {
        window.AdminSettingsModal.saveStoredProfile(profile);
      }

      // Persist to server settings endpoint as well
      try {
        await fetch('/api/settings/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile)
        });
      } catch (err) {}

      loadProfileSettings();
      showToast('Profile settings saved successfully.');
    });
  }

  if (resetProfileBtn) {
    resetProfileBtn.addEventListener('click', () => {
      try { localStorage.removeItem('excel_admin_custom_profile'); } catch (e) {}
      tempAvatarDataUrl = '';
      loadProfileSettings();
      showToast('Profile reset to defaults.');
    });
  }

  // Screen Settings: Logo upload
  if (screenLogoUpload) {
    screenLogoUpload.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo must be smaller than 2 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        tempLogoDataUrl = ev.target.result;
        if (screenLogoPreview) {
          screenLogoPreview.innerHTML = `<img src="${tempLogoDataUrl}" alt="Logo Preview" />`;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (resetLogoBtn) {
    resetLogoBtn.addEventListener('click', () => {
      tempLogoDataUrl = '';
      if (screenLogoUpload) screenLogoUpload.value = '';
      if (screenLogoPreview) {
        screenLogoPreview.innerHTML = `<span class="brand-mark-preview">E</span>`;
      }
    });
  }

  // Color picker sync
  if (screenPrimaryColor && screenPrimaryColorHex) {
    screenPrimaryColor.addEventListener('input', () => {
      screenPrimaryColorHex.value = screenPrimaryColor.value;
    });
    screenPrimaryColorHex.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(screenPrimaryColorHex.value)) {
        screenPrimaryColor.value = screenPrimaryColorHex.value;
      }
    });
  }

  document.querySelectorAll('.color-preset-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      if (color) {
        if (screenPrimaryColor) screenPrimaryColor.value = color;
        if (screenPrimaryColorHex) screenPrimaryColorHex.value = color;
      }
    });
  });

  // Save Screen Settings
  if (saveScreenSettingsBtn) {
    saveScreenSettingsBtn.addEventListener('click', async () => {
      const branding = {
        websiteName: (screenWebsiteName?.value || '').trim() || 'Excel Event Hub',
        logoDataUrl: tempLogoDataUrl || '',
        theme: document.querySelector('input[name="screenTheme"]:checked')?.value || 'dark',
        primaryColor: screenPrimaryColor?.value || '#1e3a8a',
        density: screenDensitySelect?.value || 'comfortable'
      };

      if (window.AdminSettingsModal) {
        window.AdminSettingsModal.applyBranding(branding);
      }

      // Persist to server
      try {
        await fetch('/api/settings/branding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(branding)
        });
      } catch (e) {}

      showToast(`Website branding updated: "${branding.websiteName}" applied.`);
    });
  }

  // User search and filter
  if (usersRoleFilter) usersRoleFilter.addEventListener('change', populateSettingsUsers);
  if (usersSearchInput) usersSearchInput.addEventListener('input', populateSettingsUsers);
  if (modalRefreshUsersBtn) {
    modalRefreshUsersBtn.addEventListener('click', async () => {
      await loadWorkbookData();
      populateSettingsUsers();
      showToast('Users refreshed.');
    });
  }

  // Permissions matrix save
  if (savePermissionsBtn) {
    savePermissionsBtn.addEventListener('click', async () => {
      const perms = { hod: {}, student: {} };
      document.querySelectorAll('.perm-check').forEach((cb) => {
        const role = cb.dataset.role;
        const permKey = cb.dataset.perm;
        if (role && permKey) {
          perms[role][permKey] = cb.checked;
        }
      });

      if (window.AdminSettingsModal) {
        window.AdminSettingsModal.saveStoredPermissions(perms);
      }

      try {
        await fetch('/api/settings/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(perms)
        });
      } catch (e) {}

      showToast('Role permissions saved successfully.');
    });
  }

  if (resetPermissionsBtn) {
    resetPermissionsBtn.addEventListener('click', () => {
      try { localStorage.removeItem('excel_admin_permissions'); } catch (e) {}
      loadPermissionsMatrix();
      showToast('Permissions reset to defaults.');
    });
  }

  // Add / Edit QR Code Flow
  if (addNewQrBtn) {
    addNewQrBtn.addEventListener('click', () => openQrEditForm(null));
  }
  if (cancelQrFormBtn) {
    cancelQrFormBtn.addEventListener('click', closeQrEditForm);
  }

  if (qrFormImage) {
    qrFormImage.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('QR code image must be smaller than 5 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        tempQrImageDataUrl = ev.target.result;
        if (qrFormPreviewImg && qrFormPreviewBox) {
          qrFormPreviewImg.src = tempQrImageDataUrl;
          qrFormPreviewBox.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (paymentQrForm) {
    paymentQrForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = qrFormName?.value?.trim();
      if (!name) return alert('Please enter a display name for the QR code.');
      if (!tempQrImageDataUrl) return alert('Please upload a QR code image.');

      const payload = {
        id: qrFormId?.value || undefined,
        name: name,
        provider: qrFormProvider?.value?.trim() || 'UPI',
        dataUrl: tempQrImageDataUrl,
        active: qrFormActive?.checked !== false
      };

      try {
        const res = await fetch('/api/payment-qrs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok && result.success) {
          showToast(`QR Code "${name}" saved successfully.`);
          closeQrEditForm();
          await loadPaymentQrs();
          populateSettingsEvents();
        } else {
          alert('Failed to save QR code: ' + (result.error || 'Server error'));
        }
      } catch (err) {
        alert('Network error saving QR code: ' + err.message);
      }
    });
  }

  if (modalAddEventBtn) {
    modalAddEventBtn.addEventListener('click', () => {
      closeAdminSettingsModal();
      openAddEvent();
    });
  }

  if (modalDownloadPaymentsBtn) {
    modalDownloadPaymentsBtn.addEventListener('click', downloadPayments);
  }

  // Wire main dashboard sidebar navigation
  const dashNavItems = document.querySelectorAll('.dash-nav-item[data-section]');
  dashNavItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.section;
      dashNavItems.forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.dashboard-page-panel').forEach((panel) => {
        const match = panel.id === `panel-${sectionId}`;
        panel.classList.toggle('active', match);
        panel.hidden = !match;
      });
      // Ensure data for the activated panel is populated
      populateSettingsData();
    });
  });

  const dashNavLogoutBtn = document.getElementById('dash-nav-logout');
  if (dashNavLogoutBtn) {
    dashNavLogoutBtn.addEventListener('click', () => {
      if (logoutConfirmDialog) {
        logoutConfirmDialog.showModal();
      } else {
        try {
          sessionStorage.removeItem('excel_admin_logged_in');
          sessionStorage.removeItem('excel_admin_identity');
          localStorage.removeItem('excel_admin_events');
        } catch (e) {}
        window.location.href = 'admin-login.html';
      }
    });
  }

  // Initialize theme and branding from storage immediately
  if (window.AdminSettingsModal) {
    const branding = window.AdminSettingsModal.getStoredBranding();
    window.AdminSettingsModal.applyBranding(branding);
  }

  // Initial load
  refreshAll();
  loadWorkbookData();
  loadProfileSettings();
  loadPaymentQrs();
  populateSettingsData();
});

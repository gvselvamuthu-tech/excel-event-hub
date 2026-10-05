document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('admin-login-form');
  const identity = document.getElementById('admin-identity');
  const password = document.getElementById('admin-password');
  const toggle = document.getElementById('toggle-password');
  const messageBox = document.getElementById('login-message');

  // Simple admin credential (for demo/testing only)
  const ADMIN = {
    username: 'admin',
    email: 'admin@excel.edu',
    password: 'Admin@123'
  };

  function showMessage(text, type) {
    messageBox.style.display = 'block';
    messageBox.textContent = text;
    messageBox.className = 'message-box ' + (type === 'success' ? 'success-box' : 'error-box');
  }

  function clearMessage() {
    messageBox.style.display = 'none';
    messageBox.textContent = '';
    messageBox.className = '';
  }

  toggle.addEventListener('change', function () {
    password.type = toggle.checked ? 'text' : 'password';
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMessage();

    identity.removeAttribute('aria-invalid');
    password.removeAttribute('aria-invalid');

    const idVal = (identity.value || '').trim();
    const pwdVal = password.value || '';

    if (!idVal) {
      identity.setAttribute('aria-invalid', 'true');
      showMessage('Please enter admin email or username.', 'error');
      return;
    }

    if (!pwdVal) {
      password.setAttribute('aria-invalid', 'true');
      showMessage('Please enter your password.', 'error');
      return;
    }

    const matchesIdentity = (idVal.toLowerCase() === ADMIN.email.toLowerCase()) || (idVal === ADMIN.username);
    const valid = matchesIdentity && pwdVal === ADMIN.password;

    if (!valid) {
      showMessage('Invalid admin credentials. Please try again.', 'error');
      return;
    }

    // Successful login: set a simple session and redirect to dashboard
    try {
      sessionStorage.setItem('excel_admin_logged_in', '1');
      sessionStorage.setItem('excel_admin_identity', idVal);
    } catch (err) {
      console.warn('sessionStorage error', err);
    }

    showMessage('Login successful — redirecting...', 'success');
    setTimeout(function () {
      window.location.href = 'admin-dashboard.html';
    }, 700);
  });
});

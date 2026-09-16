/**
 * SIPEDAS — Admin Login Script
 * Externalized to comply with strict CSP & sandboxed iframe environments
 */

document.addEventListener('DOMContentLoaded', () => {
    const pwInput = document.getElementById('admin-password');
    const toggleBtn = document.getElementById('toggle-pw');
    const loginForm = document.getElementById('login-form');
    const btnSubmit = document.getElementById('btn-submit');
    const btnText = document.getElementById('btn-text');
    const spinner = document.getElementById('spinner');
    const alertError = document.getElementById('alert-error');
    const errorText = document.getElementById('error-text');

    if (!loginForm || !pwInput) return;

    // Toggle password visibility
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = pwInput.type === 'password';
            pwInput.type = isPassword ? 'text' : 'password';
            toggleBtn.innerHTML = isPassword ? `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="19" height="19">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
            ` : `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="19" height="19">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            `;
            pwInput.focus();
        });
    }

    // Handle login submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (alertError) alertError.style.display = 'none';

        const password = pwInput.value.trim();
        if (!password) {
            if (errorText) errorText.textContent = 'Silakan masukkan password terlebih dahulu.';
            if (alertError) alertError.style.display = 'flex';
            pwInput.focus();
            return;
        }

        if (btnSubmit) btnSubmit.disabled = true;
        if (spinner) spinner.style.display = 'inline-block';
        if (btnText) btnText.textContent = 'Memverifikasi...';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ password: password })
            });

            if (res.ok) {
                try { localStorage.setItem('sipedas_user_role', 'admin'); } catch(e) {}
                try { localStorage.setItem('sipedas_auth_event', JSON.stringify({ type: 'login', ts: Date.now() })); } catch(e) {}
                if (btnText) btnText.textContent = 'Login berhasil! Mengalihkan...';
                setTimeout(() => {
                    window.location.href = '/?_t=' + Date.now();
                }, 400);
            } else {
                const err = await res.json().catch(() => ({}));
                if (errorText) errorText.textContent = err.detail || 'Password salah atau gagal terhubung ke server.';
                if (alertError) alertError.style.display = 'flex';
                pwInput.focus();
                pwInput.select();
            }
        } catch (err) {
            if (errorText) errorText.textContent = 'Gagal terhubung ke server backend SIPEDAS.';
            if (alertError) alertError.style.display = 'flex';
        } finally {
            if (btnSubmit) btnSubmit.disabled = false;
            if (spinner) spinner.style.display = 'none';
            if (btnText && !btnText.textContent.includes('berhasil')) {
                btnText.textContent = 'Masuk sebagai Admin';
            }
        }
    });
});

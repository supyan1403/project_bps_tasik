// ==========================================================================
// SIPEDAS AUTH & ROLE EXTENSION
// Mengelola pergantian password & sinkronisasi tab pengaturan
// ==========================================================================

function togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = btnEl.querySelector('i');
    if (icon) {
        icon.className = isPassword ? 'bi bi-eye-slash-fill text-primary' : 'bi bi-eye';
    }
}

async function openSettingsModal() {
    const isDark = document.body.classList.contains('dark-mode') || document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const { value: isSuccess } = await Swal.fire({
        html: `
            <div style="text-align: center; padding: 6px 4px 0 4px;">
                <!-- Ikon Utama Tengah: Kunci Keamanan BPS -->
                <div style="width: 54px; height: 54px; margin: 0 auto 16px auto; border-radius: 16px; background: linear-gradient(135deg, #091e42 0%, #1e3a8a 60%, #2563eb 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);">
                    <i class="bi bi-key-fill"></i>
                </div>

                <h5 style="margin: 0 0 4px 0; font-size: 1.15rem; font-weight: 700; color: ${isDark ? '#f8fafc' : '#0f172a'}; letter-spacing: -0.3px;">
                    Ganti Password Admin
                </h5>
                <div style="font-size: 0.78rem; color: ${isDark ? '#94a3b8' : '#64748b'}; margin-bottom: 16px; font-weight: 500;">
                    BPS Kabupaten Tasikmalaya
                </div>

                <div style="font-size: 0.83rem; color: ${isDark ? '#cbd5e1' : '#475569'}; margin-bottom: 18px; line-height: 1.5; padding: 0 10px;">
                    Pastikan password baru Anda kuat (minimal 6 karakter) untuk menjaga integritas data statistik.
                </div>

                <!-- 3 Baris Input Password -->
                <div style="text-align: left; display: flex; flex-direction: column; gap: 12px;">
                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 600; color: ${isDark ? '#e2e8f0' : '#334155'}; margin-bottom: 4px;">
                            Password Lama <span style="color: #ef4444;">*</span>
                        </label>
                        <div class="sipedas-login-input-group">
                            <input type="password" id="swal-old-password" class="sipedas-login-input" placeholder="Masukkan password saat ini..." autocomplete="current-password">
                            <button type="button" class="sipedas-login-eye-btn" onclick="const p=document.getElementById('swal-old-password'); const isPw=p.type==='password'; p.type=isPw?'text':'password'; this.querySelector('i').className=isPw?'bi bi-eye-slash-fill text-primary':'bi bi-eye';">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 600; color: ${isDark ? '#e2e8f0' : '#334155'}; margin-bottom: 4px;">
                            Password Baru <span style="color: #ef4444;">*</span>
                        </label>
                        <div class="sipedas-login-input-group">
                            <input type="password" id="swal-new-password" class="sipedas-login-input" placeholder="Minimal 6 karakter..." autocomplete="new-password">
                            <button type="button" class="sipedas-login-eye-btn" onclick="const p=document.getElementById('swal-new-password'); const isPw=p.type==='password'; p.type=isPw?'text':'password'; this.querySelector('i').className=isPw?'bi bi-eye-slash-fill text-primary':'bi bi-eye';">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 600; color: ${isDark ? '#e2e8f0' : '#334155'}; margin-bottom: 4px;">
                            Konfirmasi Password Baru <span style="color: #ef4444;">*</span>
                        </label>
                        <div class="sipedas-login-input-group">
                            <input type="password" id="swal-confirm-password" class="sipedas-login-input" placeholder="Ketik ulang password baru..." autocomplete="new-password">
                            <button type="button" class="sipedas-login-eye-btn" onclick="const p=document.getElementById('swal-confirm-password'); const isPw=p.type==='password'; p.type=isPw?'text':'password'; this.querySelector('i').className=isPw?'bi bi-eye-slash-fill text-primary':'bi bi-eye';">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-lg me-1"></i> Simpan Password',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: isDark ? '#334155' : '#f1f5f9',
        buttonsStyling: true,
        focusConfirm: false,
        backdrop: 'rgba(15, 23, 42, 0.65)',
        showLoaderOnConfirm: true,
        customClass: {
            popup: 'sipedas-login-modal border-0',
            actions: 'mt-3 mb-0 w-100 justify-content-center gap-2'
        },
        didOpen: () => {
            const inp = document.getElementById('swal-old-password');
            if (inp) inp.focus();
        },
        preConfirm: async () => {
            const oldPass = document.getElementById('swal-old-password')?.value || '';
            const newPass = document.getElementById('swal-new-password')?.value || '';
            const confirmPass = document.getElementById('swal-confirm-password')?.value || '';

            if (!oldPass) {
                Swal.showValidationMessage('Masukkan password lama terlebih dahulu.');
                return false;
            }
            if (newPass.length < 6) {
                Swal.showValidationMessage('Password baru minimal harus 6 karakter.');
                return false;
            }
            if (newPass !== confirmPass) {
                Swal.showValidationMessage('Konfirmasi password baru tidak cocok!');
                return false;
            }

            try {
                const res = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ old_password: oldPass, new_password: newPass })
                });

                const data = await res.json();
                if (!res.ok) {
                    Swal.showValidationMessage(data.detail || 'Gagal memperbarui password.');
                    return false;
                }
                return data;
            } catch (e) {
                Swal.showValidationMessage('Gagal terhubung ke server auth SIPEDAS.');
                return false;
            }
        }
    });

    if (isSuccess) {
        Swal.fire({
            title: 'Berhasil!',
            text: isSuccess.message || 'Password admin berhasil diperbarui dengan aman.',
            icon: 'success',
            confirmButtonColor: '#2563eb'
        });
    }
}

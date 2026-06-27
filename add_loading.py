import sys
import re

with open('backend/static/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

loading_modal_code = '''
let currentLoadingOverlay = null;

function showLoadingModal(title, message) {
    hideLoadingModal(); // close existing if any
    
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0'; overlay.style.left = '0'; overlay.style.width = '100%'; overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.display = 'flex'; overlay.style.justifyContent = 'center'; overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.backdropFilter = 'blur(4px)';
    
    const box = document.createElement('div');
    box.style.background = 'white';
    box.style.padding = '2.5rem 2rem';
    box.style.borderRadius = '16px';
    box.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)';
    box.style.minWidth = '300px';
    box.style.textAlign = 'center';
    
    box.innerHTML = `
        <div style="display:flex; justify-content:center; margin-bottom:1.5rem;">
            <div style="width:50px; height:50px; border:4px solid #f1f5f9; border-top-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite;"></div>
        </div>
        <h3 style="margin:0 0 0.5rem 0; color:#1e293b; font-size:1.25rem;">${title}</h3>
        <p style="color:#64748b; margin:0; line-height:1.5; font-size:0.95rem;">${message}</p>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    currentLoadingOverlay = overlay;
}

function hideLoadingModal() {
    if (currentLoadingOverlay && currentLoadingOverlay.parentNode) {
        currentLoadingOverlay.parentNode.removeChild(currentLoadingOverlay);
        currentLoadingOverlay = null;
    }
}
'''

if 'showLoadingModal' not in content:
    content = content.replace('// --- CUSTOM MODALS ---', '// --- CUSTOM MODALS ---\n' + loading_modal_code)

# Upload
content = content.replace('btn.textContent = "Uploading...";', 'showLoadingModal("Mengunggah PDF", "Mohon tunggu sebentar, file sedang diunggah ke server...");\n        btn.textContent = "Uploading...";')
content = content.replace('showCustomAlert("Berhasil", "Upload sukses!', 'hideLoadingModal();\n                showCustomAlert("Berhasil", "Upload sukses!')
content = content.replace('showCustomAlert("Gagal", "Terjadi kesalahan upload.", "error");', 'hideLoadingModal();\n            showCustomAlert("Gagal", "Terjadi kesalahan upload.", "error");')

# extractPages
content = re.sub(
    r'const res = await fetch\(`\$\{API_BASE\}/documents/\$\{docId\}/extract`, \{\s*method: "POST",\s*headers: \{ "Content-Type": "application/json" \},\s*body: JSON\.stringify\(\{\s*start_page: parseInt\(startInput\),\s*end_page: parseInt\(endInput\)\s*\}\)\s*\}\);',
    '''showLoadingModal("Memulai Ekstraksi", "Menyiapkan proses di latar belakang...");
    const res = await fetch(`${API_BASE}/documents/${docId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            start_page: parseInt(startInput),
            end_page: parseInt(endInput)
        })
    });
    hideLoadingModal();''', content, flags=re.DOTALL)

# loadToDatabase
content = re.sub(
    r'const res = await fetch\(`\$\{API_BASE\}/tables/\$\{tableId\}/load`, \{ method: "POST" \}\);',
    '''showLoadingModal("Memuat Data", "Sedang membaca CSV dan mendeteksi anomali...");
    const res = await fetch(`${API_BASE}/tables/${tableId}/load`, { method: "POST" });
    hideLoadingModal();''', content)

# deleteBab
content = content.replace('const res = await fetch(`${API_BASE}/documents/${docId}/bab/${babNum}`, { method: "DELETE" });', 'showLoadingModal("Menghapus Bab", "Mohon tunggu...");\n        const res = await fetch(`${API_BASE}/documents/${docId}/bab/${babNum}`, { method: "DELETE" });\n        hideLoadingModal();')

# deleteDocument
content = content.replace('const res = await fetch(`${API_BASE}/documents/${docId}`, { method: "DELETE" });', 'showLoadingModal("Menghapus Publikasi", "Mohon tunggu, menghapus file dan tabel terkait...");\n        const res = await fetch(`${API_BASE}/documents/${docId}`, { method: "DELETE" });\n        hideLoadingModal();')

# deleteTable
content = content.replace('const res = await fetch(`${API_BASE}/tables/${tableId}`, { method: "DELETE" });', 'showLoadingModal("Menghapus Tabel", "Mohon tunggu...");\n        const res = await fetch(`${API_BASE}/tables/${tableId}`, { method: "DELETE" });\n        hideLoadingModal();')

# deleteRow
content = content.replace('const res = await fetch(`${API_BASE}/data/${rowId}`, { method: "DELETE" });', 'showLoadingModal("Menghapus Baris", "Mohon tunggu...");\n        const res = await fetch(`${API_BASE}/data/${rowId}`, { method: "DELETE" });\n        hideLoadingModal();')


with open('backend/static/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("SUCCESS modifying app.js")

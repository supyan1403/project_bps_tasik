(function() {
    // Role-based access logic
    window.currentUserRole = 'pegawai'; // Default role

    window.changeRole = function(role) {
        window.currentUserRole = role;
        updateUIVisibility();
        Swal.fire({
            title: 'Role Berubah',
            text: `Anda sekarang login sebagai: ${role.charAt(0).toUpperCase() + role.slice(1)}`,
            icon: 'info',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    };

    function updateUIVisibility() {
        const adminElements = document.querySelectorAll('.admin-only');
        if (window.currentUserRole === 'admin') {
            adminElements.forEach(el => el.style.display = 'block');
        } else {
            adminElements.forEach(el => el.style.display = 'none');
        }
    }

    // Ensure UI is set on load
    document.addEventListener("DOMContentLoaded", () => {
        updateUIVisibility();
    });

    window.initUserDashboardCharts = function() {
        console.log("Initializing user dashboard visualizations...");
    };
})();

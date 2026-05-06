document.addEventListener('DOMContentLoaded', async () => {
    // Check auth via script.js checkAuth method
    checkAuth();

    // Initialize password validation
    initPasswordValidation();
});

// Password Validation
let isEditMode = false;

function initPasswordValidation() {
    const passwordInput = document.getElementById('userPassword');
    const requirementsDiv = document.getElementById('passwordRequirements');

    // Hide requirements by default
    requirementsDiv.style.display = 'none';

    // Show requirements when typing
    passwordInput.addEventListener('focus', () => {
        if (!isEditMode || passwordInput.value.length > 0) {
            requirementsDiv.style.display = 'block';
        }
    });

    // Hide requirements when empty in edit mode
    passwordInput.addEventListener('blur', () => {
        if (isEditMode && passwordInput.value.length === 0) {
            requirementsDiv.style.display = 'none';
        }
    });
}

function validatePassword(password) {
    const requirementsDiv = document.getElementById('passwordRequirements');
    const strengthDiv = document.getElementById('passwordStrength');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const passwordError = document.getElementById('passwordError');

    // Show/hide requirements based on edit mode
    if (isEditMode && password.length === 0) {
        requirementsDiv.style.display = 'none';
        strengthDiv.style.display = 'none';
        passwordError.style.display = 'none';
        return true;
    } else {
        requirementsDiv.style.display = 'block';
    }

    // Password requirements
    const hasMinLength = password.length >= 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    // Update requirement indicators
    updateRequirement('req-min', hasMinLength);
    updateRequirement('req-upper', hasUpperCase);
    updateRequirement('req-number', hasNumber);

    // Calculate strength
    const score = (hasMinLength ? 1 : 0) + (hasUpperCase ? 1 : 0) + (hasNumber ? 1 : 0);

    // Update strength indicator
    strengthDiv.style.display = 'block';
    strengthFill.className = 'strength-fill';

    if (score === 0) {
        strengthFill.style.width = '0%';
        strengthText.textContent = '';
        strengthText.className = '';
    } else if (score === 1) {
        strengthFill.classList.add('weak');
        strengthText.textContent = 'Lemah';
        strengthText.className = 'weak';
    } else if (score === 2) {
        strengthFill.classList.add('medium');
        strengthText.textContent = 'Sedang';
        strengthText.className = 'medium';
    } else {
        strengthFill.classList.add('strong');
        strengthText.textContent = 'Kuat';
        strengthText.className = 'strong';
    }

    // Validate if required (only in create mode)
    if (!isEditMode) {
        const isValid = hasMinLength && hasUpperCase && hasNumber;
        if (password.length > 0 && !isValid) {
            passwordError.style.display = 'block';
            passwordError.textContent = 'Password belum memenuhi semua persyaratan';
            return false;
        } else {
            passwordError.style.display = 'none';
            return isValid && password.length > 0;
        }
    }

    // In edit mode, validate only if password is provided
    if (isEditMode && password.length > 0) {
        const isValid = hasMinLength && hasUpperCase && hasNumber;
        if (!isValid) {
            passwordError.style.display = 'block';
            passwordError.textContent = 'Password belum memenuhi semua persyaratan';
            return false;
        } else {
            passwordError.style.display = 'none';
            return true;
        }
    }

    passwordError.style.display = 'none';
    return true;
}

function updateRequirement(id, met) {
    const element = document.getElementById(id);
    const icon = element.querySelector('.req-icon');

    if (met) {
        element.classList.add('met');
        icon.textContent = '✓';
    } else {
        element.classList.remove('met');
        icon.textContent = '○';
    }
}

function resetPasswordValidation() {
    const requirementsDiv = document.getElementById('passwordRequirements');
    const strengthDiv = document.getElementById('passwordStrength');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const passwordError = document.getElementById('passwordError');

    requirementsDiv.style.display = 'none';
    strengthDiv.style.display = 'none';
    strengthFill.className = 'strength-fill';
    strengthFill.style.width = '0%';
    strengthText.textContent = '';
    strengthText.className = '';
    passwordError.style.display = 'none';

    // Reset requirement indicators
    updateRequirement('req-min', false);
    updateRequirement('req-upper', false);
    updateRequirement('req-number', false);
}

document.addEventListener('DOMContentLoaded', async () => {
    // Check auth via script.js checkAuth method
    checkAuth();

    // Pastikan hanya K3 admin yang bisa akses
    if (!hasRole('k3')) {
        window.location.href = 'index.html';
        return;
    }

    // Load users from localStorage
    loadUsers();

    // Fetch users from Supabase
    await fetchUsersFromSupabase();

    renderUsers();

    // Inisialisasi TomSelect untuk Role
    if (typeof TomSelect !== 'undefined') {
        new TomSelect('#userRole', {
            create: false,
            sortField: {
                field: "text",
                direction: "asc"
            }
        });
    }
});

// Load users from localStorage sync with script.js USERS
function loadUsers() {
    try {
        const savedUsers = localStorage.getItem('assessment5r_users');
        if (savedUsers) {
            USERS = JSON.parse(savedUsers);
        }
    } catch(e) {
        console.error('Error loading users:', e);
    }
}

// Fetch users from Supabase
async function fetchUsersFromSupabase() {
    try {
        const users = await SupabaseAPI.get('users');
        if (users && users.length > 0) {
            USERS = users;
            localStorage.setItem('assessment5r_users', JSON.stringify(USERS));
        }
    } catch(e) {
        console.error('Error fetching users from Supabase:', e);
        // Fallback to localStorage if API fails
        loadUsers();
    }
}

function renderUsers() {
    const tableBody = document.getElementById('usersTable');
    const emptyState = document.getElementById('emptyUsers');

    if (USERS.length === 0) {
        tableBody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tableBody.innerHTML = USERS.map(u => `
        <tr>
            <td><strong>${escapeHtml(u.name)}</strong></td>
            <td>${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.email || '-')}</td>
            <td>
                <span style="padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:600;
                      background:${u.role === 'k3' ? '#fee2e2' : '#e0e7ff'};
                      color:${u.role === 'k3' ? '#dc2626' : '#4f46e5'}">
                    ${escapeHtml(u.role).toUpperCase()}
                </span>
            </td>
            <td>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-sm btn-secondary btn-icon" onclick="editUser('${u.id}')" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-danger btn-icon" onclick="deleteUser('${u.id}')" title="Hapus" ${['u1','u2'].includes(u.id) ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openUserModal() {
    isEditMode = false;

    document.getElementById('userId').value = '';
    document.getElementById('userName').value = '';
    document.getElementById('userUsername').value = '';
    document.getElementById('userEmail').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').type = 'password';
    document.getElementById('userPassword').required = true;
    document.getElementById('passwordHint').style.display = 'none';
    document.getElementById('passwordRequired').style.display = 'inline';

    const roleSelect = document.getElementById('userRole');
    if (roleSelect.tomselect) {
        roleSelect.tomselect.setValue('user');
    } else {
        roleSelect.value = 'user';
    }

    document.getElementById('modalTitle').textContent = 'Tambah User Baru';
    document.getElementById('userModal').classList.add('active');

    // Reset password validation
    resetPasswordValidation();
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
    resetPasswordValidation();
}

function editUser(id) {
    isEditMode = true;

    // Handle ID yang bisa berupa string atau angka
    const user = USERS.find(u => String(u.id) === String(id));
    if (!user) {
        console.log('User tidak ditemukan dengan ID:', id, 'Data USERS:', USERS);
        return;
    }

    document.getElementById('userId').value = user.id;
    document.getElementById('userName').value = user.name;
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userEmail').value = user.email || '';

    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').type = 'password';
    document.getElementById('userPassword').required = false;
    document.getElementById('passwordHint').style.display = 'inline';
    document.getElementById('passwordRequired').style.display = 'none';

    const roleSelect = document.getElementById('userRole');
    if (roleSelect.tomselect) {
        roleSelect.tomselect.setValue(user.role);
    } else {
        roleSelect.value = user.role;
    }

    document.getElementById('modalTitle').textContent = 'Edit User';
    document.getElementById('userModal').classList.add('active');

    // Reset password validation
    resetPasswordValidation();
}

async function deleteUser(id) {
    if (id === 'u1' || id === 'u2' || String(id) === 'u1' || String(id) === 'u2') {
        showToast('User bawaan sistem tidak dapat dihapus!');
        return;
    }

    const result = await Swal.fire({
        title: 'Apakah Anda yakin?',
        text: "User ini akan dihapus secara permanen!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Ya, hapus!',
        cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
        try {
            // Delete from Supabase
            await SupabaseAPI.delete('users', { 'id': `eq.${id}` });

            // Update local
            USERS = USERS.filter(u => String(u.id) !== String(id));
            localStorage.setItem('assessment5r_users', JSON.stringify(USERS));

            // Fetch ulang data dari Supabase
            await fetchUsersFromSupabase();

            renderUsers();
            showToast('User berhasil dihapus!');
        } catch(e) {
            console.error('Error deleting user:', e);
            Swal.fire({
                icon: 'error',
                title: 'Gagal!',
                text: 'Gagal menghapus user: ' + e.message,
            });
        }
    }
}

async function handleUserSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('userId').value;
    const name = document.getElementById('userName').value;
    const username = document.getElementById('userUsername').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;

    // Validate password
    if (!isEditMode && !validatePassword(password)) {
        Swal.fire({
            icon: 'error',
            title: 'Validasi Gagal',
            text: 'Password harus memenuhi semua persyaratan!',
        });
        return;
    }

    if (isEditMode && password.length > 0 && !validatePassword(password)) {
        Swal.fire({
            icon: 'error',
            title: 'Validasi Gagal',
            text: 'Password harus memenuhi semua persyaratan!',
        });
        return;
    }

    try {
        if (id) {
            // Edit - Update user in Supabase
            const userIndex = USERS.findIndex(u => String(u.id) === String(id));
            if (userIndex !== -1) {
                // Check username duplicate for others
                if (USERS.some(u => u.username === username && String(u.id) !== String(id))) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: 'Username sudah digunakan user lain!',
                    });
                    return;
                }

                const updateData = { name, username, email, role };
                if (password) {
                    updateData.password = password;
                }

                await SupabaseAPI.patch('users', updateData, { 'id': `eq.${id}` });

                // Fetch ulang data dari Supabase
                await fetchUsersFromSupabase();

                showToast('Data user berhasil diperbarui!');
            }
        } else {
            // Create - Add new user to Supabase
            // Check if username exists
            if (USERS.some(u => u.username === username)) {
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: 'Username sudah terdaftar!',
                });
                return;
            }

            const newUser = {
                name,
                username,
                email,
                password,
                role
            };

            await SupabaseAPI.post('users', newUser);

            // Fetch ulang data dari Supabase
            await fetchUsersFromSupabase();

            showToast('User baru berhasil ditambahkan!');
        }

        renderUsers();
        closeUserModal();
    } catch(e) {
        console.error('Error saving user:', e);
        Swal.fire({
            icon: 'error',
            title: 'Gagal!',
            text: 'Gagal menyimpan user: ' + e.message,
        });
    }
}

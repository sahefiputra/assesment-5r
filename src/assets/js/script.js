// =====================
// Auth System
// =====================
let USERS = [];
try {
    const savedUsers = localStorage.getItem('assessment5r_users');
    if (savedUsers) {
        USERS = JSON.parse(savedUsers);
    } else {
        USERS = [
            { id: 'u1', username: 'user', password: 'user123', role: 'user', name: 'User Demo' },
            { id: 'u2', username: 'k3', password: 'k3admin', role: 'k3', name: 'Tim K3' }
        ];
        localStorage.setItem('assessment5r_users', JSON.stringify(USERS));
    }
} catch(e) {
    console.error(e);
}

const SESSION_KEY = 'assessment5r_session';
const STORAGE_KEY = 'assessment5r_data';

// Chart instances untuk di-destroy sebelum re-render
let barChartInstance = null;
let lineChartInstance = null;
let pieChartInstance = null;

function checkAuth() {
    // Login page tidak perlu cek auth
    if (window.location.pathname.includes('login.html')) {
        return;
    }

    const session = localStorage.getItem(SESSION_KEY);
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        // Cek ke Supabase dulu
        const result = await SupabaseAPI.get('users', {
            'username': `eq.${username}`,
            'password': `eq.${password}`
        });

        if (result && result.length > 0) {
            const user = result[0];
            const session = {
                id: user.id?.toString() || user.id, // Ensure ID is stored as string or number
                username: user.username,
                role: user.role,
                name: user.name,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            window.location.href = 'index.html';
            return;
        }

        // Fallback ke local USERS (untuk default users)
        const user = USERS.find(u => u.username === username && u.password === password);

        if (user) {
            const session = {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            window.location.href = 'index.html';
        } else {
            const errorEl = document.getElementById('loginError');
            errorEl.style.display = 'block';
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, 3000);
        }
    } catch (e) {
        console.error('Login error:', e);
        // Jika API error, coba cek local USERS
        const user = USERS.find(u => u.username === username && u.password === password);
        if (user) {
            const session = {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            window.location.href = 'index.html';
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Login Gagal',
                text: e.message,
            });
        }
    }
}

function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
}

function getCurrentUser() {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
}

function hasRole(role) {
    const user = getCurrentUser();
    return user && user.role === role;
}

// =====================
// Storage Management
// =====================
function getAssessments() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveAssessments(assessments) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assessments));
}

async function fetchAssessmentsFromSupabase() {
    try {
        const user = getCurrentUser();
        let params = {
            'select': '*,users(name)'
        };

        // User hanya lihat assessment sendiri
        if (user.role === 'user') {
            // Check if user.id exists, if not try to get user from Supabase
            let userId = user.id;
            if (!userId) {
                try {
                    const userResult = await SupabaseAPI.get('users', {
                        'username': `eq.${user.username}`
                    });
                    if (userResult && userResult.length > 0) {
                        userId = userResult[0].id;
                        // Update session with correct ID
                        const session = JSON.parse(localStorage.getItem(SESSION_KEY));
                        session.id = userId;
                        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                    }
                } catch (e) {
                    console.error('Error fetching user:', e);
                }
            }

            if (userId) {
                params.user_id = `eq.${userId}`;
            }
        }

        const data = await SupabaseAPI.get('assessments', params);
        
        if (data) {
            // Transform data to match flat structure used in app
            const transformed = data.map(a => ({
                id: a.id,
                nama: a.users?.name || 'Unknown',
                user_id: a.user_id,
                divisi: a.divisi,
                jabatan: a.jabatan,
                periode: a.periode,
                createdAt: a.created_at,
                representative: a.is_representative,
                statement_agreed: a.statement_agreed,
                scores: {
                    r1: parseFloat(a.r1_score || 0),
                    r2: parseFloat(a.r2_score || 0),
                    r3: parseFloat(a.r3_score || 0),
                    r4: parseFloat(a.r4_score || 0),
                    r5: parseFloat(a.r5_score || 0),
                    total: parseFloat(a.total_score || 0)
                }
            }));
            
            saveAssessments(transformed);
            return transformed;
        }
        return [];
    } catch (e) {
        console.error('Error fetching assessments from Supabase:', e);
        return getAssessments();
    }
}

async function fetchUserAssessmentFromSupabase(user_id, periode = null) {
    try {
        let params = {
            'user_id': `eq.${user_id}`,
            'select': '*,assessment_answers(*,assessment_photos(*))'
        };

        // Filter by periode jika diberikan
        if (periode) {
            params.periode = `eq.${periode}`;
        }

        const data = await SupabaseAPI.get('assessments', params);

        if (data && data.length > 0) {
            return data[0]; // Return single assessment
        }
        return null;
    } catch (e) {
        console.error('Error fetching user assessment from Supabase:', e);
        return null;
    }
}

// =====================
// Scoring System
// =====================
function calculateScores(data) {
    // R1: 5 questions
    const r1 = calculateAspectScore(data, ['q1_1', 'q1_2', 'q1_3', 'q1_4', 'q1_5']);
    // R2: 5 questions
    const r2 = calculateAspectScore(data, ['q2_1', 'q2_2', 'q2_3', 'q2_4', 'q2_5']);
    // R3: 5 questions
    const r3 = calculateAspectScore(data, ['q3_1', 'q3_2', 'q3_3', 'q3_4', 'q3_5']);
    // R4: 2 questions
    const r4 = calculateAspectScore(data, ['q4_1', 'q4_2']);
    // R5: 5 questions
    const r5 = calculateAspectScore(data, ['q5_1', 'q5_2', 'q5_3', 'q5_4', 'q5_5']);

    const total = (r1 + r2 + r3 + r4 + r5) / 5;

    return { r1, r2, r3, r4, r5, total };
}

function calculateAspectScore(data, questions) {
    let totalScore = 0;
    let answeredCount = 0;

    questions.forEach(q => {
        if (data[q]) {
            const score = parseInt(data[q]) || 0;
            totalScore += score;
            answeredCount++;
        }
    });

    // Jika semua pertanyaan dijawab, return rata-rata
    // Jika tidak lengkap, return 0 atau bisa disesuaikan
    if (answeredCount === 0) return 0;
    return totalScore / questions.length;
}

// =====================
// Dashboard Functions
// =====================
function updateStats() {
    const user = getCurrentUser();
    let assessments = getAssessments();

    // User hanya lihat assessment sendiri berdasarkan user_id
    if (user.role === 'user') {
        assessments = assessments.filter(a => a.user_id === user.id || a.user_id == user.id);
    }

    const statTotal = document.getElementById('statTotal');
    if (statTotal) statTotal.textContent = assessments.length;

    const statDivisi = document.getElementById('statDivisi');
    if (statDivisi) {
        const uniqueDivisi = [...new Set(assessments.map(a => a.divisi))];
        statDivisi.textContent = uniqueDivisi.length;
    }

    // Untuk K3, tambahkan stats nilai
    if (user.role === 'k3' && assessments.length > 0) {
        const avgScores = calculateAverageScores(assessments);

        const statAvgR1 = document.getElementById('statAvgR1');
        const statAvgR2 = document.getElementById('statAvgR2');
        const statAvgR3 = document.getElementById('statAvgR3');
        const statAvgR4 = document.getElementById('statAvgR4');
        const statAvgR5 = document.getElementById('statAvgR5');
        const statAvgTotal = document.getElementById('statAvgTotal');

        if (statAvgR1) statAvgR1.textContent = avgScores.r1.toFixed(1);
        if (statAvgR2) statAvgR2.textContent = avgScores.r2.toFixed(1);
        if (statAvgR3) statAvgR3.textContent = avgScores.r3.toFixed(1);
        if (statAvgR4) statAvgR4.textContent = avgScores.r4.toFixed(1);
        if (statAvgR5) statAvgR5.textContent = avgScores.r5.toFixed(1);
        if (statAvgTotal) statAvgTotal.textContent = avgScores.total.toFixed(1);
    }
}

function calculateAverageScores(assessments) {
    let r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0, total = 0;

    assessments.forEach(a => {
        if (a.scores) {
            r1 += a.scores.r1;
            r2 += a.scores.r2;
            r3 += a.scores.r3;
            r4 += a.scores.r4;
            r5 += a.scores.r5;
            total += a.scores.total;
        }
    });

    const count = assessments.length;
    return {
        r1: r1 / count,
        r2: r2 / count,
        r3: r3 / count,
        r4: r4 / count,
        r5: r5 / count,
        total: total / count
    };
}

async function renderAssessments(forceFetch = false) {
    const user = getCurrentUser();
    let assessments = forceFetch ? await fetchAssessmentsFromSupabase() : getAssessments();

    // User hanya lihat assessment sendiri berdasarkan user_id
    if (user.role === 'user') {
        assessments = assessments.filter(a => a.user_id === user.id || a.user_id == user.id);
    }

    const tableBody = document.getElementById('assessmentTable');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const filterDivisi = document.getElementById('filterDivisi');

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const divisiFilter = filterDivisi ? filterDivisi.value : 'all';

    let filtered = assessments.filter(a => {
        const matchesSearch = a.nama.toLowerCase().includes(searchTerm) ||
                             a.divisi.toLowerCase().includes(searchTerm) ||
                             a.jabatan.toLowerCase().includes(searchTerm);
        const matchesDivisi = divisiFilter === 'all' || a.divisi === divisiFilter;
        return matchesSearch && matchesDivisi;
    });

    // Sort by total score (K3 only)
    if (user.role === 'k3') {
        const sortValue = document.getElementById('sortValue')?.value || 'desc';
        filtered.sort((a, b) => {
            const scoreA = a.scores?.total || 0;
            const scoreB = b.scores?.total || 0;
            return sortValue === 'desc' ? scoreB - scoreA : scoreA - scoreB;
        });
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    // Tampilkan tabel dengan kolom: Nama, Divisi, Jabatan, Tanggal, Total Score
    tableBody.innerHTML = filtered.map(a => {
        let actionButtons = '';

        if (user.role === 'k3') {
            // K3: View, Edit, Delete
            actionButtons = `
                <button class="btn btn-sm btn-outline" onclick="viewAssessment('${a.id}')" title="Lihat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                </button>
                <button class="btn btn-sm btn-secondary" onclick="editAssessment('${a.id}')" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteAssessment('${a.id}')" title="Hapus">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            `;
        } else {
            // User biasa: Hanya View
            actionButtons = `
                <button class="btn btn-sm btn-outline" onclick="viewAssessment('${a.id}')" title="Lihat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                </button>
            `;
        }

        return `
            <tr>
                <td><strong>${escapeHtml(a.nama)}</strong></td>
                <td>${escapeHtml(a.divisi)}</td>
                <td>${escapeHtml(a.jabatan)}</td>
                <td>${formatDate(a.createdAt)}</td>
                <td class="score-cell score-total"><strong>${a.scores?.total.toFixed(1) || '-'}</strong></td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderCharts() {
    const assessments = getAssessments();

    const chartsSection = document.getElementById('chartsSection');
    if (chartsSection && assessments.length === 0) {
        chartsSection.style.display = 'none';
        return;
    }
    if (chartsSection) {
        chartsSection.style.display = 'block';
    }

    // Calculate averages
    const avgScores = calculateAverageScores(assessments);

    // Bar Chart - Average per aspect
    if (document.getElementById('barChart')) {
        renderBarChart(avgScores);
    }

    // Line Chart - Trend by periode
    if (document.getElementById('lineChart')) {
        renderLineChart(assessments);
    }

    // Pie Chart - Distribution by divisi
    if (document.getElementById('pieChart')) {
        renderPieChart(assessments);
    }
}

function renderBarChart(avgScores) {
    // Destroy chart yang sudah ada
    if (barChartInstance) {
        barChartInstance.destroy();
    }

    const ctx = document.getElementById('barChart').getContext('2d');
    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ringkas (R1)', 'Rapi (R2)', 'Resik (R3)', 'Rawat (R4)', 'Rajin (R5)'],
            datasets: [{
                label: 'Rata-rata Nilai',
                data: [avgScores.r1, avgScores.r2, avgScores.r3, avgScores.r4, avgScores.r5],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(6, 182, 212, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(139, 92, 246, 0.8)'
                ],
                borderColor: [
                    'rgb(99, 102, 241)',
                    'rgb(16, 185, 129)',
                    'rgb(6, 182, 212)',
                    'rgb(245, 158, 11)',
                    'rgb(139, 92, 246)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: value => value + '%' }
                }
            }
        }
    });
}

function renderLineChart(assessments) {
    // Destroy chart yang sudah ada
    if (lineChartInstance) {
        lineChartInstance.destroy();
    }

    // Group by periode
    const periodeData = {};
    assessments.forEach(a => {
        if (!periodeData[a.periode]) {
            periodeData[a.periode] = { total: 0, count: 0 };
        }
        if (a.scores) {
            periodeData[a.periode].total += a.scores.total;
            periodeData[a.periode].count++;
        }
    });

    const labels = Object.keys(periodeData).sort();
    const data = labels.map(p => (periodeData[p].total / periodeData[p].count).toFixed(1));

    const ctx = document.getElementById('lineChart').getContext('2d');
    lineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Rata-rata Total Nilai',
                data: data,
                borderColor: 'rgb(99, 102, 241)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: value => value + '%' }
                }
            }
        }
    });
}

function renderPieChart(assessments) {
    // Destroy chart yang sudah ada
    if (pieChartInstance) {
        pieChartInstance.destroy();
    }

    const divisiData = {};
    assessments.forEach(a => {
        divisiData[a.divisi] = (divisiData[a.divisi] || 0) + 1;
    });

    const ctx = document.getElementById('pieChart').getContext('2d');
    pieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(divisiData),
            datasets: [{
                data: Object.values(divisiData),
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(6, 182, 212, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(236, 72, 153, 0.8)',
                    'rgba(20, 184, 166, 0.8)',
                    'rgba(132, 204, 22, 0.8)',
                    'rgba(249, 115, 22, 0.8)',
                    'rgba(99, 102, 241, 0.6)',
                    'rgba(16, 185, 129, 0.6)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12, padding: 15 }
                }
            }
        }
    });
}

async function viewAssessment(id) {
    // Redirect to view-form page
    window.location.href = `view-form.html?id=${id}`;
}

function editAssessment(id) {
    window.location.href = `form.html?id=${id}`;
}

async function deleteAssessment(id) {
    const result = await Swal.fire({
        title: 'Hapus Assessment?',
        text: "Data yang dihapus tidak dapat dikembalikan!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Ya, hapus!',
        cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'Menghapus...',
        text: 'Mohon tunggu sebentar',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // Delete dari Supabase (CASCADE akan menghapus answers dan photos)
        await SupabaseAPI.delete('assessments', { 'id': `eq.${id}` });

        // Refresh data dari Supabase
        await fetchAssessmentsFromSupabase();

        updateStats();
        renderAssessments();

        // Refresh charts if K3
        if (hasRole('k3')) {
            renderCharts();
        }

        Swal.close();
        showToast('Assessment berhasil dihapus');
    } catch (e) {
        console.error('Error deleting assessment:', e);
        Swal.close();
        Swal.fire({
            icon: 'error',
            title: 'Gagal!',
            text: 'Gagal menghapus assessment: ' + e.message
        });
    }
}

function closeModal() {
    document.getElementById('detailModal').classList.remove('active');
}

function populateDivisiFilter() {
    const filterDivisi = document.getElementById('filterDivisi');
    if (!filterDivisi) return;

    const assessments = getAssessments();
    const uniqueDivisi = [...new Set(assessments.map(a => a.divisi))].filter(Boolean);

    // Keep the "Semua Divisi" option
    filterDivisi.innerHTML = '<option value="all">Semua Divisi</option>';

    uniqueDivisi.forEach(divisi => {
        const option = document.createElement('option');
        option.value = divisi;
        option.textContent = divisi;
        filterDivisi.appendChild(option);
    });
}

// =====================
// Form Functions
// =====================
let currentEditId = null;

function getFormData() {
    const user = getCurrentUser();
    const formData = {
        id: currentEditId || generateId(),
        nama: document.getElementById('nama').value,
        divisi: document.getElementById('divisi').value,
        jabatan: document.getElementById('jabatan').value,
        periode: document.getElementById('periode').value,
        representative: document.getElementById('representative').checked,
        createdBy: currentEditId ? getAssessmentById(currentEditId)?.createdBy : user.username,
        createdAt: currentEditId ? getAssessmentById(currentEditId)?.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),

        // Hidden user id for relational schema
        user_id: document.getElementById('form_user_id')?.value || user.id,

        // Aspek Ringkas
        q1_1: document.querySelector('input[name="q1_1"]:checked')?.value,
        foto1_1: getStoredImage('foto1_1'),
        q1_2: document.querySelector('input[name="q1_2"]:checked')?.value,
        foto1_2: getStoredImage('foto1_2'),
        q1_3: document.querySelector('input[name="q1_3"]:checked')?.value,
        foto1_3: getStoredImage('foto1_3'),
        q1_4: document.querySelector('input[name="q1_4"]:checked')?.value,
        penjelasan1_4: document.getElementById('penjelasan1_4')?.value || '',
        q1_5: document.querySelector('input[name="q1_5"]:checked')?.value,
        foto1_5: getStoredImage('foto1_5'),

        // Aspek Rapi
        q2_1: document.querySelector('input[name="q2_1"]:checked')?.value,
        foto2_1: getStoredImage('foto2_1'),
        q2_2: document.querySelector('input[name="q2_2"]:checked')?.value,
        foto2_2: getStoredImage('foto2_2'),
        q2_3: document.querySelector('input[name="q2_3"]:checked')?.value,
        foto2_3: getStoredImage('foto2_3'),
        q2_4: document.querySelector('input[name="q2_4"]:checked')?.value,
        foto2_4: getStoredImage('foto2_4'),
        q2_5: document.querySelector('input[name="q2_5"]:checked')?.value,
        foto2_5: getStoredImage('foto2_5'),

        // Aspek Resik
        q3_1: document.querySelector('input[name="q3_1"]:checked')?.value,
        foto3_1: getStoredImage('foto3_1'),
        q3_2: document.querySelector('input[name="q3_2"]:checked')?.value,
        foto3_2: getStoredImage('foto3_2'),
        q3_3: document.querySelector('input[name="q3_3"]:checked')?.value,
        foto3_3: getStoredImage('foto3_3'),
        q3_4: document.querySelector('input[name="q3_4"]:checked')?.value,
        foto3_4: getStoredImage('foto3_4'),
        q3_5: document.querySelector('input[name="q3_5"]:checked')?.value,
        foto3_5: getStoredImage('foto3_5'),

        // Aspek Rawat
        q4_1: document.querySelector('input[name="q4_1"]:checked')?.value,
        foto4_1: getStoredImage('foto4_1'),
        q4_2: document.querySelector('input[name="q4_2"]:checked')?.value,
        foto4_2: getStoredImage('foto4_2'),

        // Aspek Rajin
        q5_1: document.querySelector('input[name="q5_1"]:checked')?.value,
        penjelasan5_1: document.getElementById('penjelasan5_1')?.value || '',
        q5_2: document.querySelector('input[name="q5_2"]:checked')?.value,
        penjelasan5_2: document.getElementById('penjelasan5_2')?.value || '',
        q5_3: document.querySelector('input[name="q5_3"]:checked')?.value,
        penjelasan5_3: document.getElementById('penjelasan5_3')?.value || '',
        q5_4: document.querySelector('input[name="q5_4"]:checked')?.value,
        penjelasan5_4: document.getElementById('penjelasan5_4')?.value || '',
        q5_5: document.querySelector('input[name="q5_5"]:checked')?.value,
        penjelasan5_5: document.getElementById('penjelasan5_5')?.value || '',
        kendala5_6: document.getElementById('kendala5_6')?.value || '',

        // Pernyataan
        statement_agreed: document.getElementById('statement_agreed').checked
    };

    // Calculate scores
    formData.scores = calculateScores(formData);

    return formData;
}

async function handleSubmit(event) {
    event.preventDefault();

    Swal.fire({
        title: 'Menyimpan...',
        text: 'Mohon tunggu sebentar',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const data = getFormData();

        // 1. Save to assessments table
        const assessmentRecord = {
            user_id: data.user_id,
            divisi: data.divisi,
            jabatan: data.jabatan,
            periode: data.periode,
            is_representative: data.representative,
            statement_agreed: data.statement_agreed,
            r1_score: data.scores.r1,
            r2_score: data.scores.r2,
            r3_score: data.scores.r3,
            r4_score: data.scores.r4,
            r5_score: data.scores.r5,
            total_score: data.scores.total
        };

        let assessment_id;
        let isUpdate = !!currentEditId;

        if (isUpdate) {
            // Update existing assessment
            await SupabaseAPI.patch('assessments', assessmentRecord, { 'id': `eq.${currentEditId}` });
            assessment_id = currentEditId;

            // Delete old answers and photos (CASCADE will handle photos)
            await SupabaseAPI.delete('assessment_answers', { 'assessment_id': `eq.${assessment_id}` });
        } else {
            // Create new assessment
            const assessmentResponse = await SupabaseAPI.post('assessments', assessmentRecord);
            assessment_id = assessmentResponse[0].id;
        }

        // 2. Prepare answers for bulk insert
        const aspects = ['R1', 'R2', 'R3', 'R4', 'R5'];
        const questionsMap = {
            'R1': ['q1_1', 'q1_2', 'q1_3', 'q1_4', 'q1_5'],
            'R2': ['q2_1', 'q2_2', 'q2_3', 'q2_4', 'q2_5'],
            'R3': ['q3_1', 'q3_2', 'q3_3', 'q3_4', 'q3_5'],
            'R4': ['q4_1', 'q4_2'],
            'R5': ['q5_1', 'q5_2', 'q5_3', 'q5_4', 'q5_5']
        };

        const answersToInsert = [];
        // Array untuk menyimpan photos dengan index answer yang sesuai
        const photosByAnswerIndex = [];

        for (const aspect of aspects) {
            for (const qCode of questionsMap[aspect]) {
                const score = data[qCode];
                if (score !== undefined) {
                    const explanationKey = `penjelasan${qCode.replace('q', '')}`;
                    const explanation = data[explanationKey] || (qCode === 'q5_6' ? data.kendala5_6 : '');

                    const answerIndex = answersToInsert.length;
                    answersToInsert.push({
                        assessment_id,
                        aspect_code: aspect,
                        question_code: qCode,
                        score: parseInt(score),
                        explanation: explanation
                    });

                    // 3. Collect photos for this question
                    const photoKey = `foto${qCode.replace('q', '')}`;
                    const photos = data[photoKey] || [];
                    photosByAnswerIndex[answerIndex] = photos.map((photoData, i) => ({
                        file_path: photoData,
                        file_name: `photo_${qCode}_${Date.now()}_${i}.jpg`,
                        file_size: Math.round(photoData.length * 0.75)
                    }));
                }
            }
        }

        // Bulk insert answers
        if (answersToInsert.length > 0) {
            const insertedAnswers = await SupabaseAPI.postBulk('assessment_answers', answersToInsert);

            // Bulk insert photos
            const photosToInsert = [];
            for (let i = 0; i < insertedAnswers.length; i++) {
                const answer_id = insertedAnswers[i].id;
                const photos = photosByAnswerIndex[i] || [];
                for (const photo of photos) {
                    photosToInsert.push({
                        answer_id: answer_id,
                        file_path: photo.file_path,
                        file_name: photo.file_name,
                        file_size: photo.file_size
                    });
                }
            }

            if (photosToInsert.length > 0) {
                await SupabaseAPI.postBulk('assessment_photos', photosToInsert);
            }
        }

        // Also save to localStorage for cache/fallback
        saveAssessment(data);

        Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: 'Assessment berhasil disimpan!',
            timer: 1500,
            showConfirmButton: false
        });

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);

    } catch (e) {
        console.error('Error saving assessment:', e);
        Swal.fire({
            icon: 'error',
            title: 'Gagal!',
            text: 'Gagal menyimpan assessment: ' + e.message,
        });
    }
}

function saveAssessment(data) {
    let assessments = getAssessments();

    if (currentEditId) {
        const index = assessments.findIndex(a => a.id === currentEditId);
        if (index !== -1) {
            assessments[index] = data;
        }
    } else {
        assessments.push(data);
        currentEditId = data.id;
    }

    saveAssessments(assessments);
}

function loadAssessment(id) {
    const assessment = getAssessmentById(id);
    if (!assessment) return;

    currentEditId = id;

    // Load basic info
    document.getElementById('nama').value = assessment.nama || '';
    document.getElementById('divisi').value = assessment.divisi || '';
    document.getElementById('jabatan').value = assessment.jabatan || '';
    document.getElementById('periode').value = assessment.periode || '';
    document.getElementById('representative').checked = assessment.representative || false;

    // Load radio buttons
    const radioFields = [
        'q1_1', 'q1_2', 'q1_3', 'q1_4', 'q1_5',
        'q2_1', 'q2_2', 'q2_3', 'q2_4', 'q2_5',
        'q3_1', 'q3_2', 'q3_3', 'q3_4', 'q3_5',
        'q4_1', 'q4_2',
        'q5_1', 'q5_2', 'q5_3', 'q5_4', 'q5_5'
    ];

    radioFields.forEach(field => {
        const value = assessment[field];
        if (value) {
            const radio = document.querySelector(`input[name="${field}"][value="${value}"]`);
            if (radio) radio.checked = true;
        }
    });

    // Load textareas
    document.getElementById('penjelasan1_4').value = assessment.penjelasan1_4 || '';
    document.getElementById('penjelasan5_1').value = assessment.penjelasan5_1 || '';
    document.getElementById('penjelasan5_2').value = assessment.penjelasan5_2 || '';
    document.getElementById('penjelasan5_3').value = assessment.penjelasan5_3 || '';
    document.getElementById('penjelasan5_4').value = assessment.penjelasan5_4 || '';
    document.getElementById('penjelasan5_5').value = assessment.penjelasan5_5 || '';
    document.getElementById('kendala5_6').value = assessment.kendala5_6 || '';

    // Load images
    const imageFields = [
        'foto1_1', 'foto1_2', 'foto1_3', 'foto1_5',
        'foto2_1', 'foto2_2', 'foto2_3', 'foto2_4', 'foto2_5',
        'foto3_1', 'foto3_2', 'foto3_3', 'foto3_4', 'foto3_5',
        'foto4_1', 'foto4_2'
    ];

    imageFields.forEach(field => {
        const imageData = assessment[field];
        if (imageData) {
            sessionStorage.setItem(field, imageData);
            showImagePreview(field, imageData);
        }
    });

    // Load pernyataan
    document.getElementById('pernyataan').checked = assessment.pernyataan || false;
}

function getAssessmentById(id) {
    const assessments = getAssessments();
    return assessments.find(a => a.id === id);
}

function loadAssessmentFromSupabase(assessmentData) {
    if (!assessmentData) return;

    currentEditId = assessmentData.id;

    // Load basic info
    document.getElementById('form_user_id').value = assessmentData.user_id || '';
    const namaField = document.getElementById('nama');
    if (namaField) namaField.value = assessmentData.users?.name || getCurrentUser()?.name || '';
    document.getElementById('divisi').value = assessmentData.divisi || '';
    document.getElementById('jabatan').value = assessmentData.jabatan || '';
    document.getElementById('periode').value = assessmentData.periode || '';
    document.getElementById('representative').checked = assessmentData.is_representative || false;
    const pernyataanField = document.getElementById('pernyataan');
    if (pernyataanField) pernyataanField.checked = assessmentData.statement_agreed || false;

    // Update TomSelect values if available
    const divisiSelect = document.getElementById('divisi');
    const jabatanSelect = document.getElementById('jabatan');
    const periodeSelect = document.getElementById('periode');

    if (divisiSelect && divisiSelect.tomselect) divisiSelect.tomselect.setValue(assessmentData.divisi || '');
    if (jabatanSelect && jabatanSelect.tomselect) jabatanSelect.tomselect.setValue(assessmentData.jabatan || '');
    if (periodeSelect && periodeSelect.tomselect) periodeSelect.tomselect.setValue(assessmentData.periode || '');

    // Load answers
    if (assessmentData.assessment_answers && Array.isArray(assessmentData.assessment_answers)) {
        assessmentData.assessment_answers.forEach(answer => {
            // Set radio button value
            if (answer.question_code && answer.score !== null) {
                const radio = document.querySelector(`input[name="${answer.question_code}"][value="${answer.score}"]`);
                if (radio) radio.checked = true;
            }

            // Set explanation textarea
            const explanationField = `penjelasan${answer.question_code.replace('q', '')}`;
            const textarea = document.getElementById(explanationField);
            if (textarea && answer.explanation) {
                textarea.value = answer.explanation;
            }

            // Load photos for this answer
            if (answer.assessment_photos && Array.isArray(answer.assessment_photos)) {
                const photoField = `foto${answer.question_code.replace('q', '')}`;
                const photos = answer.assessment_photos.map(p => p.file_path);
                sessionStorage.setItem(photoField, JSON.stringify(photos));
                showImagePreview(photoField, photos);
            }
        });
    }
}

// =====================
// Image Handling
// =====================
function previewImages(input) {
    const field = input.id;
    const files = Array.from(input.files);
    
    // Validasi jumlah file
    let existingImages = [];
    try {
        const stored = sessionStorage.getItem(field);
        if (stored) {
            existingImages = JSON.parse(stored);
            if (!Array.isArray(existingImages)) {
                existingImages = [stored];
            }
        }
    } catch(e) {
        const stored = sessionStorage.getItem(field);
        if (stored) existingImages = [stored];
    }

    if (existingImages.length + files.length > 3) {
        Swal.fire({
            icon: 'warning',
            title: 'Maksimal Foto',
            text: 'Maksimal 3 foto yang diperbolehkan',
        });
        input.value = '';
        return;
    }
    
    const invalidFiles = files.filter(f => f.size > 1024 * 1024);
    if (invalidFiles.length > 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Ukuran Foto Terlalu Besar',
            text: 'Setiap foto maksimal 1MB',
        });
        input.value = '';
        return;
    }

    const processFile = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                // Compress image to save localStorage space
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    Promise.all(files.map(processFile)).then(dataUrls => {
        existingImages = [...existingImages, ...dataUrls];
        sessionStorage.setItem(field, JSON.stringify(existingImages));
        showImagePreview(field, existingImages);
        input.value = ''; // Reset input to allow adding same file again if needed
    });
}

function showImagePreview(field, imagesStrOrArr) {
    const preview = document.getElementById(`preview${field.replace('foto', '')}`);
    if (!preview) return;

    let images = [];
    if (typeof imagesStrOrArr === 'string') {
        try { images = JSON.parse(imagesStrOrArr); } catch(e) { images = [imagesStrOrArr]; }
    } else {
        images = imagesStrOrArr || [];
    }

    if (images.length === 0) {
        preview.innerHTML = '';
        preview.classList.remove('has-image');
        return;
    }

    preview.innerHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; width: 100%;">
        ${images.map((imgData, idx) => `
            <div style="position: relative;">
                <img src="${imgData}" alt="Preview" style="width: 100%; height: 100px; object-fit: cover; border-radius: 8px;">
                <button type="button" class="remove-btn" onclick="removeImageIndex('${field}', ${idx})" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('')}
    </div>`;
    preview.classList.add('has-image');
}

function removeImageIndex(field, index) {
    let images = [];
    try {
        images = JSON.parse(sessionStorage.getItem(field) || '[]');
        if (!Array.isArray(images)) images = [images];
    } catch(e) {
        const stored = sessionStorage.getItem(field);
        if (stored) images = [stored];
    }
    
    images.splice(index, 1);
    sessionStorage.setItem(field, JSON.stringify(images));
    showImagePreview(field, images);
}

function removeImage(field) {
    sessionStorage.removeItem(field);
    showImagePreview(field, []);
}

function getStoredImage(field) {
    const val = sessionStorage.getItem(field);
    if (!val) return [];
    try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [val];
    } catch(e) {
        return [val];
    }
}

// =====================
// Assessment Form Helpers
// =====================
async function fetchAndLoadAssessmentById(id) {
    try {
        Swal.fire({
            title: 'Memuat...',
            text: 'Mohon tunggu sebentar',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        const data = await SupabaseAPI.get('assessments', {
            'id': `eq.${id}`,
            'select': '*,assessment_answers(*,assessment_photos(*))'
        });

        if (data && data.length > 0) {
            loadAssessmentFromSupabase(data[0]);
            Swal.close();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Tidak Ditemukan',
                text: 'Assessment tidak ditemukan'
            });
        }
    } catch (e) {
        console.error('Error fetching assessment:', e);
        Swal.fire({
            icon: 'error',
            title: 'Gagal',
            text: 'Gagal memuat assessment: ' + e.message
        });
    }
}

async function showUserAssessmentList() {
    try {
        const user = getCurrentUser();
        if (!user) return;

        // Check if user.id exists, if not try to get user from Supabase
        let userId = user.id;
        if (!userId) {
            // Try to fetch user by username to get the correct ID
            try {
                const userResult = await SupabaseAPI.get('users', {
                    'username': `eq.${user.username}`
                });
                if (userResult && userResult.length > 0) {
                    userId = userResult[0].id;
                    // Update session with correct ID
                    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
                    session.id = userId;
                    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                }
            } catch (e) {
                console.error('Error fetching user:', e);
            }
        }

        if (!userId) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'User ID tidak ditemukan. Silakan login ulang.'
            });
            return;
        }

        Swal.fire({
            title: 'Memuat...',
            text: 'Mohon tunggu sebentar',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        const data = await SupabaseAPI.get('assessments', {
            'user_id': `eq.${userId}`,
            'select': '*,assessment_answers(*)',
            'order': 'created_at.desc'
        });

        Swal.close();

        if (data && data.length > 0) {
            // Build HTML for assessment list
            const assessmentsHtml = data.map(a => `
                <div class="assessment-item" style="padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 0.5rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;"
                     onclick="selectAssessment(${a.id})">
                    <div>
                        <div style="font-weight: 600; color: #1f2937;">${escapeHtml(a.periode)}</div>
                        <div style="font-size: 0.875rem; color: #6b7280;">${escapeHtml(a.divisi)} - ${escapeHtml(a.jabatan)}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: #6366f1;">${parseFloat(a.total_score || 0).toFixed(1)}</div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Total Skor</div>
                    </div>
                </div>
            `).join('');

            // Add hover style
            const style = document.createElement('style');
            style.textContent = `
                .assessment-item:hover {
                    background-color: #f3f4f6;
                    border-color: #6366f1 !important;
                }
            `;
            document.head.appendChild(style);

            Swal.fire({
                title: 'Pilih Assessment',
                html: `
                    <div style="max-height: 300px; overflow-y: auto;">
                        <p style="margin-bottom: 1rem; color: #6b7280;">Pilih assessment yang ingin diedit, atau buat baru:</p>
                        ${assessmentsHtml}
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Buat Baru',
                cancelButtonText: 'Batal',
                customClass: {
                    confirmButton: 'btn btn-primary',
                    cancelButton: 'btn btn-secondary'
                },
                didOpen: () => {
                    // Store assessments data for selection
                    window.assessmentList = data;
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    // Create new assessment - reset form with defaults
                    resetForm();
                    Swal.fire({
                        icon: 'success',
                        title: 'Form Assessment Baru',
                        text: 'Silakan isi assessment baru',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
            });
        } else {
            // No assessments, directly create new
            Swal.fire({
                title: 'Belum Ada Assessment',
                text: 'Anda belum memiliki assessment. Buat assessment baru?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Buat Baru',
                cancelButtonText: 'Batal'
            }).then((result) => {
                if (result.isConfirmed) {
                    resetForm();
                    Swal.fire({
                        icon: 'success',
                        title: 'Form Assessment Baru',
                        text: 'Silakan isi assessment baru',
                        timer: 1500,
                        showConfirmButton: false
                    });
                } else {
                    window.location.href = 'index.html';
                }
            });
        }
    } catch (e) {
        console.error('Error fetching user assessments:', e);
        Swal.fire({
            icon: 'error',
            title: 'Gagal',
            text: 'Gagal memuat daftar assessment: ' + e.message
        });
    }
}

async function selectAssessment(assessmentId) {
    Swal.close();
    await fetchAndLoadAssessmentById(assessmentId);
}

function resetForm() {
    document.getElementById('assessmentForm').reset();
    currentEditId = null;

    // Clear sessionStorage photos
    const imageFields = [
        'foto1_1', 'foto1_2', 'foto1_3', 'foto1_5',
        'foto2_1', 'foto2_2', 'foto2_3', 'foto2_4', 'foto2_5',
        'foto3_1', 'foto3_2', 'foto3_3', 'foto3_4', 'foto3_5',
        'foto4_1', 'foto4_2'
    ];
    imageFields.forEach(field => {
        sessionStorage.removeItem(field);
        showImagePreview(field, []);
    });

    // Set default values to "Tidak" (score 25) for all radio questions
    const radioFields = [
        'q1_1', 'q1_2', 'q1_3', 'q1_4', 'q1_5',
        'q2_1', 'q2_2', 'q2_3', 'q2_4', 'q2_5',
        'q3_1', 'q3_2', 'q3_3', 'q3_4', 'q3_5',
        'q4_1', 'q4_2',
        'q5_1', 'q5_2', 'q5_3', 'q5_4', 'q5_5'
    ];

    radioFields.forEach(field => {
        const radio = document.querySelector(`input[name="${field}"][value="25"]`);
        if (radio) radio.checked = true;
    });

    // Clear textarea explanations
    const textareaFields = [
        'penjelasan1_4',
        'penjelasan5_1', 'penjelasan5_2', 'penjelasan5_3', 'penjelasan5_4', 'penjelasan5_5',
        'kendala5_6'
    ];
    textareaFields.forEach(field => {
        const textarea = document.getElementById(field);
        if (textarea) textarea.value = '';
    });

    // Reset user info
    const user = getCurrentUser();
    if (user) {
        const namaField = document.getElementById('nama');
        if (namaField) {
            namaField.value = user.name;
            namaField.readOnly = true;
        }

        // Set user_id hidden field
        const userIdField = document.getElementById('form_user_id');
        if (userIdField) userIdField.value = user.id || '';
    }
}

// =====================
// Utility Functions
// =====================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('.eye-icon');
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.title = 'Sembunyikan Password';
        icon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        input.type = 'password';
        btn.title = 'Lihat Password';
        icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        `;
    }
}

function formatDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (toastMessage) {
        toastMessage.textContent = message;
    }
    
    if (toast) {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// =====================
// Event Listeners
// =====================
document.addEventListener('DOMContentLoaded', function() {
    // Initialize TomSelect for dropdowns if available
    if (typeof TomSelect !== 'undefined') {
        const selectEls = ['#divisi', '#jabatan', '#periode'];
        selectEls.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) {
                new TomSelect(el, {
                    create: false,
                    sortField: {
                        field: "text",
                        direction: "asc"
                    }
                });
            }
        });
    }

    // Check auth
    checkAuth();

    // Show/hide role-based elements (run on all pages)
    const user = getCurrentUser();
    if (user) {
        // Show/hide K3 elements
        const k3Elements = document.querySelectorAll('.k3-only');
        k3Elements.forEach(el => {
            if (user.role === 'k3') {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });

        // Show/hide User elements
        const userElements = document.querySelectorAll('.user-only');
        userElements.forEach(el => {
            if (user.role === 'user') {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });
    }

    // Login page
    if (document.getElementById('loginForm')) {
        // Set focus on username
        document.getElementById('username').focus();
    }

    // Dashboard page
    if (document.getElementById('assessmentTable')) {
        const user = getCurrentUser();

        // Load data from Supabase first with proper filtering
        fetchAssessmentsFromSupabase().then(() => {
            updateStats();
            populateDivisiFilter();
            renderAssessments();

            // Render charts for K3
            if (user.role === 'k3') {
                setTimeout(renderCharts, 100);
            }
        });

        // Event listeners
        const searchInput = document.getElementById('searchInput');
        const filterDivisi = document.getElementById('filterDivisi');
        const sortValue = document.getElementById('sortValue');

        if (searchInput) {
            searchInput.addEventListener('input', renderAssessments);
        }
        if (filterDivisi) {
            filterDivisi.addEventListener('change', renderAssessments);
        }
        if (sortValue) {
            sortValue.addEventListener('change', renderAssessments);
        }

        // Update user info in header
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                        ${user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #1f2937;">${user.name}</div>
                        <div style="font-size: 0.75rem; color: #6b7280; text-transform: capitalize;">${user.role}</div>
                    </div>
                    <button onclick="handleLogout()" style="margin-left: 0.5rem; padding: 0.5rem; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer; color: #6b7280;" title="Logout">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5m0 0l-5 5m5-5v-8"/>
                        </svg>
                    </button>
                </div>
            `;
        }
    }

    // Form page
    if (document.getElementById('assessmentForm')) {
        const user = getCurrentUser();
        if (user) {
            // Check for edit mode from URL
            const urlParams = new URLSearchParams(window.location.search);
            const editId = urlParams.get('id');

            if (editId) {
                // Edit mode: Load specific assessment by ID from Supabase
                fetchAndLoadAssessmentById(editId);
            } else {
                // Create mode: Directly reset form with defaults
                resetForm();
            }
        }

        // Close modal on outside click
        document.addEventListener('click', function(e) {
            const modal = document.getElementById('detailModal');
            if (e.target === modal || e.target.classList.contains('modal-overlay')) {
                closeModal();
            }
        });
    }

    // Close modal on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
});

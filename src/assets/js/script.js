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
} catch (e) {
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
// Export Excel Functions
// =====================

async function exportToExcel() {
    const user = getCurrentUser();
    if (user.role !== 'k3') {
        Swal.fire({
            icon: 'error',
            title: 'Akses Ditolak',
            text: 'Hanya user K3 yang dapat export data'
        });
        return;
    }

    try {
        Swal.fire({
            title: 'Memuat data...',
            text: 'Mohon tunggu sebentar',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // Fetch semua assessments dengan answers dari Supabase
        const assessments = await SupabaseAPI.get('assessments', {
            'select': '*,users(name),assessment_answers(*)',
            'order': 'created_at.desc'
        });

        if (!assessments || assessments.length === 0) {
            Swal.close();
            Swal.fire({
                icon: 'info',
                title: 'Tidak Ada Data',
                text: 'Tidak ada assessment untuk diexport'
            });
            return;
        }

        // Create workbook dengan dua sheets
        const wb = XLSX.utils.book_new();

        // === Sheet 1: Summary ===
        const summaryData = [
            [
                'No',
                'Nama Karyawan',
                'Divisi',
                'Jabatan',
                'Periode',
                'Tanggal Isi',
                'Ringkas (R1)',
                'Rapi (R2)',
                'Resik (R3)',
                'Rawat (R4)',
                'Rajin (R5)',
                'Total Skor',
                'Tgl Verifikasi K3'
            ]
        ];

        assessments.forEach((a, index) => {
            summaryData.push([
                index + 1,
                a.users?.name || '-',
                a.divisi || '-',
                a.jabatan || '-',
                a.periode || '-',
                formatDate(a.created_at),
                parseFloat(a.r1_score || 0).toFixed(1),
                parseFloat(a.r2_score || 0).toFixed(1),
                parseFloat(a.r3_score || 0).toFixed(1),
                parseFloat(a.r4_score || 0).toFixed(1),
                parseFloat(a.r5_score || 0).toFixed(1),
                parseFloat(a.total_score || 0).toFixed(1),
                a.k3_verified_at ? formatDate(a.k3_verified_at) : 'Belum diverifikasi'
            ]);
        });

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        // === Sheet 2: Detail ===
        const detailData = [
            [
                'No',
                'Nama Karyawan',
                'Divisi',
                'Jabatan',
                'Aspek',
                'Kode Pertanyaan',
                'Pertanyaan',
                'Score Asli',
                'Score K3',
                'Keterangan'
            ]
        ];

        const questionsMap = {
            'R1': [
                { code: 'q1_1', text: 'Apakah barang di area/meja kerja sesuai pekerjaan?' },
                { code: 'q1_2', text: 'Apakah dokumen dalam map atau odner masih dalam masa simpan yang berlaku?' },
                { code: 'q1_3', text: 'Apakah peralatan kerja dalam kondisi baik dan digunakan?' },
                { code: 'q1_4', text: 'Apakah karyawan memahami cara membuang barang tidak terpakai atau arsip yang sudah melewati masa simpan?' },
                { code: 'q1_5', text: 'Apakah barang dan inventaris sudah disimpan di tempatnya dan sesuai kebutuhan?' }
            ],
            'R2': [
                { code: 'q2_1', text: 'Apakah pelabelan sudah lengkap dan memudahkan identifikasi barang?' },
                { code: 'q2_2', text: 'Apakah barang, arsip, dan inventaris sudah tertata rapi dan sesuai penempatannya?' },
                { code: 'q2_3', text: 'Apakah tempat penyimpanan memudahkan pencarian barang?' },
                { code: 'q2_4', text: 'Apakah barang di area / meja kerja milik seluruh karyawan divisi telah tertata rapi?' },
                { code: 'q2_5', text: 'Apakah layout zonasi dan letak penyimpanan sudah ada dan diterapkan di area kerja?' }
            ],
            'R3': [
                { code: 'q3_1', text: 'Apakah area kerja (lantai, dinding, langit-langit, dan meja) sudah bersih dan bebas debu/kotoran?' },
                { code: 'q3_2', text: 'Apakah peralatan kerja telah bersih, bebas debu, dan kotoran?' },
                { code: 'q3_3', text: 'Apakah peralatan makan dalam kondisi bersih dan tempat sampah tidak menumpuk serta tidak ada sampah di sekitarnya?' },
                { code: 'q3_4', text: 'Apakah karyawan telah membiasakan resik sebelum, selama, dan sesudah kerja?' },
                { code: 'q3_5', text: 'Apakah ada sistem di tiap divisi untuk mendorong karyawan menjaga kebersihan area kerja?' }
            ],
            'R4': [
                { code: 'q4_1', text: 'Apakah kendali visual terhadap potensi bahaya (simbol, rambu, marka) sudah diterapkan pada semua alat, mesin, dan sarana kerja?' },
                { code: 'q4_2', text: 'Apakah seluruh peralatan, fasilitas, dan area kerjanya dalam kondisi terawat?' }
            ],
            'R5': [
                { code: 'q5_1', text: 'Apakah seluruh karyawan telah menerapkan 4R sebelumnya terhadap peralatan, fasilitas, dan area kerjanya?' },
                { code: 'q5_2', text: 'Apakah sikap kerja semua personel pada area kerja sudah menunjukkan kebiasaan positif (atribut kerja, tepat waktu, disiplin, dan sebagainya)?' },
                { code: 'q5_3', text: 'Apakah karyawan divisi bersedia melaksanakan kegiatan 5R secara konsisten dan berkesinambungan?' },
                { code: 'q5_4', text: 'Apakah sudah ada pertemuan atau evaluasi (PDCA) berkala untuk meningkatkan hasil penerapan 5R?' },
                { code: 'q5_5', text: 'Apakah ada upaya perbaikan berkesinambungan (continual improvement) dalam penerapan 5R?' }
            ]
        };

        const aspectNames = {
            'R1': 'Ringkas',
            'R2': 'Rapi',
            'R3': 'Resik',
            'R4': 'Rawat',
            'R5': 'Rajin'
        };

        let detailIndex = 1;
        assessments.forEach(a => {
            const answers = a.assessment_answers || [];
            const aspects = ['R1', 'R2', 'R3', 'R4', 'R5'];

            aspects.forEach(aspect => {
                const questions = questionsMap[aspect] || [];
                questions.forEach(q => {
                    const answer = answers.find(ans => ans.question_code === q.code);
                    detailData.push([
                        detailIndex++,
                        a.users?.name || '-',
                        a.divisi || '-',
                        a.jabatan || '-',
                        aspectNames[aspect] || aspect,
                        q.code,
                        q.text,
                        answer ? answer.score : '-',
                        answer ? (answer.score_k3 || '-') : '-',
                        answer?.explanation || ''
                    ]);
                });
            });
        });

        const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
        XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail');

        // Generate filename dengan timestamp
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 10);
        const filename = `Assessment_SAFE_${timestamp}.xlsx`;

        // Download file
        XLSX.writeFile(wb, filename);

        Swal.close();
        Swal.fire({
            icon: 'success',
            title: 'Export Berhasil',
            text: `File ${filename} berhasil diunduh`,
            timer: 2000,
            showConfirmButton: false
        });

    } catch (e) {
        console.error('Error exporting to Excel:', e);
        Swal.close();
        Swal.fire({
            icon: 'error',
            title: 'Gagal Export',
            text: 'Terjadi kesalahan: ' + e.message
        });
    }
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
             <button class="btn btn-sm btn-info" onclick="openK3VerifModal('${a.id}')" title="Verifikasi K3">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </button>
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
    if (barChartInstance) barChartInstance.destroy();

    const ctx = document.getElementById('barChart').getContext('2d');

    const labels = ['Ringkas', 'Rapi', 'Resik', 'Rawat', 'Rajin'];
    const values = [avgScores.r1, avgScores.r2, avgScores.r3, avgScores.r4, avgScores.r5];
    const colors = ['#1e6fdc', '#10b981', '#06b6d4', '#f59e0b', '#7c3aed'];
    const lightColors = ['rgba(30,111,220,.12)', 'rgba(16,185,129,.12)', 'rgba(6,182,212,.12)', 'rgba(245,158,11,.12)', 'rgba(124,58,237,.12)'];

    // Update avg badge
    const avgBadge = document.getElementById('avgTotalBadge');
    if (avgBadge) avgBadge.textContent = 'Avg: ' + avgScores.total.toFixed(1);

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Rata-rata Skor',
                data: values,
                backgroundColor: colors.map((c, i) => lightColors[i]),
                borderColor: colors,
                borderWidth: 2.5,
                borderRadius: 10,
                borderSkipped: false,
                hoverBackgroundColor: colors.map(c => c + 'cc')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#94a3b8',
                    bodyColor: '#fff',
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: ctx => ' ' + ctx.parsed.y.toFixed(1) + ' / 100'
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 12, weight: '600' }, color: '#475569' }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,.06)', drawBorder: false },
                    ticks: {
                        font: { size: 11 },
                        color: '#94a3b8',
                        callback: v => v
                    },
                    border: { display: false }
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
    if (pieChartInstance) pieChartInstance.destroy();

    const divisiData = {};
    assessments.forEach(a => {
        divisiData[a.divisi] = (divisiData[a.divisi] || 0) + 1;
    });

    const labels = Object.keys(divisiData);
    const values = Object.values(divisiData);
    const total = values.reduce((s, v) => s + v, 0);

    const COLORS = [
        '#1e6fdc','#10b981','#06b6d4','#f59e0b','#7c3aed',
        '#ef4444','#ec4899','#14b8a6','#84cc16','#f97316',
        '#0ea5e9','#a855f7'
    ];

    // Update badge
    const badge = document.getElementById('totalDivisiCount');
    if (badge) badge.textContent = labels.length + ' Divisi';

    // Build custom legend
    const legendEl = document.getElementById('donutLegend');
    if (legendEl) {
        legendEl.innerHTML = labels.map((lbl, i) => `
            <div class="db-legend-item">
                <div class="db-legend-dot" style="background:${COLORS[i % COLORS.length]}"></div>
                <span class="db-legend-name">${lbl}</span>
                <span class="db-legend-count">${values[i]}</span>
            </div>
        `).join('');
    }

    const ctx = document.getElementById('pieChart').getContext('2d');
    pieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: COLORS.slice(0, labels.length),
                hoverBackgroundColor: COLORS.slice(0, labels.length).map(c => c + 'dd'),
                borderWidth: 3,
                borderColor: '#ffffff',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#94a3b8',
                    bodyColor: '#fff',
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.raw} (${((ctx.raw/total)*100).toFixed(1)}%)`
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText',
            afterDraw(chart) {
                const { ctx, chartArea: { width, height, left, top } } = chart;
                ctx.save();
                const cx = left + width / 2;
                const cy = top + height / 2;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 22px Inter, sans-serif';
                ctx.fillText(total, cx, cy - 10);
                ctx.fillStyle = '#94a3b8';
                ctx.font = '11px Inter, sans-serif';
                ctx.fillText('Total', cx, cy + 12);
                ctx.restore();
            }
        }]
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

// =====================
// K3 Verification Functions
// =====================
let currentK3VerifAssessmentId = null;
let currentK3VerifAnswers = null; // Simpan answers untuk diakses di submitK3Verification
const K3_ALLOWED_SCORES = [25, 50, 75, 100];

async function openK3VerifModal(assessmentId) {
    currentK3VerifAssessmentId = assessmentId;

    try {
        Swal.fire({
            title: 'Memuat data...',
            text: 'Mohon tunggu sebentar',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // Fetch assessment dengan answers dari Supabase
        const assessment = await SupabaseAPI.get('assessments', {
            'id': `eq.${assessmentId}`,
            'select': '*,assessment_answers(*,assessment_photos(*))'
        });

        if (!assessment || assessment.length === 0) {
            Swal.close();
            Swal.fire('Error', 'Assessment tidak ditemukan', 'error');
            return;
        }

        const data = assessment[0];
        const answers = data.assessment_answers || [];

        // Simpan answers ke variabel global
        currentK3VerifAnswers = answers;

        Swal.close();

        // Render modal dengan pertanyaan dan field score_k3
        renderK3VerifModal(data, answers);

        document.getElementById('k3VerifModal').classList.add('active');
    } catch (e) {
        console.error('Error loading assessment for K3 verification:', e);
        Swal.close();
        Swal.fire('Error', 'Gagal memuat data: ' + e.message, 'error');
    }
}

function getAspectGradient(aspectCode) {
    const gradients = {
        'R1': '#6366f1, #4f46e5',
        'R2': '#10b981, #059669',
        'R3': '#06b6d4, #0891b2',
        'R4': '#f59e0b, #d97706',
        'R5': '#8b5cf6, #7c3aed'
    };
    return gradients[aspectCode] || '#6366f1, #4f46e5';
}

function renderK3VerifModal(assessment, answers) {
    const modalBody = document.getElementById('k3VerifModalBody');

    const questionsMap = {
        'R1': [
            { code: 'q1_1', question: 'Apakah barang di area/meja kerja sesuai pekerjaan?' },
            { code: 'q1_2', question: 'Apakah dokumen dalam map atau odner masih dalam masa simpan yang berlaku?' },
            { code: 'q1_3', question: 'Apakah peralatan kerja dalam kondisi baik dan digunakan?' },
            { code: 'q1_4', question: 'Apakah karyawan memahami cara membuang barang tidak terpakai atau arsip yang sudah melewati masa simpan?' },
            { code: 'q1_5', question: 'Apakah barang dan inventaris sudah disimpan di tempatnya dan sesuai kebutuhan?' }
        ],
        'R2': [
            { code: 'q2_1', question: 'Apakah pelabelan sudah lengkap dan memudahkan identifikasi barang?' },
            { code: 'q2_2', question: 'Apakah barang, arsip, dan inventaris sudah tertata rapi dan sesuai penempatannya?' },
            { code: 'q2_3', question: 'Apakah tempat penyimpanan memudahkan pencarian barang?' },
            { code: 'q2_4', question: 'Apakah barang di area / meja kerja milik seluruh karyawan divisi telah tertata rapi?' },
            { code: 'q2_5', question: 'Apakah layout zonasi dan letak penyimpanan sudah ada dan diterapkan di area kerja?' }
        ],
        'R3': [
            { code: 'q3_1', question: 'Apakah area kerja (lantai, dinding, langit-langit, dan meja) sudah bersih dan bebas debu/kotoran?' },
            { code: 'q3_2', question: 'Apakah peralatan kerja telah bersih, bebas debu, dan kotoran?' },
            { code: 'q3_3', question: 'Apakah peralatan makan dalam kondisi bersih dan tempat sampah tidak menumpuk serta tidak ada sampah di sekitarnya?' },
            { code: 'q3_4', question: 'Apakah karyawan telah membiasakan resik sebelum, selama, dan sesudah kerja?' },
            { code: 'q3_5', question: 'Apakah ada sistem di tiap divisi untuk mendorong karyawan menjaga kebersihan area kerja?' }
        ],
        'R4': [
            { code: 'q4_1', question: 'Apakah kendali visual terhadap potensi bahaya (simbol, rambu, marka) sudah diterapkan pada semua alat, mesin, dan sarana kerja?' },
            { code: 'q4_2', question: 'Apakah seluruh peralatan, fasilitas, dan area kerjanya dalam kondisi terawat?' }
        ],
        'R5': [
            { code: 'q5_1', question: 'Apakah seluruh karyawan telah menerapkan 4R sebelumnya terhadap peralatan, fasilitas, dan area kerjanya?' },
            { code: 'q5_2', question: 'Apakah sikap kerja semua personel pada area kerja sudah menunjukkan kebiasaan positif (atribut kerja, tepat waktu, disiplin, dan sebagainya)?' },
            { code: 'q5_3', question: 'Apakah karyawan divisi bersedia melaksanakan kegiatan 5R secara konsisten dan berkesinambungan?' },
            { code: 'q5_4', question: 'Apakah sudah ada pertemuan atau evaluasi (PDCA) berkala untuk meningkatkan hasil penerapan 5R?' },
            { code: 'q5_5', question: 'Apakah ada upaya perbaikan berkesinambungan (continual improvement) dalam penerapan 5R?' }
        ]
    };

    const aspectNames = {
        'R1': 'Aspek Ringkas',
        'R2': 'Aspek Rapi',
        'R3': 'Aspek Resik',
        'R4': 'Aspek Rawat',
        'R5': 'Aspek Rajin'
    };

    let html = `
        <div style="margin-bottom: 1rem; padding: 1rem; background: #f3f4f6; border-radius: 8px;">
            <strong>${escapeHtml(assessment.nama)}</strong> - ${escapeHtml(assessment.divisi)} - ${escapeHtml(assessment.jabatan)}
        </div>
    `;

    // Loop setiap aspek
    for (const [aspectCode, questions] of Object.entries(questionsMap)) {
        html += `
            <div class="verif-aspect-section" style="margin-bottom: 2rem;">
                <h4 style="padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; color: white; background: linear-gradient(135deg, ${getAspectGradient(aspectCode)});">
                    ${aspectNames[aspectCode]}
                </h4>
                <div class="verif-questions-grid">
        `;

        // Loop setiap pertanyaan
        questions.forEach(q => {
            const answer = answers.find(a => a.question_code === q.code);
            const originalScore = answer ? answer.score : 0;
            const k3Score = answer ? (answer.score_k3 || originalScore) : originalScore;
            const k3ScoreOptions = K3_ALLOWED_SCORES.map(score => `
                                <option value="${score}" ${Number(k3Score) === score ? 'selected' : ''}>${score}</option>
                            `).join('');

            // Pre-calculate photo paths for the modal
            const photoPaths = answer?.assessment_photos ? answer.assessment_photos.map(p => p.file_path) : [];
            const photoPathsJson = JSON.stringify(photoPaths).replace(/"/g, '&quot;');

            html += `
                <div class="verif-question-card" style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                    <div style="margin-bottom: 0.75rem;">
                        <span style="font-size: 0.75rem; background: #6b7280; color: white; padding: 2px 8px; border-radius: 4px;">${q.code}</span>
                        <p style="margin: 0.5rem 0 0; font-size: 0.875rem;">${q.question}</p>
                    </div>

                    <!-- Photo Preview -->
                    ${answer?.assessment_photos && answer.assessment_photos.length > 0 ? `
                    <div class="verif-photos-preview" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; overflow-x: auto; padding-bottom: 0.5rem;">
                        ${answer.assessment_photos.map((p, idx) => {
                            const imgSrc = SupabaseAPI.getPublicUrl('5r-assesment', p.file_path);
                            return `
                                <div style="width: 100px; height: 100px; border-radius: 6px; overflow: hidden; flex-shrink: 0; border: 1px solid #e5e7eb; cursor: pointer; background: #f8fafc;"
                                     onclick="openK3PhotoModal(${photoPathsJson}, ${idx})">
                                    <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: contain;" alt="Preview">
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ` : `
                    <div style="margin-bottom: 1rem; font-size: 0.75rem; color: #94a3b8; font-style: italic;">
                        Tidak ada foto
                    </div>
                    `}
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="font-size: 0.75rem; color: #6b7280; display: block;">Score Asli</label>
                            <input type="text" value="${originalScore}" readonly style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; background: #f9fafb;">
                        </div>
                        <div>
                            <label style="font-size: 0.75rem; color: #374151; font-weight: 600; display: block;">Score K3 <span class="required">*</span></label>
                            <select class="k3-score-input" data-question-code="${q.code}" data-answer-id="${answer?.id || ''}" required
                                    style="width: 100%; padding: 0.5rem; border: 1px solid #3b82f6; border-radius: 4px; font-weight: 600; background: white;">
                                ${k3ScoreOptions}
                            </select>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }

    modalBody.innerHTML = html;
}

function closeK3VerifModal() {
    document.getElementById('k3VerifModal').classList.remove('active');
    currentK3VerifAssessmentId = null;
    currentK3VerifAnswers = null;
}

async function submitK3Verification() {
    if (!currentK3VerifAssessmentId) return;
    if (!currentK3VerifAnswers) {
        Swal.fire('Error', 'Data answers tidak tersedia', 'error');
        return;
    }

    console.log('currentK3VerifAnswers:', currentK3VerifAnswers);

    // Collect all K3 scores
    const k3ScoreInputs = document.querySelectorAll('.k3-score-input');
    const updates = [];

    for (const input of k3ScoreInputs) {
        const questionCode = input.dataset.questionCode;
        const answerId = input.dataset.answerId;
        const scoreK3 = parseInt(input.value);

        console.log(`Input: question=${questionCode}, answerId=${answerId}, score=${scoreK3}`);

        if (!K3_ALLOWED_SCORES.includes(scoreK3)) {
            input.focus();
            Swal.fire({
                icon: 'warning',
                title: 'Score K3 Tidak Valid',
                text: 'Score K3 hanya boleh bernilai 25, 50, 75, atau 100.',
                confirmButtonColor: '#6366f1'
            });
            return;
        }

        if (answerId && !isNaN(scoreK3)) {
            updates.push({
                id: answerId,
                question_code: questionCode,
                score_k3: scoreK3
            });
        }
    }

    console.log('Updates to send:', updates);

    if (updates.length === 0) {
        Swal.fire('Info', 'Tidak ada data untuk disimpan', 'info');
        return;
    }

    try {
        Swal.fire({
            title: 'Menyimpan...',
            text: 'Mohon tunggu sebentar',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // Update setiap answer dengan score_k3 (loop karena Supabase tidak support bulk update langsung)
        for (const update of updates) {
            console.log(`Updating answer ${update.id} with score_k3=${update.score_k3}`);
            await SupabaseAPI.patch('assessment_answers', { score_k3: update.score_k3 }, { 'id': `eq.${update.id}` });
        }

        // Update assessment dengan total_score
        // Rumus: rata-rata dari (score asli + (score_k3 x 2))
        let totalOriginalScore = 0;
        let totalK3Score = 0;
        const totalQuestions = updates.length;
        let allHaveK3Score = true;

        for (const update of updates) {
            totalK3Score += update.score_k3;
            // Ambil original score dari currentK3VerifAnswers
            const answer = currentK3VerifAnswers.find(a => a.id === update.id);
            if (answer) {
                totalOriginalScore += (answer.score || 0);
            }
        }

        const averageK3Score = totalK3Score / totalQuestions;

        // Hanya hitung total_score jika semua sudah memiliki score_k3
        const updateData = {
            k3_verified_at: new Date().toISOString()
        };

        if (allHaveK3Score) {
            const averageOriginalScore = totalOriginalScore / totalQuestions;
            // Rumus: (rata-rata_score_asli + (rata-rata_score_k3 x 2)) / 2
            updateData.total_score = (averageOriginalScore + (averageK3Score * 2)) / 2;
        }

        await SupabaseAPI.patch('assessments', updateData, { 'id': `eq.${currentK3VerifAssessmentId}` });

        Swal.close();
        closeK3VerifModal();
        showToast('Verifikasi K3 berhasil disimpan');
        renderAssessments(true); // Refresh table
    } catch (e) {
        console.error('Error saving K3 verification:', e);
        Swal.close();
        Swal.fire('Error', 'Gagal menyimpan verifikasi: ' + e.message, 'error');
    }
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
        foto1_4: getStoredImage('foto1_4'),
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

function getEmptyRequiredTextarea() {
    return Array.from(document.querySelectorAll('textarea[required]'))
        .find(textarea => textarea.value.trim() === '');
}

function showRequiredTextareaAlert(textarea) {
    if (!textarea) {
        return;
    }

    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    textarea.focus({ preventScroll: true });

    Swal.fire({
        icon: 'warning',
        title: 'Text Area Wajib Diisi',
        text: 'Mohon lengkapi kolom penjelasan sebelum submit.',
        confirmButtonColor: '#6366f1'
    });
}

async function handleSubmit(event) {
    event.preventDefault();

    const emptyTextarea = getEmptyRequiredTextarea();
    if (emptyTextarea) {
        showRequiredTextareaAlert(emptyTextarea);
        return;
    }

    // Validasi semua field foto wajib diisi
    const photoValidation = validatePhotoFields();
    if (!photoValidation.isValid) {
        // Scroll ke first missing field
        const firstMissingField = document.querySelector(`[data-field="${photoValidation.missingFields[0]}"]`);
        if (firstMissingField) {
            firstMissingField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Highlight missing fields
        highlightMissingPhotoFields(photoValidation.missingFields);

        // Show warning message
        const missingCount = photoValidation.missingFields.length;
        Swal.fire({
            icon: 'warning',
            title: 'Foto Wajib Diisi',
            text: `Ada ${missingCount} field foto yang belum diisi. Mohon lengkapi sebelum submit.`,
            confirmButtonColor: '#6366f1'
        });
        return;
    }

    Swal.fire({
        title: 'Menyimpan...',
        text: 'Mohon tunggu sebentar',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const data = getFormData();

        // 1. Save to assessments table
        // total_score tidak disimpan di sini karena belum ada score_k3
        // total_score akan dihitung setelah K3 melakukan verifikasi
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
            r5_score: data.scores.r5
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

                    // 3. Upload photos to storage for this question
                    const photoKey = `foto${qCode.replace('q', '')}`;
                    const photos = data[photoKey] || [];

                    const uploadedPhotos = [];
                    for (let i = 0; i < photos.length; i++) {
                        const photoData = photos[i];
                        if (photoData.startsWith('data:')) {
                            // Jika data adalah base64, upload ke storage
                            const fileName = `photo_${qCode}_${Date.now()}_${i}.jpg`;
                            const filePath = `assessments/${assessment_id}/${fileName}`;

                            try {
                                await SupabaseAPI.uploadFile('5r-assesment', filePath, photoData);
                                uploadedPhotos.push({
                                    file_path: filePath,
                                    file_name: fileName,
                                    file_size: Math.round(photoData.length * 0.75)
                                });
                            } catch (uploadError) {
                                console.error('Error uploading photo:', uploadError);
                                // Tetap simpan record tapi mungkin kosong atau handle error
                            }
                        } else {
                            // Jika data sudah berupa path (misal saat edit), gunakan path tersebut
                            uploadedPhotos.push({
                                file_path: photoData,
                                file_name: photoData.split('/').pop(),
                                file_size: 0
                            });
                        }
                    }
                    photosByAnswerIndex[answerIndex] = uploadedPhotos;
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
                        file_path: photo.file_path, // Path di storage
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
        'foto1_1', 'foto1_2', 'foto1_3', 'foto1_4', 'foto1_5',
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

// Photo modal state
let currentPhotoModal = {
    images: [],
    currentIndex: 0,
    field: ''
};

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
    } catch (e) {
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
            reader.onload = function (e) {
                // Compress image to save localStorage space
                const img = new Image();
                img.onload = function () {
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
        try { images = JSON.parse(imagesStrOrArr); } catch (e) { images = [imagesStrOrArr]; }
    } else {
        images = imagesStrOrArr || [];
    }

    if (images.length === 0) {
        preview.innerHTML = '';
        preview.classList.remove('has-image');
        return;
    }

    preview.innerHTML = `<div class="photo-grid">
        ${images.map((imgData, idx) => {
        const imgSrc = imgData.startsWith('data:') ? imgData : SupabaseAPI.getPublicUrl('5r-assesment', imgData);
        return `
            <div class="photo-item" onclick="openPhotoModal('${field}', ${idx})">
                <img src="${imgSrc}" alt="Preview">
                <button type="button" class="remove-btn" onclick="event.stopPropagation(); removeImageIndex('${field}', ${idx})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            `;
    }).join('')}
    </div>`;
    preview.classList.add('has-image');
}

// Open photo modal with full size image
function openPhotoModal(field, index) {
    let images = [];
    try {
        const stored = sessionStorage.getItem(field);
        if (stored) {
            images = JSON.parse(stored);
            if (!Array.isArray(images)) images = [images];
        }
    } catch (e) {
        const stored = sessionStorage.getItem(field);
        if (stored) images = [stored];
    }

    if (images.length === 0) return;

    currentPhotoModal = {
        images: images,
        currentIndex: index,
        field: field
    };

    updatePhotoModal();
    document.getElementById('photoModal').classList.add('active');
}

function updatePhotoModal() {
    const { images, currentIndex } = currentPhotoModal;
    const modalImg = document.getElementById('photoModalImage');
    const modalCounter = document.getElementById('photoModalCounter');
    const prevBtn = document.getElementById('photoModalPrev');
    const nextBtn = document.getElementById('photoModalNext');

    const imgSrc = images[currentIndex].startsWith('data:') ? images[currentIndex] : SupabaseAPI.getPublicUrl('5r-assesment', images[currentIndex]);
    modalImg.src = imgSrc;
    modalCounter.textContent = `${currentIndex + 1} / ${images.length}`;

    prevBtn.style.display = currentIndex > 0 ? 'flex' : 'none';
    nextBtn.style.display = currentIndex < images.length - 1 ? 'flex' : 'none';
}

function closePhotoModal() {
    document.getElementById('photoModal').classList.remove('active');
    currentPhotoModal = { images: [], currentIndex: 0, field: '' };
}

function navigatePhotoModal(direction) {
    const { images, currentIndex } = currentPhotoModal;
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < images.length) {
        currentPhotoModal.currentIndex = newIndex;
        updatePhotoModal();
    }
}

// Special function for K3 verif modal photos
function openK3PhotoModal(images, index) {
    if (!images || images.length === 0) return;
    
    currentPhotoModal = {
        images: images,
        currentIndex: index,
        field: ''
    };

    updatePhotoModal();
    document.getElementById('photoModal').classList.add('active');
}

// Global escape key listener for modals
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closePhotoModal();
        // Also close other modals if needed
        if (document.getElementById('k3VerifModal')) {
            document.getElementById('k3VerifModal').classList.remove('active');
        }
        if (document.getElementById('detailModal')) {
            document.getElementById('detailModal').classList.remove('active');
        }
    }
});

function removeImageIndex(field, index) {
    let images = [];
    try {
        images = JSON.parse(sessionStorage.getItem(field) || '[]');
        if (!Array.isArray(images)) images = [images];
    } catch (e) {
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
    } catch (e) {
        return [val];
    }
}

// Function to get all photo fields for validation
function getAllPhotoFields() {
    return [
        'foto1_1', 'foto1_2', 'foto1_3', 'foto1_4', 'foto1_5',
        'foto2_1', 'foto2_2', 'foto2_3', 'foto2_4', 'foto2_5',
        'foto3_1', 'foto3_2', 'foto3_3', 'foto3_4', 'foto3_5',
        'foto4_1', 'foto4_2'
    ];
}

// Function to validate all photo fields
function validatePhotoFields() {
    const photoFields = getAllPhotoFields();
    const missingFields = [];

    photoFields.forEach(field => {
        const images = getStoredImage(field);
        if (images.length === 0) {
            missingFields.push(field);
        }
    });

    return {
        isValid: missingFields.length === 0,
        missingFields: missingFields
    };
}

// Function to highlight missing photo fields
function highlightMissingPhotoFields(missingFields) {
    // Remove all previous highlights
    document.querySelectorAll('.photo-missing').forEach(el => {
        el.classList.remove('photo-missing');
    });

    // Add highlight to missing fields
    missingFields.forEach(field => {
        const uploadContainer = document.querySelector(`[data-field="${field}"]`);
        if (uploadContainer) {
            uploadContainer.classList.add('photo-missing');
        }
    });
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
        'foto1_1', 'foto1_2', 'foto1_3', 'foto1_4', 'foto1_5',
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
document.addEventListener('DOMContentLoaded', function () {
    // Close photo modal on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closePhotoModal();
        }
    });

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
                el.style.display = 'block';
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
    const assessmentForm = document.getElementById('assessmentForm');
    if (assessmentForm) {
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

        let textareaAlertShown = false;
        assessmentForm.addEventListener('invalid', function (e) {
            if (!e.target.matches('textarea[required]')) {
                return;
            }

            e.preventDefault();
            if (textareaAlertShown) {
                return;
            }

            textareaAlertShown = true;
            showRequiredTextareaAlert(e.target);
            setTimeout(() => {
                textareaAlertShown = false;
            }, 500);
        }, true);

        // Close modal on outside click
        document.addEventListener('click', function (e) {
            const modal = document.getElementById('detailModal');
            if (e.target === modal || e.target.classList.contains('modal-overlay')) {
                closeModal();
            }
        });
    }

    // Close modal on escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
});

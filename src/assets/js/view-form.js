// =====================
// View Form Mode - Read Only with Scores
// =====================

let viewAssessmentData = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();

    // Get assessment ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const assessmentId = urlParams.get('id');

    if (!assessmentId) {
        Swal.fire({
            icon: 'error',
            title: 'ID Assessment Diperlukan',
            text: 'Silakan buka dari halaman dashboard'
        }).then(() => {
            window.location.href = 'index.html';
        });
        return;
    }

    // Load assessment data
    loadViewAssessment(assessmentId);

    // Initialize TomSelect for dropdowns (disabled mode)
    if (typeof TomSelect !== 'undefined') {
        const selectEls = ['#divisi', '#jabatan', '#periode'];
        selectEls.forEach(selector => {
            const el = document.querySelector(selector);
            if (el && !el.tomselect) {
                const ts = new TomSelect(el, {
                    create: false,
                    sortField: { field: "text", direction: "asc" }
                });
                ts.disable();
            }
        });
    }
});

async function loadViewAssessment(id) {
    Swal.fire({
        title: 'Memuat...',
        text: 'Mohon tunggu sebentar',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // Fetch assessment dengan answers dan photos dari Supabase
        const data = await SupabaseAPI.get('assessments', {
            'id': `eq.${id}`,
            'select': '*,users(name),assessment_answers(*,assessment_photos(*))'
        });

        if (!data || data.length === 0) {
            Swal.close();
            Swal.fire({
                icon: 'error',
                title: 'Tidak Ditemukan',
                text: 'Assessment tidak ditemukan'
            }).then(() => {
                window.location.href = 'index.html';
            });
            return;
        }

        viewAssessmentData = data[0];
        populateViewForm(viewAssessmentData);

        Swal.close();
    } catch (e) {
        console.error('Error loading assessment:', e);
        Swal.close();
        Swal.fire({
            icon: 'error',
            title: 'Gagal',
            text: 'Gagal memuat assessment: ' + e.message
        }).then(() => {
            window.location.href = 'index.html';
        });
    }
}

function populateViewForm(assessment) {
    // Basic Info
    const namaField = document.getElementById('nama');
    if (namaField) {
        namaField.value = assessment.users?.name || '-';
    }

    const divisiEl = document.getElementById('divisi');
    if (divisiEl) divisiEl.value = assessment.divisi || '-';

    const jabatanEl = document.getElementById('jabatan');
    if (jabatanEl) jabatanEl.value = assessment.jabatan || '-';

    const periodeEl = document.getElementById('periode');
    if (periodeEl) periodeEl.value = assessment.periode || '-';

    const representativeEl = document.getElementById('representative');
    if (representativeEl) representativeEl.checked = assessment.is_representative || false;

    // Update TomSelect values if available
    const divisiSelect = document.getElementById('divisi');
    const jabatanSelect = document.getElementById('jabatan');
    const periodeSelect = document.getElementById('periode');

    if (divisiSelect && divisiSelect.tomselect) divisiSelect.tomselect.setValue(assessment.divisi || '');
    if (jabatanSelect && jabatanSelect.tomselect) jabatanSelect.tomselect.setValue(assessment.jabatan || '');
    if (periodeSelect && periodeSelect.tomselect) periodeSelect.tomselect.setValue(assessment.periode || '');

    // Hitung skor asli dan skor K3 dari assessment_answers
    const aspectQuestions = {
        'R1': ['q1_1', 'q1_2', 'q1_3', 'q1_4', 'q1_5'],
        'R2': ['q2_1', 'q2_2', 'q2_3', 'q2_4', 'q2_5'],
        'R3': ['q3_1', 'q3_2', 'q3_3', 'q3_4', 'q3_5'],
        'R4': ['q4_1', 'q4_2'],
        'R5': ['q5_1', 'q5_2', 'q5_3', 'q5_4', 'q5_5']
    };

    const originalScores = { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0 };
    const k3Scores = { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0 };
    const answerCounts = { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0 };
    const k3AnswerCounts = { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0 };

    // Load answers dan hitung skor
    if (assessment.assessment_answers && Array.isArray(assessment.assessment_answers)) {
        assessment.assessment_answers.forEach(answer => {
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
                showPhotoPreview(photoField, photos);
            }

            // Hitung skor asli per aspek
            for (const [aspect, questions] of Object.entries(aspectQuestions)) {
                if (questions.includes(answer.question_code)) {
                    originalScores[aspect] += (answer.score || 0);
                    answerCounts[aspect]++;

                    // Hitung skor K3 jika ada
                    if (answer.score_k3 !== null && answer.score_k3 !== undefined) {
                        k3Scores[aspect] += answer.score_k3;
                        k3AnswerCounts[aspect]++;
                    }
                }
            }
        });
    }

    // Hitung rata-rata skor asli per aspek
    const avgOriginalScores = {
        R1: answerCounts.R1 > 0 ? originalScores.R1 / aspectQuestions.R1.length : 0,
        R2: answerCounts.R2 > 0 ? originalScores.R2 / aspectQuestions.R2.length : 0,
        R3: answerCounts.R3 > 0 ? originalScores.R3 / aspectQuestions.R3.length : 0,
        R4: answerCounts.R4 > 0 ? originalScores.R4 / aspectQuestions.R4.length : 0,
        R5: answerCounts.R5 > 0 ? originalScores.R5 / aspectQuestions.R5.length : 0
    };

    // Hitung rata-rata skor K3 per aspek
    const avgK3Scores = {
        R1: k3AnswerCounts.R1 > 0 ? k3Scores.R1 / aspectQuestions.R1.length : 0,
        R2: k3AnswerCounts.R2 > 0 ? k3Scores.R2 / aspectQuestions.R2.length : 0,
        R3: k3AnswerCounts.R3 > 0 ? k3Scores.R3 / aspectQuestions.R3.length : 0,
        R4: k3AnswerCounts.R4 > 0 ? k3Scores.R4 / aspectQuestions.R4.length : 0,
        R5: k3AnswerCounts.R5 > 0 ? k3Scores.R5 / aspectQuestions.R5.length : 0
    };

    // Tampilkan skor asli dan skor K3 untuk setiap aspek
    document.getElementById('originalScoreR1').textContent = avgOriginalScores.R1.toFixed(1);
    document.getElementById('originalScoreR2').textContent = avgOriginalScores.R2.toFixed(1);
    document.getElementById('originalScoreR3').textContent = avgOriginalScores.R3.toFixed(1);
    document.getElementById('originalScoreR4').textContent = avgOriginalScores.R4.toFixed(1);
    document.getElementById('originalScoreR5').textContent = avgOriginalScores.R5.toFixed(1);

    // Cek apakah ada skor K3 untuk semua aspek
    const allK3ScoresExist = Object.values(k3AnswerCounts).every(count => count > 0);

    if (allK3ScoresExist) {
        document.getElementById('k3ScoreR1').textContent = avgK3Scores.R1.toFixed(1);
        document.getElementById('k3ScoreR2').textContent = avgK3Scores.R2.toFixed(1);
        document.getElementById('k3ScoreR3').textContent = avgK3Scores.R3.toFixed(1);
        document.getElementById('k3ScoreR4').textContent = avgK3Scores.R4.toFixed(1);
        document.getElementById('k3ScoreR5').textContent = avgK3Scores.R5.toFixed(1);
    } else {
        document.getElementById('k3ScoreR1').textContent = '-';
        document.getElementById('k3ScoreR2').textContent = '-';
        document.getElementById('k3ScoreR3').textContent = '-';
        document.getElementById('k3ScoreR4').textContent = '-';
        document.getElementById('k3ScoreR5').textContent = '-';
    }

    // Tampilkan skor di header (menggunakan skor asli dari assessment table)
    const scores = {
        r1: parseFloat(assessment.r1_score || 0),
        r2: parseFloat(assessment.r2_score || 0),
        r3: parseFloat(assessment.r3_score || 0),
        r4: parseFloat(assessment.r4_score || 0),
        r5: parseFloat(assessment.r5_score || 0),
        total: parseFloat(assessment.total_score || 0)
    };

    // Display final scores with color (skor asli)
    setFinalScoreColor('finalScoreR1', scores.r1);
    setFinalScoreColor('finalScoreR2', scores.r2);
    setFinalScoreColor('finalScoreR3', scores.r3);
    setFinalScoreColor('finalScoreR4', scores.r4);
    setFinalScoreColor('finalScoreR5', scores.r5);

    // Total score
    const totalScoreEl = document.getElementById('finalScoreTotal');
    if (totalScoreEl) {
        if (scores.total === 0 || scores.total === null) {
            totalScoreEl.textContent = '-';
            // Tampilkan keterangan belum diverifikasi K3
            const totalScoreNote = document.getElementById('totalScoreNote');
            if (totalScoreNote) {
                totalScoreNote.style.display = 'block';
            }
        } else {
            totalScoreEl.textContent = scores.total.toFixed(1);
            const totalScoreNote = document.getElementById('totalScoreNote');
            if (totalScoreNote) {
                totalScoreNote.style.display = 'none';
            }
        }
    }

    // Scroll to first section
    document.getElementById('section0').scrollIntoView({ behavior: 'smooth' });
}

// Set final score color class based on value
function setFinalScoreColor(elementId, score) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Remove all color classes
    element.classList.remove('excellent', 'good', 'fair', 'poor');

    // Set text and add color class
    element.textContent = score.toFixed(1);

    if (score >= 90) {
        element.classList.add('excellent');
    } else if (score >= 70) {
        element.classList.add('good');
    } else if (score >= 50) {
        element.classList.add('fair');
    } else {
        element.classList.add('poor');
    }
}

// Show photo preview in view mode
function showPhotoPreview(field, images) {
    const preview = document.getElementById(`preview${field.replace('foto', '')}`);
    if (!preview) return;

    let imageArray = [];
    if (typeof images === 'string') {
        try { imageArray = JSON.parse(images); } catch(e) { imageArray = [images]; }
    } else {
        imageArray = Array.isArray(images) ? images : [];
    }

    if (imageArray.length === 0) {
        preview.innerHTML = '';
        preview.classList.remove('has-image');
        return;
    }

    preview.innerHTML = `<div class="photo-grid">
        ${imageArray.map((imgData, idx) => `
            <div class="photo-item">
                <img src="${imgData}" alt="Foto ${idx + 1}" onclick="window.open('${imgData}', '_blank')">
            </div>
        `).join('')}
    </div>`;
    preview.classList.add('has-image');
}

// Print function
function printAssessment() {
    Swal.fire({
        title: 'Mencetak...',
        text: 'Mohon tunggu sebentar',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    setTimeout(() => {
        Swal.close();
        window.print();
    }, 500);
}

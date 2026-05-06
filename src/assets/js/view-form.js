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

    // Build scores dari parent assessment
    const scores = {
        r1: parseFloat(assessment.r1_score || 0),
        r2: parseFloat(assessment.r2_score || 0),
        r3: parseFloat(assessment.r3_score || 0),
        r4: parseFloat(assessment.r4_score || 0),
        r5: parseFloat(assessment.r5_score || 0),
        total: parseFloat(assessment.total_score || 0)
    };

    // Display scores in section headers
    const scoreElements = {
        'scoreR1': scores.r1,
        'scoreR2': scores.r2,
        'scoreR3': scores.r3,
        'scoreR4': scores.r4,
        'scoreR5': scores.r5
    };

    for (const [id, score] of Object.entries(scoreElements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = score.toFixed(1);
    }

    // Display final scores with color
    setFinalScoreColor('finalScoreR1', scores.r1);
    setFinalScoreColor('finalScoreR2', scores.r2);
    setFinalScoreColor('finalScoreR3', scores.r3);
    setFinalScoreColor('finalScoreR4', scores.r4);
    setFinalScoreColor('finalScoreR5', scores.r5);

    // Total score keeps gradient style
    const totalScoreEl = document.getElementById('finalScoreTotal');
    if (totalScoreEl) {
        totalScoreEl.textContent = scores.total.toFixed(1);
    }

    // Load answers
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
        });
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

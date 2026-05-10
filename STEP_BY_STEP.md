# Langkah-Langkah Pembuatan Sistem SAFE
*(System for Area and Facility Evaluation)*

Dokumen ini menjelaskan alur kerja dan langkah-langkah teknis dalam membangun sistem SAFE.

## 1. Persiapan Struktur Proyek (Frontend Workflow)
Sistem ini menggunakan **Gulp** sebagai task runner untuk mengotomatisasi pengembangan.
*   **Asset Management**: Mengorganisir file ke dalam folder `src/assets` (CSS, JS, Img).
*   **Template Engine**: Menggunakan `gulp-file-include` untuk mengelola komponen yang berulang seperti `sidebar.html` dan `header.html`.
*   **Build System**: Menyiapkan folder `dist/` sebagai output siap pakai yang sudah ter-minify.

## 2. Setup Database & API (Supabase)
Sistem menggunakan **Supabase** sebagai Backend-as-a-Service (BaaS).
*   **Database Tables**: Membuat tabel `assessments`, `assessment_answers`, `assessment_photos`, dan `users`.
*   **Authentication**: Menggunakan fitur Auth Supabase untuk manajemen login (Admin K3 & User).
*   **Storage**: Menyiapkan bucket storage untuk menampung file dokumentasi foto yang di-upload.
*   **API Wrapper**: Membuat file `api.js` untuk membungkus fungsi-fungsi pengambilan data (GET, POST, DELETE, UPSERT).

## 3. Sistem Autentikasi (Login Page)
*   **UI/UX**: Membuat halaman login premium dengan layout panel (Kiri: Form, Kanan: Visual Hero).
*   **Logic**: Mengintegrasikan login dengan Supabase Auth.
*   **Session Management**: Menyimpan data user di `localStorage` untuk menjaga status login antar halaman.

## 4. Dashboard & Visualisasi Data
*   **Stats Grid**: Menampilkan ringkasan total assessment dan jumlah divisi terdaftar secara dinamis.
*   **Chart Integration**: Menggunakan **Chart.js** untuk menampilkan distribusi data per divisi dalam bentuk Donut Chart.
*   **Search & Filter**: Implementasi fitur pencarian real-time pada tabel assessment di dashboard.

## 5. Formulir Assessment Dinamis
Ini adalah bagian inti dari sistem SAFE.
*   **Input Handling**: Menangkap data dari berbagai tipe input (Radio, Textarea, Checkbox).
*   **Local Persistence**: Menggunakan `sessionStorage` agar data yang diisi tidak hilang jika halaman tidak sengaja ter-refresh.
*   **Multi-Image Upload**: Fitur unggah foto dokumentasi per pertanyaan dengan pratinjau langsung.
*   **Validation**: Memastikan semua field wajib (terutama foto) sudah terisi sebelum data dikirim.

## 6. Fitur Verifikasi Admin K3
Fitur khusus untuk role Admin agar dapat memberikan penilaian kedua.
*   **Verif Modal**: Membuat modal dinamis yang menampilkan jawaban user.
*   **Photo Preview**: Mengintegrasikan modal foto (Photo Modal) agar Admin bisa melihat bukti dokumentasi secara detail (Full Size) sebelum memberi skor.
*   **Scoring Logic**: Fitur input `score_k3` yang akan meng-update nilai asli jika diperlukan.

## 7. Ekspor Data ke Excel
*   Menggunakan library **SheetJS (XLSX)**.
*   Mengonversi data JSON dari database menjadi file `.xlsx` yang terstruktur rapi dengan header yang sesuai.
*   Penamaan file otomatis menggunakan timestamp (Contoh: `Assessment_SAFE_2026-05-10.xlsx`).

## 8. Branding & UI Refinement
*   **SAFE Rebranding**: Mengubah semua referensi dari "5R Assessment" menjadi "SAFE | System for Area and Facility Evaluation".
*   **Responsive Design**: Memastikan sistem dapat digunakan dengan nyaman di berbagai perangkat (Desktop, Tablet, Mobile).
*   **Interactivity**: Menambahkan micro-animations, hover effects, dan transisi modal yang halus untuk pengalaman pengguna yang premium.

---
*Dokumen ini dibuat sebagai panduan teknis pengembangan sistem SAFE.*

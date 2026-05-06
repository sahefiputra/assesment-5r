# Form K3

Proyek formulir K3 (Kesehatan dan Keselamatan Kerja) dengan sistem manajemen pengguna.

## Persyaratan

- Node.js (v14 atau lebih tinggi)
- npm
- PostgreSQL

## Instalasi

1. Clone repository ini:
   ```bash
   git clone <repository-url>
   cd form-k3
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup database PostgreSQL:
   - Buat database baru di PostgreSQL
   - Jalankan file `schema.sql` untuk membuat tabel users:
     ```bash
     psql -U your_username -d your_database -f schema.sql
     ```

## Struktur Proyek

```
form-k3/
├── dist/           # File hasil build
├── src/
│   ├── assets/     # CSS dan JS
│   ├── components/ # Komponen HTML yang dapat di-reuse
│   └── pages/      # Halaman-halaman utama
├── gulpfile.js     # Konfigurasi Gulp
├── package.json    # Dependencies dan scripts
└── schema.sql      # Schema database
```

## Menjalankan Proyek

### Mode Development

Menjalankan server development dengan auto-reload:

```bash
npm run dev
```

Ini akan:
- Build HTML dan assets
- Menjalankan server di `http://localhost:3000`
- Membuka browser secara otomatis
- Watch perubahan file dan reload otomatis

### Build Manual

Untuk build tanpa menjalankan server:

```bash
npx gulp
```

Atau build task tertentu:

```bash
# Hanya build HTML
npx gulp html

# Hanya copy assets
npx gulp assets
```

## Halaman Tersedia

| Halaman | Deskripsi |
|---------|-----------|
| `index.html` | Halaman depan |
| `login.html` | Halaman login |
| `form.html` | Formulir K3 |
| `users.html` | Manajemen pengguna |

## Database Schema

Tabel `users` memiliki field:
- `id` (bigint, auto-increment)
- `name` (varchar 100)
- `username` (varchar 50, unique)
- `password` (varchar 255)
- `role` (varchar 10) - nilai: 'user' atau 'k3'
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `email` (varchar, nullable)

## Catatan

- File-include digunakan dengan prefix `@@` untuk komponen yang dapat di-reuse
- Port default development server: 3000
- File hasil build akan tersimpan di folder `dist/`

# 🐘 Elephant Tracking System (GT02A / Protokol GT06)

Sistem Informasi Pelacakan dan Analitik Pergerakan Gajah Sumatera (*Elephant Tracking System*) berbasis perangkat **GPS Tracker GT02A (`XY03D-1-09404`)**, **Protokol Biner GT06**, **NestJS 11**, **MongoDB Atlas**, dan **React + Vite + Leaflet** dengan antarmuka **Soft Neumorphic & Electric Blue Gradient (Light & Dark Mode)**.

---

## ✨ Fitur Utama

1. **Penerimaan & Sinkronisasi Data Ganda (*Dual-Mode Ingestion*)**:
   * **GT06 Binary TCP Socket Listener (`Port 7018`)**: Menerima paket biner langsung dari perangkat GT02A mencakup *Login Packet* (`0x01`), *Location Packet* (`0x12`/`0x22`), dan *Heartbeat/Status Packet* (`0x13`) beserta balasan *Acknowledgement* (`ACK`) CRC-ITU otomatis.
   * **Dyegoo Cloud Auto-Sync Bridge**: Sinkronisasi otomatis posisi *real-time* (`GetTracking`) serta riwayat perjalanan penuh (`GetDevicesHistory`) langsung dari server perangkat fisik tanpa memerlukan konfigurasi SMS berulang atau *port-forwarding* manual.

2. **Visualisasi Peta Rute & *Interactive Route Playback Player***:
   * Menampilkan garis jejak perjalanan (*route polyline*) lengkap dengan penanda **Titik Awal (`S` Hijau)**, **Titik Waypoint Kecepatan (Biru & Oranye)**, serta **Posisi Akhir/Terkini (🐘 Biru Gradien)**.
   * **Pemutar Ulang Perjalanan (*Route Playback*)**: Animasi pergerakan *marker* menyusuri rute berdasarkan urutan waktu dengan tombol *Play/Pause*, *Time Scrubber Slider*, dan pengatur kecepatan putar (`1x`, `2x`, `5x`, `10x`).
   * **Filter Per Hari & Rentang Tanggal**: Memfilter perjalanan berdasarkan tanggal spesifik maupun keseluruhan riwayat.

3. **Pengolahan Data & Analitik Matematis Harian**:
   * **Jarak Tempuh Harian (`km`) dengan Rumus *Haversine***: Menghitung akumulasi jarak tempuh dari rangkaian titik koordinat lintang dan bujur.
   * **Luas Area Jelajah (*Home Range / Bounding Box*)**: Mengestimasi luas cakupan wilayah pergerakan harian dalam satuan **Hektar (`Ha`)** dan **$\text{km}^2$**.
   * **Statistik Kecepatan & Durasi**: Menghitung kecepatan rata-rata saat bergerak (*Average Moving Speed*), kecepatan puncak (*Max Speed*), serta durasi aktif bergerak vs diam.
   * **Rasio Kualitas Sinyal (`GPS Satelit` vs `LBS BTS`)**: Mengukur persentase titik koordinat yang dikunci oleh satelit GPS murni (`dataType = 1`) dibandingkan triangulasi menara BTS (`dataType = 2`).

4. **Keamanan, Multi-Tenancy, & Ekspor Laporan Skripsi**:
   * Autentikasi berbasis **JWT (`Passport-JWT`)**, `RolesGuard`, enkripsi kata sandi `bcrypt`, dan isolasi data *multi-tenant* (`companyGuid`).
   * Fitur **Ekspor CSV (Excel)** untuk tabel rekapitulasi analitik harian maupun log titik koordinat harian.

---

## 🏗️ Arsitektur & Tech Stack

| Lapisan | Teknologi |
| :--- | :--- |
| **Backend Framework** | NestJS v11 + TypeScript v5.7 |
| **Database & ODM** | MongoDB Atlas + Mongoose v8 |
| **TCP Listener & Parser** | Node.js `net.Server` (Protokol Biner GT06 + CRC16 ITU-T) |
| **Frontend Framework** | React 18 + Vite 6 + TypeScript |
| **Peta Geospasial** | Leaflet + React-Leaflet (OpenStreetMap & CartoDB Dark Matter) |
| **Desain UI/UX** | Tailwind CSS + Soft Neumorphic UI Kit (Light & Dark Mode) |
| **Validasi & Dokumentasi** | `class-validator`, `class-transformer`, Swagger OpenAPI (`/v1/docs`) |
| **Reverse Proxy** | Nginx (`nginx/nginx.conf`) |

```text
+-----------------------------------------------------------------------+
| Perangkat Fisik GPS Tracker GT02A (XY03D-1-09404)                     |
+-------------------+-----------------------------------+---------------+
                    |                                   |
      [Paket Biner GT06 via TCP]             [Dyegoo Cloud Bridge]
                    |                                   |
                    v                                   v
+-------------------+-----------------------------------+---------------+
| Backend NestJS 11 (Port 3000 & TCP Port 7018)                         |
|  ├── Gt02aListenerService & Gt06Parser (0x01, 0x12, 0x13 + ACK)       |
|  ├── DyegooSyncService (Live Position & Full History Importer)        |
|  ├── HistoriesService (Haversine Distance & Daily Analytics Engine)   |
|  └── AuthModule & GpsModule (JWT Guard, Role Guard, Multi-Tenancy)    |
+-----------------------------------+-----------------------------------+
                                    |
                                    v
                      [MongoDB Atlas Cloud Cluster]
             (users, gps, histories, dailyhistories, latesthistories)
                                    |
                                    v
+-----------------------------------+-----------------------------------+
| Frontend Dashboard React + Vite + Leaflet (Port 5173)                 |
|  ├── Login & Register Page (Neumorphic Light & Dark Mode)             |
|  ├── Interactive Route Map & Route Playback Player (1x - 10x)         |
|  ├── Daily Analytics Charts (Speed Profile, Daily Distance, GPS Fix%) |
|  └── One-Click CSV / JSON Exporter for Thesis Analysis                |
+-----------------------------------------------------------------------+
```

---

## 📂 Struktur Direktori

```text
TrackingGajah/
├── src/
│   ├── main.ts                                 # Entry point NestJS, ValidationPipe, & Swagger
│   ├── app.module.ts                           # Root module & koneksi MongoDB
│   ├── common/                                 # ResponseInterceptor, ExceptionFilter, Guards
│   └── app/
│       ├── auth/                               # Modul autentikasi JWT (/v1/users)
│       ├── gps/                                # Modul manajemen perangkat pelacak (/v1/gps)
│       ├── histories/                          # Modul riwayat & analitik Haversine (/v1/histories)
│       ├── listener/                           # TCP Listener GT06 (Port 7018) & DyegooSyncService
│       └── users/                              # Skema Mongoose pengguna
├── frontend/
│   ├── src/
│   │   ├── App.tsx                             # Dashboard utama, analitik, & Route Playback
│   │   ├── components/
│   │   │   ├── LoginPage.tsx                   # Halaman Login & Registrasi Neumorphic
│   │   │   └── ElephantMap.tsx                 # Komponen peta Leaflet, rute polyline, & marker
│   │   ├── types/index.ts                      # Definisi tipe data TypeScript
│   │   └── index.css                           # Styling Neumorphic Light & Dark Mode
│   └── vite.config.ts                          # Konfigurasi Vite & proxy API /v1
├── nginx/
│   └── nginx.conf                              # Konfigurasi reverse proxy HTTP & TCP Stream
├── test/
│   └── gt02a-simulator.ts                      # Simulator pengiriman paket biner GT06
├── .env.example                                # Contoh konfigurasi environment variables
├── start-all.bat                               # Launcher 1-klik (Backend + Frontend + Browser)
├── rules.md                                    # Dokumen spesifikasi standar teknis backend
└── agents.md                                   # Aturan arsitektur & standar kode proyek
```

---

## 🚀 Cara Instalasi & Menjalankan Sistem

### 1. Konfigurasi Environment (`.env`)
Salin berkas `.env.example` menjadi `.env`, lalu sesuaikan `MONGODB_URI` dan kredensial perangkat:

```powershell
copy .env.example .env
```

### 2. Menjalankan dengan 1x Klik (Khusus Windows)
Klik 2x pada berkas **`start-all.bat`**. Skrip ini akan otomatis:
1. Menjalankan **Backend NestJS** (`http://localhost:3000/v1` & TCP Listener `Port 7018`).
2. Menjalankan **Frontend React + Vite** (`http://localhost:5173`).
3. Membuka browser secara otomatis ke halaman Login dashboard.

### 3. Menjalankan Secara Manual via Terminal

**Terminal 1 — Backend NestJS:**
```powershell
npm install
npm run start:dev
```

**Terminal 2 — Frontend React + Vite:**
```powershell
cd frontend
npm install
npm run dev
```

Buka **`http://localhost:5173`** di browser Anda.

---

## 🔑 Akun Demo Default

Saat pertama kali dijalankan, sistem otomatis menyiapkan akun berikut:

| Jenis Akun | Email / ID Login | Password |
| :--- | :--- | :--- |
| **Akun Perangkat GT02A** | `28044909404` *(atau `355228044909404`)* | `123456` |
| **Akun Administrator** | `admin@trackinggajah.com` | `password123` |

---

## 📡 Daftar Endpoint REST API Utama

Dokumentasi interaktif Swagger tersedia di: **`http://localhost:3000/v1/docs`**

| Method | Endpoint | Proteksi | Deskripsi |
| :---: | :--- | :---: | :--- |
| `POST` | `/v1/users/register` | Publik | Registrasi pengguna baru |
| `POST` | `/v1/users/login` | Publik | Login dengan Email atau ID Alat & mendapatkan JWT |
| `GET` | `/v1/users/profile` | JWT | Mendapatkan profil pengguna aktif |
| `GET` | `/v1/gps/all/paginate` | JWT + Role | Daftar perangkat pelacak milik organisasi (`companyGuid`) |
| `POST` | `/v1/gps` | JWT + Role | Mendaftarkan unit perangkat GT02A baru |
| `POST` | `/v1/gps/sync` | JWT + Role | Memicu sinkronisasi langsung posisi & riwayat perjalanan |
| `DELETE` | `/v1/gps/:id` | JWT + Role | Menghapus data perangkat pelacak |
| `GET` | `/v1/histories/analytics/:deviceGuid` | JWT + Role | Analitik harian (Jarak *Haversine*, Kecepatan, Luas Jelajah, GPS vs LBS) |
| `GET` | `/v1/histories/raw/:deviceGuid?date=YYYY-MM-DD` | JWT + Role | Daftar titik koordinat rute berdasarkan filter tanggal |
| `GET` | `/v1/histories/last/:deviceGuid` | JWT + Role | Posisi *real-time* terakhir dari koleksi `latesthistories` |

---

## 📐 Rumus Pengolahan Data Analitik

### 1. Perhitungan Jarak Tempuh (*Haversine Formula*)
Jarak permukaan bumi ($d$) antara dua titik koordinat berurutan $(\phi_1, \lambda_1)$ dan $(\phi_2, \lambda_2)$ dengan jari-jari bumi $R = 6.371\,\text{km}$:

$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cdot\cos(\phi_2)\cdot\sin^2\left(\frac{\Delta\lambda}{2}\right)$$

$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right), \quad d = R \cdot c$$

### 2. Estimasi Luas Area Jelajah (*Bounding Box Home Range*)
Dihitung dari selisih lintang $(\phi_{\max} - \phi_{\min})$ dan bujur $(\lambda_{\max} - \lambda_{\min})$ harian yang dikonversi ke satuan kilometer persegi ($\text{km}^2$) serta Hektar ($1\,\text{km}^2 = 100\,\text{Ha}$).

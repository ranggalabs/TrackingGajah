# Standard Rules & Spesifikasi Backend: Elephant Tracking System (GT02A)

Dokumen ini merupakan aturan acuan pengkodean, arsitektur, dan integrasi teknis sistem pelacakan (*Tracking System*) untuk perangkat **GT02A** (GPS Tracker) dengan target pemantauan gajah (*gpsType: hewan*). Aturan ini diselaraskan dengan standar *Dokumen Teknis Rinci Backend - Management Tracking System (LSKK)*.

---

## 1. Tech Stack & Environment Standard

Pengembangan backend wajib mengacu pada teknologi resmi berikut:
* **Framework**: NestJS (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`) v11.x
* **Bahasa**: TypeScript v5.7.x (Strict Mode diaktifkan)
* **Database & ODM**: MongoDB dengan Mongoose / `@nestjs/mongoose`
* **Message Broker**: RabbitMQ (`amqplib` + `amqp-connection-manager`)
* **Autentikasi & Otorisasi**: Passport JWT (`@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`)
* **Validasi Data**: `class-validator` + `class-transformer`
* **Dokumentasi API**: `@nestjs/swagger` + `express-basic-auth`
* **Penyimpanan Berkas**: AWS S3 SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/lib-storage`, `multer`)
* **Ekspor Laporan (PDF)**: Puppeteer + Handlebars
* **Layanan Email**: Resend API
* **Scheduler / Cron**: `@nestjs/schedule`

---

## 2. Struktur Modul & Pola Arsitektur

### 2.1 Arsitektur Modul (`src/app/`)
Setiap fitur harus dipisahkan ke dalam modul domain mandiri:
* `auth`: Registrasi, aktivasi OTP email, login, refresh token, manajemen profil.
* `gps`: Entitas alat pelacak (GT02A) dan subjek yang dipantau (gajah).
* `histories`: Log seluruh titik koordinat dan status telemetri yang diterima.
* `daily-histories`: Riwayat pergerakan harian (difilter dengan interval waktu > 30 detik untuk efisiensi penyimpanan).
* `latest-histories`: Posisi terkini (1 record per `deviceGuid`, operasi *upsert*).
* `report`: Pembuatan rekapitulasi data dan ekspor PDF rute/aktivitas.
* `uploader`: Penanganan berkas gambar/foto ke cloud storage.
* `geolocation`: Layanan *reverse-geocoding* alamat dari koordinat (OpenCage / Nominatim).
* `heart-beat`: Pemantauan status online/koneksi perangkat dan worker.
* `cronjob`: Penjadwalan *maintenance*, rekap odometer harian, dan *health check*.

### 2.2 Pola Komponen per Modul
Setiap modul domain wajib menerapkan pola baku:
```text
[Module]
  ├── [Controller]   --> Menerima request HTTP, validasi DTO, panggil service
  ├── [Service]      --> Logika bisnis inti dan agregasi data
  ├── [Schema]       --> Definisi Mongoose Schema & Indexing MongoDB
  ├── [DTO]          --> Data Transfer Object dengan class-validator
  ├── [Guard]        --> Proteksi JWT & pemeriksaan Role
  └── [Interfaces]   --> Types, Enum, dan Interface TypeScript
```

### 2.3 Cross-Cutting Concern (Wajib Global)
* **Response Interceptor**: Standarisasi format response sukses global (`statusCode`, `message`, `data`).
* **Exception Filter**: Menangkap error secara global (`@Catch()`) dan menghasilkan format payload error standar.
* **Logging Middleware**: Pencatatan riwayat request HTTP masuk (`method`, `url`, `ip`, `responseTime`).
* **Validation Pipe**: Wajib diset global dengan opsi `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.

---

## 3. Spesifikasi Integrasi Perangkat GT02A

### 3.1 Karakteristik Perangkat GT02A
* Perangkat: GPS Tracker GT02A (akurasi tinggi, GSM/GPRS + GPS).
* Subjek Pemantauan: Gajah (*gpsType: hewan*).
* Komunikasi Protokol: Menggunakan format frame protokol biner **GT06**.

### 3.2 Paket Data Protokol GT06 (Biner)
* **Login Packet (`0x01`)**:
  * Dikirim pertama kali saat koneksi TCP terbentuk.
  * Memuat nomor IMEI perangkat (disimpan sebagai `gpsNumber`).
* **Location Packet (`0x12` / `0x22`)**:
  * Membawa koordinat *latitude*, *longitude*, *speed*, arah/*course*, status sinyal satelit, dan status GPS fix.
* **Status / Heartbeat Packet (`0x13`)**:
  * Membawa informasi level tegangan/baterai (`voltageLevel`), kekuatan sinyal GSM (`gsmSigStrength`), dan *terminalInfo*.
* **Mekanisme Response Server**:
  * Server worker wajib mengembalikan *acknowledgement packet* (ACK) sesuai nomor serial paket agar perangkat tidak memutuskan koneksi.

---

## 4. Skema Database MongoDB

### 4.1 Koleksi `users`
* `guid` (String, UUID/ULID, Unique, Index)
* `email` (String, Unique, Index)
* `password` (String, hashed bcrypt)
* `name` (String)
* `phoneNumber` (String)
* `companyGuid` (String, Index)
* `role` (Enum: `admin` | `user`)
* `isActivate` (Boolean)
* `otp` (String, nullable)
* `otpExpiry` (Date, nullable)
* `refreshToken` (String, nullable)
* `timestamps`

### 4.2 Koleksi `gps` (Target: Gajah / GT02A)
* `guid` (String, Unique, Index)
* `deviceGuid` (String, Unique, Index)
* `userGuid` (String, Index)
* `companyGuid` (String, Index)
* `name` (String, Nama/Identitas Gajah)
* `platNo` (String, Kode Collar / ID Kalung Pelacak Gajah)
* `gpsNumber` (String, IMEI perangkat GT02A, Unique, Index)
* `gpsType` (Enum: `hewan` | `kendaraan` | `manusia` | `other`, diset default: `hewan`)
* `terminalInfo`:
  * `status` (Boolean)
  * `charging` (Boolean)
  * `alarmType` (String / Number)
  * `gpsTracking` (Boolean)
  * `relayState` (Boolean)
* `voltageLevel` (Number)
* `gsmSigStrength` (Number)
* `latitude` (Number)
* `longitude` (Number)
* `odoMeter` (Number)
* `speed` (Number)
* `timestamps`

### 4.3 Koleksi `histories` & `dailyhistories`
* `deviceGuid` (String, Index)
* `platNo` (String)
* `gpsType` (String)
* `latitude` (Number)
* `longitude` (Number)
* `speed` (Number)
* `course` (Number)
* `satCnt` (Number)
* `voltageLevel` (Number)
* `gsmSigStrength` (Number)
* `fixTime` (Date)
* `parseTime` (Date)
* `dateTime` (Date)
* `timestamps`
* *Aturan Khusus*:
  * `dailyhistories`: Hanya mencatat baris baru jika jeda waktu pengiriman > 30 detik.
  * `latesthistories`: Menampung tepat 1 baris per `deviceGuid` dengan mekanisme *upsert*.

---

## 5. Standar Keamanan & Best Practices

1. **Rahasia Kredensial**:
   * Dilarang mencantumkan hardcoded JWT secret, kunci API, atau password database di kode sumber.
   * Wajib memuat seluruh konfigurasi melalui `@nestjs/config` dan berkas `.env`.
2. **Proteksi Endpoint**:
   * Semua endpoint mutasi dan pembacaan data wajib diproteksi oleh `JwtAuthGuard` dan `RolesGuard`.
   * Endpoint `uploader` dan `report/pdf` wajib diproteksi, tidak boleh dibiarkan publik tanpa guard.
3. **Isolasi Multi-Tenant**:
   * Setiap query pencarian, pembacaan, dan manipulasi data pada modul `gps`, `histories`, dan `report` wajib memvalidasi `companyGuid` dari user yang sedang login untuk mencegah kebocoran data antar-entitas.

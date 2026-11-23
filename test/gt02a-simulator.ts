import * as net from 'net';

/**
 * Simulator Pengujian GT02A (Protokol GT06)
 * Menyimulasikan pengiriman data dari kalung pelacak gajah (IMEI: 355228044909404) ke TCP server di laptop
 */

const HOST = '127.0.0.1';
const PORT = 7018;
const IMEI = '355228044909404';

console.log(`📡 Menghubungkan simulator GT02A (IMEI: ${IMEI}) ke ${HOST}:${PORT}...`);

const client = new net.Socket();

client.connect(PORT, HOST, () => {
  console.log('✅ Terhubung ke server TCP GT02A di laptop!');

  // 1. Kirim Login Packet (0x01)
  // Format: 0x78 0x78 [len=0x0D] [0x01] [IMEI 8 bytes BCD: 03 55 22 80 44 90 94 04] [Serial 2 bytes] [CRC 2 bytes] 0x0D 0x0A
  const loginPacket = Buffer.from([
    0x78, 0x78, 0x0d, 0x01,
    0x03, 0x55, 0x22, 0x80, 0x44, 0x90, 0x94, 0x04, // BCD IMEI 355228044909404
    0x00, 0x01, // Serial Number 1
    0x8c, 0xdd, // CRC
    0x0d, 0x0a,
  ]);

  console.log('📤 Mengirim Login Packet (0x01)...');
  client.write(loginPacket);
});

client.on('data', (data) => {
  console.log(`📥 Menerima balasan (ACK) dari server: [${data.toString('hex')}]`);

  // Jika menerima Login ACK, lanjutkan kirim paket lokasi
  if (data[3] === 0x01) {
    console.log('🎉 Login ACK terkonfirmasi! Mengirim data koordinat gajah...');

    // Koordinat TN Way Kambas (Habitat Gajah Sumatera): -5.0425, 105.7482
    const latRaw = Math.round(5.0425 * 1800000);
    const lonRaw = Math.round(105.7482 * 1800000);

    const locPacket = Buffer.alloc(36);
    let offset = 0;
    locPacket[offset++] = 0x78;
    locPacket[offset++] = 0x78;
    locPacket[offset++] = 0x1f; // Length
    locPacket[offset++] = 0x12; // Protocol Location

    // Date Time: 26-11-18 11:05:00 (YY MM DD HH mm ss)
    locPacket[offset++] = 26;
    locPacket[offset++] = 11;
    locPacket[offset++] = 18;
    locPacket[offset++] = 11;
    locPacket[offset++] = 5;
    locPacket[offset++] = 0;

    // Satellites
    locPacket[offset++] = 0xc8; // 8 satellites

    // Latitude & Longitude
    locPacket.writeUInt32BE(latRaw, offset);
    offset += 4;
    locPacket.writeUInt32BE(lonRaw, offset);
    offset += 4;

    // Speed (12 km/h)
    locPacket[offset++] = 12;

    // Course & Status (South Latitude = 0x0000, East Longitude = 0x0000, Positioned = 0x1000)
    locPacket.writeUInt16BE(0x1090, offset);
    offset += 2;

    // MCC, MNC, LAC, CellID
    locPacket.writeUInt16BE(510, offset); offset += 2;
    locPacket[offset++] = 8; // AXIS / XL
    locPacket.writeUInt16BE(1234, offset); offset += 2;
    locPacket.writeUInt32BE(5678, offset); offset += 4;

    // Serial
    locPacket.writeUInt16BE(2, offset); offset += 2;

    // CRC & Stop
    locPacket.writeUInt16BE(0x0000, offset); offset += 2;
    locPacket[offset++] = 0x0d;
    locPacket[offset++] = 0x0a;

    client.write(locPacket.slice(0, offset));
    console.log('📍 Lokasi gajah (Way Kambas: -5.0425, 105.7482) berhasil dikirim!');

    // Setelah 2 detik kirim Heartbeat
    setTimeout(() => {
      console.log('💓 Mengirim Heartbeat Packet (Level Baterai & Sinyal GSM)...');
      const hbPacket = Buffer.from([
        0x78, 0x78, 0x0a, 0x13,
        0x44, // Terminal info (charging, GPS tracking ON)
        0x06, // Voltage level (Level 6 - Penuh)
        0x1f, // GSM Signal (CSQ 31 - Penuh)
        0x00, 0x01, // Alarm / Language
        0x00, 0x03, // Serial 3
        0x12, 0x34, // CRC
        0x0d, 0x0a,
      ]);
      client.write(hbPacket);
    }, 2000);
  } else if (data[3] === 0x13) {
    console.log('✅ Heartbeat ACK diterima dari server! Semua alur sukses & tersimpan di MongoDB.');
    setTimeout(() => {
      client.end();
      console.log('🔌 Koneksi simulator ditutup.');
    }, 1000);
  }
});

client.on('error', (err: any) => {
  if (err.code === 'ECONNREFUSED') {
    console.error('❌ Gagal terhubung ke port 7018! Pastikan Backend NestJS sudah dinyalakan di terminal lain dengan perintah: npm run start:dev');
  } else {
    console.error('❌ Error koneksi:', err.message);
  }
});

client.on('close', () => {
  console.log('Koneksi selesai.');
});

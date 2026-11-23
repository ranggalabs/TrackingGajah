import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as net from 'net';
import { Gps, GpsDocument, GpsType } from '../gps/schemas/gps.schema';
import {
  History,
  HistoryDocument,
  DailyHistory,
  DailyHistoryDocument,
} from '../histories/schemas/history.schema';

export interface DyegooTrackingPayload {
  id: number;
  name: string;
  sn: string;
  model: string;
  serverUtcDate: string;
  deviceUtcDate: string;
  latitude: string;
  longitude: string;
  speed: string;
  course: string;
  dataContext: string;
  oilBreak?: string;
  dataType?: string;
  fortification: string;
  isStop: number;
  stopTime: number;
  carStatus: string;
  status: string;
  carNum: string;
  starNumber?: number;
}

export interface DyegooHistoryItem {
  deviceUtcDate: string;
  serverUtcTime: string;
  latitude: string;
  longitude: string;
  speed: string;
  course: string;
  dataType: string;
  IsStop: number;
  distance: string;
  stopTimeMinute: number;
}

@Injectable()
export class DyegooSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DyegooSyncService.name);
  private syncTimer: NodeJS.Timeout | null = null;
  private sessionCookie = '';
  private historyImported = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Gps.name) private readonly gpsModel: Model<GpsDocument>,
    @InjectModel(History.name) private readonly historyModel: Model<HistoryDocument>,
    @InjectModel(DailyHistory.name) private readonly dailyHistoryModel: Model<DailyHistoryDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.configService.get<string>('DYEGOO_ENABLED') !== 'false';
    if (!enabled) {
      return;
    }

    await this.ensureDeviceRegistered();

    const intervalMs = Number(this.configService.get<string>('DYEGOO_POLL_INTERVAL_MS')) || 10000;
    this.logger.log(
      `🛰️ Dyegoo Cloud Bridge aktif! Sinkronisasi otomatis perangkat GT02A/XY03D setiap ${intervalMs / 1000} detik...`,
    );

    setTimeout(async () => {
      await this.syncHistoricalTrajectory();
      await this.syncFromDyegoo();
    }, 1500);

    this.syncTimer = setInterval(() => {
      void this.syncFromDyegoo();
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
  }

  /**
   * Menghitung jarak Haversine antara 2 koordinat dalam satuan meter
   */
  public static calculateHaversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Radius bumi dalam meter
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async ensureDeviceRegistered(): Promise<void> {
    const imei = this.configService.get<string>('DYEGOO_DEVICE_IMEI') || '355228044909404';
    const sn = this.configService.get<string>('DYEGOO_DEVICE_SN') || '28044909404';
    const deviceGuid = `DEV-GAJAH-${sn}`;

    await this.gpsModel.updateOne(
      { gpsNumber: imei, voltageLevel: 6, gsmSigStrength: 30 },
      { $set: { voltageLevel: null, gsmSigStrength: null } },
    ).exec();

    const existing = await this.gpsModel.findOne({ gpsNumber: imei }).exec();
    if (!existing) {
      await this.gpsModel.create({
        guid: deviceGuid,
        deviceGuid,
        userGuid: 'USER-ADMIN-DEFAULT',
        companyGuid: 'COMPANY-GAJAH-01',
        name: `XY03D-1-${sn.slice(-5)}`,
        platNo: sn,
        gpsNumber: imei,
        gpsType: GpsType.HEWAN,
        voltageLevel: null,
        gsmSigStrength: null,
        latitude: 0,
        longitude: 0,
        odoMeter: 0,
        speed: 0,
        course: 0,
        lastFixTime: null,
        lastSyncTime: null,
      });
      this.logger.log(`✅ Unit Pelacak [${sn} / IMEI: ${imei}] terdaftar di MongoDB.`);
    }
  }

  private async loginToDyegoo(): Promise<string> {
    const sn = this.configService.get<string>('DYEGOO_DEVICE_SN') || '28044909404';
    const password = this.configService.get<string>('DYEGOO_PASSWORD') || '123456';
    const userId = this.configService.get<string>('DYEGOO_USER_ID') || '574323';
    const deviceId = this.configService.get<string>('DYEGOO_DEVICE_ID') || '566032';

    const params = new URLSearchParams({
      txtUserName: sn,
      txtUserPassword: password,
      txtTimeZone: '7',
      loginType: '1',
      loginLan: 'en-us',
      hidRememberPwd: '1',
    });

    const allCookies: string[] = [];
    const collectCookies = (res: Response): void => {
      const headersAny = res.headers as unknown as { getSetCookie?: () => string[] };
      const raw = headersAny.getSetCookie
        ? headersAny.getSetCookie()
        : [res.headers.get('set-cookie')].filter((x): x is string => Boolean(x));
      for (const c of raw) {
        allCookies.push(c.split(';')[0]);
      }
    };

    const loginRes = await fetch('https://www.dyegoo.net/UrlLogin.aspx', {
      method: 'POST',
      body: params,
      redirect: 'manual',
    });
    collectCookies(loginRes);

    const imeiPage = await fetch('https://www.dyegoo.net/ImeiIndexp.aspx', {
      headers: { Cookie: allCookies.join('; ') },
    });
    collectCookies(imeiPage);
    await imeiPage.text();

    const trackPage = await fetch(
      `https://www.dyegoo.net/Tracking.aspx?id=${userId}&deviceid=${deviceId}&loginType=1&m=Google`,
      {
        headers: { Cookie: allCookies.join('; ') },
      },
    );
    collectCookies(trackPage);
    await trackPage.text();

    const pbPage = await fetch(
      `https://www.dyegoo.net/Playback.aspx?id=${userId}&deviceid=${deviceId}&loginType=1&m=Google`,
      {
        headers: { Cookie: allCookies.join('; ') },
      },
    );
    collectCookies(pbPage);
    await pbPage.text();

    this.sessionCookie = allCookies.join('; ');
    return this.sessionCookie;
  }

  /**
   * Menarik seluruh riwayat perjalanan (GetDevicesHistory) dari server alat
   * dan menyimpannya ke koleksi histories & dailyhistories di MongoDB Atlas
   */
  public async syncHistoricalTrajectory(force = false): Promise<number> {
    if (this.historyImported && !force) {
      return 0;
    }

    try {
      const sn = this.configService.get<string>('DYEGOO_DEVICE_SN') || '28044909404';
      const deviceId = Number(this.configService.get<string>('DYEGOO_DEVICE_ID')) || 566032;
      const userId = this.configService.get<string>('DYEGOO_USER_ID') || '574323';
      const deviceGuid = `DEV-GAJAH-${sn}`;

      const existingCount = await this.historyModel.countDocuments({ deviceGuid }).exec();
      if (existingCount > 500 && !force) {
        this.historyImported = true;
        return existingCount;
      }

      await this.loginToDyegoo();

      const startStr = '2026-11-01 00:00:00';
      const endStr = '2026-12-31 23:59:59';

      const res = await fetch('https://www.dyegoo.net/Ajax/DevicesAjax.asmx/GetDevicesHistory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Cookie: this.sessionCookie,
          Referer: `https://www.dyegoo.net/Playback.aspx?id=${userId}&deviceid=${deviceId}&loginType=1&m=Google`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: `{DeviceID:${deviceId},Start:'${startStr}',End:'${endStr}',TimeZone:'China Standard Time',ShowLBS:1,lastLocationID:0}`,
      });

      const jsonRes = (await res.json()) as { d?: string };
      if (!jsonRes.d) {
        return 0;
      }

      const rawStr = jsonRes.d;
      const devicesMatch = rawStr.match(/devices:\s*(\[[\s\S]*?\])\s*,\s*lastLocationID/);
      if (!devicesMatch) {
        return 0;
      }

      const normalizedArr = devicesMatch[1].replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      const items = JSON.parse(normalizedArr) as DyegooHistoryItem[];

      if (!Array.isArray(items) || items.length === 0) {
        return 0;
      }

      this.logger.log(`📥 Mengimpor ${items.length} titik riwayat perjalanan nyata dari alat [${sn}]...`);

      // Urutkan kronologis dari terlama ke terbaru
      items.sort(
        (a, b) => new Date(a.deviceUtcDate).getTime() - new Date(b.deviceUtcDate).getTime(),
      );

      const bulkOps: any[] = [];
      let prevLat: number | null = null;
      let prevLon: number | null = null;
      let totalOdoMeters = 0;

      for (const item of items) {
        const lat = parseFloat(item.latitude);
        const lon = parseFloat(item.longitude);
        if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) continue;

        const fixTime = new Date(item.deviceUtcDate);
        const parseTime = item.serverUtcTime ? new Date(item.serverUtcTime) : fixTime;
        const speed = parseFloat(item.speed || '0');
        const course = parseFloat(item.course || '0');
        const dataType = Number(item.dataType || 1);
        const isStop = item.IsStop === 1 || speed === 0;
        const stopTimeMinute = Number(item.stopTimeMinute || 0);

        let segDist = 0;
        if (prevLat !== null && prevLon !== null) {
          segDist = DyegooSyncService.calculateHaversineMeters(prevLat, prevLon, lat, lon);
          // Filter lonjakan ekstrem (> 50 km dalam 1 titik)
          if (segDist > 50000) segDist = 0;
        }
        prevLat = lat;
        prevLon = lon;
        totalOdoMeters += segDist;

        const doc = {
          deviceGuid,
          platNo: sn,
          vehicleType: 'hewan',
          latitude: lat,
          longitude: lon,
          speed,
          course,
          dataType,
          isStop,
          stopTimeMinute,
          distanceMeters: Math.round(segDist * 10) / 10,
          satCnt: dataType === 1 ? 9 : 0,
          fixTime,
          parseTime,
          dateTime: fixTime,
        };

        bulkOps.push({
          updateOne: {
            filter: { deviceGuid, fixTime },
            update: { $set: doc },
            upsert: true,
          },
        });
      }

      if (bulkOps.length > 0) {
        // Bersihkan record statis tanpa dataType sebelumnya lalu bulkWrite
        await this.historyModel.deleteMany({ deviceGuid }).exec();
        await this.historyModel.bulkWrite(bulkOps, { ordered: false });

        // Update total odometer (km) pada koleksi gps
        const imei = this.configService.get<string>('DYEGOO_DEVICE_IMEI') || '355228044909404';
        await this.gpsModel.updateOne(
          { gpsNumber: imei },
          { $set: { odoMeter: Math.round((totalOdoMeters / 1000) * 100) / 100 } },
        ).exec();

        this.historyImported = true;
        this.logger.log(
          `✅ Berhasil menyimpan ${bulkOps.length} titik riwayat perjalanan (Total jarak: ${(totalOdoMeters / 1000).toFixed(2)} km) ke MongoDB Atlas!`,
        );
      }

      return bulkOps.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Gagal mengimpor riwayat perjalanan Dyegoo: ${msg}`);
      return 0;
    }
  }

  public async syncFromDyegoo(includeHistory = false): Promise<DyegooTrackingPayload | null> {
    try {
      if (includeHistory) {
        await this.syncHistoricalTrajectory(true);
      }

      const deviceId = Number(this.configService.get<string>('DYEGOO_DEVICE_ID')) || 566032;
      const userId = this.configService.get<string>('DYEGOO_USER_ID') || '574323';
      const imei = this.configService.get<string>('DYEGOO_DEVICE_IMEI') || '355228044909404';

      if (!this.sessionCookie) {
        await this.loginToDyegoo();
      }

      let res = await fetch('https://www.dyegoo.net/Ajax/DevicesAjax.asmx/GetTracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Cookie: this.sessionCookie,
          Referer: `https://www.dyegoo.net/Tracking.aspx?id=${userId}&deviceid=${deviceId}&loginType=1&m=Google`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: `{DeviceID:${deviceId},TimeZone:'China Standard Time'}`,
      });

      let jsonRes = (await res.json()) as { d?: string };
      if (!jsonRes.d) {
        await this.loginToDyegoo();
        res = await fetch('https://www.dyegoo.net/Ajax/DevicesAjax.asmx/GetTracking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Cookie: this.sessionCookie,
            Referer: `https://www.dyegoo.net/Tracking.aspx?id=${userId}&deviceid=${deviceId}&loginType=1&m=Google`,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: `{DeviceID:${deviceId},TimeZone:'China Standard Time'}`,
        });
        jsonRes = (await res.json()) as { d?: string };
      }

      if (!jsonRes.d) {
        return null;
      }

      const payload = this.parseDyegooObject(jsonRes.d);
      if (!payload) {
        return null;
      }

      const lat = parseFloat(payload.latitude);
      const lon = parseFloat(payload.longitude);
      const speed = Math.round(parseFloat(payload.speed || '0'));
      const course = Math.round(parseFloat(payload.course || '0'));
      const satellites = Number(payload.starNumber || 0);
      const isOnline = payload.status === 'Move' || payload.status === 'Stop';
      const accOn = payload.dataContext === '1';
      const fixDate = payload.deviceUtcDate ? new Date(payload.deviceUtcDate) : new Date();

      await this.gpsModel.updateOne(
        { gpsNumber: imei },
        {
          $set: {
            name: payload.name || `XY03D-1-${payload.sn.slice(-5)}`,
            platNo: payload.sn,
            course,
            lastFixTime: fixDate,
            lastSyncTime: new Date(),
            'terminalInfo.status': isOnline,
            'terminalInfo.deviceStatus': payload.status || 'Offline',
            'terminalInfo.ignition': accOn,
            'terminalInfo.gpsTracking': payload.dataType === '1',
            'terminalInfo.relayState': payload.oilBreak === '0',
            'terminalInfo.stopTimeMinutes': Number(payload.stopTime || 0),
            'terminalInfo.satellites': satellites,
          },
        },
      );

      this.logger.log(
        `[Dyegoo Live Sync] ${payload.name} (${payload.sn}) | Status Asli: ${payload.status} | FixTime: ${payload.deviceUtcDate} | Lat: ${lat}, Lon: ${lon} | Speed: ${speed} km/h`,
      );

      await this.forwardToLocalGt06Tcp(lat, lon, speed, course, fixDate, satellites);
      return payload;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Gagal sinkronisasi dari Dyegoo: ${msg}`);
      return null;
    }
  }

  private parseDyegooObject(raw: string): DyegooTrackingPayload | null {
    try {
      const normalized = raw.replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      return JSON.parse(normalized) as DyegooTrackingPayload;
    } catch {
      return null;
    }
  }

  private forwardToLocalGt06Tcp(
    latitude: number,
    longitude: number,
    speed: number,
    course: number,
    fixDate: Date,
    satellites: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const port = Number(this.configService.get<number>('GT02A_TCP_PORT')) || 7018;
      const imei = (this.configService.get<string>('DYEGOO_DEVICE_IMEI') || '355228044909404').padStart(16, '0');

      const client = new net.Socket();
      client.setTimeout(4000);

      client.connect(port, '127.0.0.1', () => {
        const loginPacket = Buffer.alloc(18);
        loginPacket[0] = 0x78;
        loginPacket[1] = 0x78;
        loginPacket[2] = 0x0d;
        loginPacket[3] = 0x01;
        for (let i = 0; i < 8; i++) {
          loginPacket[4 + i] = parseInt(imei.slice(i * 2, i * 2 + 2), 16);
        }
        loginPacket.writeUInt16BE(1, 12);
        loginPacket.writeUInt16BE(0x8cdd, 14);
        loginPacket[16] = 0x0d;
        loginPacket[17] = 0x0a;

        client.write(loginPacket);
      });

      client.on('data', (data) => {
        if (data[3] === 0x01) {
          const validDate = isNaN(fixDate.getTime()) ? new Date() : fixDate;
          const latRaw = Math.round(Math.abs(latitude) * 1800000);
          const lonRaw = Math.round(Math.abs(longitude) * 1800000);

          const locPacket = Buffer.alloc(36);
          let offset = 0;
          locPacket[offset++] = 0x78;
          locPacket[offset++] = 0x78;
          locPacket[offset++] = 0x1f;
          locPacket[offset++] = 0x12;

          locPacket[offset++] = validDate.getUTCFullYear() - 2000;
          locPacket[offset++] = validDate.getUTCMonth() + 1;
          locPacket[offset++] = validDate.getUTCDate();
          locPacket[offset++] = validDate.getUTCHours();
          locPacket[offset++] = validDate.getUTCMinutes();
          locPacket[offset++] = validDate.getUTCSeconds();
          locPacket[offset++] = 0xc0 | (satellites & 0x0f);

          locPacket.writeUInt32BE(latRaw, offset);
          offset += 4;
          locPacket.writeUInt32BE(lonRaw, offset);
          offset += 4;

          locPacket[offset++] = speed & 0xff;

          let courseStatus = 0x1000 | (course & 0x03ff);
          if (latitude >= 0) {
            courseStatus |= 0x0400;
          }
          if (longitude < 0) {
            courseStatus |= 0x0800;
          }
          locPacket.writeUInt16BE(courseStatus, offset);
          offset += 2;

          locPacket.writeUInt16BE(510, offset);
          offset += 2;
          locPacket[offset++] = 8;
          locPacket.writeUInt16BE(1234, offset);
          offset += 2;
          locPacket.writeUInt32BE(5678, offset);
          offset += 4;
          locPacket.writeUInt16BE(2, offset);
          offset += 2;
          locPacket.writeUInt16BE(0, offset);
          offset += 2;
          locPacket[offset++] = 0x0d;
          locPacket[offset++] = 0x0a;

          client.write(locPacket.slice(0, offset));

          setTimeout(() => {
            client.end();
            resolve();
          }, 250);
        }
      });

      client.on('error', () => {
        client.destroy();
        resolve();
      });

      client.on('timeout', () => {
        client.destroy();
        resolve();
      });
    });
  }
}

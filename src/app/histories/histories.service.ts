import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  History,
  HistoryDocument,
  DailyHistory,
  DailyHistoryDocument,
  LatestHistory,
  LatestHistoryDocument,
} from './schemas/history.schema';
import { Gps, GpsDocument } from '../gps/schemas/gps.schema';
import { DyegooSyncService } from '../listener/dyegoo-sync.service';

export interface DailyAnalyticsSummary {
  date: string; // YYYY-MM-DD
  totalPoints: number;
  distanceKm: number;
  maxSpeedKmh: number;
  avgMovingSpeedKmh: number;
  movingPoints: number;
  stopPoints: number;
  gpsPoints: number;
  lbsPoints: number;
  movingDurationMinutes: number;
  idleDurationMinutes: number;
  areaKm2: number;
  areaHectares: number;
  startCoord: [number, number];
  endCoord: [number, number];
  firstTime: string;
  lastTime: string;
}

@Injectable()
export class HistoriesService {
  constructor(
    @InjectModel(History.name) private readonly historyModel: Model<HistoryDocument>,
    @InjectModel(DailyHistory.name) private readonly dailyHistoryModel: Model<DailyHistoryDocument>,
    @InjectModel(LatestHistory.name) private readonly latestHistoryModel: Model<LatestHistoryDocument>,
    @InjectModel(Gps.name) private readonly gpsModel: Model<GpsDocument>,
  ) {}

  private async verifyOwnership(deviceGuid: string, companyGuid: string) {
    const device = await this.gpsModel.findOne({ deviceGuid, companyGuid }).exec();
    if (!device) {
      throw new NotFoundException('Perangkat tidak ditemukan atau bukan milik organisasi Anda');
    }
    return device;
  }

  private formatDateKey(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async getLatestPosition(deviceGuid: string, companyGuid: string) {
    await this.verifyOwnership(deviceGuid, companyGuid);

    const latest = await this.latestHistoryModel.findOne({ deviceGuid }).exec();
    if (!latest) {
      throw new NotFoundException('Belum ada data posisi terbaru untuk perangkat ini');
    }
    return latest;
  }

  async getHistories(deviceGuid: string, companyGuid: string, limit = 500, date?: string) {
    await this.verifyOwnership(deviceGuid, companyGuid);

    const filter: Record<string, any> = { deviceGuid };
    if (date && date !== 'all') {
      const startOfDay = new Date(`${date}T00:00:00.000`);
      const endOfDay = new Date(`${date}T23:59:59.999`);
      filter.fixTime = { $gte: startOfDay, $lte: endOfDay };
    }

    return this.historyModel
      .find(filter)
      .sort({ fixTime: 1 })
      .limit(limit)
      .exec();
  }

  async getDailyHistories(deviceGuid: string, date: string, companyGuid: string) {
    return this.getHistories(deviceGuid, companyGuid, 2000, date);
  }

  /**
   * Menghitung analitik komprehensif per hari & total keseluruhan (Jarak Haversine, Kecepatan,
   * Durasi Bergerak vs Diam, Kualitas Sinyal GPS vs LBS, dan Luas Area Jelajah / Home Range)
   */
  async getAnalytics(deviceGuid: string, companyGuid: string) {
    await this.verifyOwnership(deviceGuid, companyGuid);

    const allPoints = await this.historyModel
      .find({ deviceGuid })
      .sort({ fixTime: 1 })
      .lean()
      .exec();

    const byDate = new Map<string, any[]>();
    for (const pt of allPoints) {
      if (!pt.fixTime || (pt.latitude === 0 && pt.longitude === 0)) continue;
      const dKey = this.formatDateKey(new Date(pt.fixTime));
      if (!byDate.has(dKey)) {
        byDate.set(dKey, []);
      }
      byDate.get(dKey)!.push(pt);
    }

    const dailySummaries: DailyAnalyticsSummary[] = [];
    let grandTotalDistanceKm = 0;
    let grandMaxSpeed = 0;
    let grandGpsCount = 0;
    let grandLbsCount = 0;

    for (const [date, pts] of byDate.entries()) {
      let distMeters = 0;
      let maxSpeed = 0;
      let movingSpeedSum = 0;
      let movingPoints = 0;
      let stopPoints = 0;
      let gpsPoints = 0;
      let lbsPoints = 0;
      let movingDurationMs = 0;
      let idleDurationMs = 0;

      let minLat = 90;
      let maxLat = -90;
      let minLon = 180;
      let maxLon = -180;

      for (let i = 0; i < pts.length; i++) {
        const curr = pts[i];
        const spd = Number(curr.speed || 0);
        const dt = Number(curr.dataType || 1);

        if (curr.latitude < minLat) minLat = curr.latitude;
        if (curr.latitude > maxLat) maxLat = curr.latitude;
        if (curr.longitude < minLon) minLon = curr.longitude;
        if (curr.longitude > maxLon) maxLon = curr.longitude;

        if (dt === 2) {
          lbsPoints++;
          grandLbsCount++;
        } else {
          gpsPoints++;
          grandGpsCount++;
        }

        if (spd > maxSpeed) maxSpeed = spd;
        if (spd > grandMaxSpeed) grandMaxSpeed = spd;

        if (spd > 0.5 && !curr.isStop) {
          movingPoints++;
          movingSpeedSum += spd;
        } else {
          stopPoints++;
        }

        if (i > 0) {
          const prev = pts[i - 1];
          const segMeters = DyegooSyncService.calculateHaversineMeters(
            prev.latitude,
            prev.longitude,
            curr.latitude,
            curr.longitude,
          );
          if (segMeters < 50000) {
            distMeters += segMeters;
          }

          const deltaMs =
            new Date(curr.fixTime).getTime() - new Date(prev.fixTime).getTime();
          // Batasi celah waktu maksimal 30 menit antar-titik
          if (deltaMs > 0 && deltaMs <= 30 * 60 * 1000) {
            if (spd > 0.5 || Number(prev.speed || 0) > 0.5) {
              movingDurationMs += deltaMs;
            } else {
              idleDurationMs += deltaMs;
            }
          }
        }
      }

      const distanceKm = Math.round((distMeters / 1000) * 100) / 100;
      grandTotalDistanceKm += distanceKm;

      // Hitung estimasi luas bounding box area jelajah (Home Range)
      const heightMeters = DyegooSyncService.calculateHaversineMeters(minLat, minLon, maxLat, minLon);
      const widthMeters = DyegooSyncService.calculateHaversineMeters(minLat, minLon, minLat, maxLon);
      const areaKm2 = Math.round(((heightMeters * widthMeters) / 1_000_000) * 100) / 100;
      const areaHectares = Math.round(areaKm2 * 100 * 10) / 10;

      dailySummaries.push({
        date,
        totalPoints: pts.length,
        distanceKm,
        maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
        avgMovingSpeedKmh:
          movingPoints > 0 ? Math.round((movingSpeedSum / movingPoints) * 10) / 10 : 0,
        movingPoints,
        stopPoints,
        gpsPoints,
        lbsPoints,
        movingDurationMinutes: Math.round(movingDurationMs / 60000),
        idleDurationMinutes: Math.round(idleDurationMs / 60000),
        areaKm2,
        areaHectares,
        startCoord: [pts[0].latitude, pts[0].longitude],
        endCoord: [pts[pts.length - 1].latitude, pts[pts.length - 1].longitude],
        firstTime: new Date(pts[0].fixTime).toISOString(),
        lastTime: new Date(pts[pts.length - 1].fixTime).toISOString(),
      });
    }

    // Urutkan tanggal dari terbaru ke terlama untuk dropdown, namun sediakan juga urutan kronologis
    dailySummaries.sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalPointsAllDays: allPoints.length,
      totalDaysRecorded: dailySummaries.length,
      totalDistanceAllDaysKm: Math.round(grandTotalDistanceKm * 100) / 100,
      maxSpeedAllDaysKmh: Math.round(grandMaxSpeed * 10) / 10,
      gpsRatioPercent:
        allPoints.length > 0 ? Math.round((grandGpsCount / allPoints.length) * 100) : 100,
      lbsRatioPercent:
        allPoints.length > 0 ? Math.round((grandLbsCount / allPoints.length) * 100) : 0,
      availableDates: dailySummaries.map((d) => d.date),
      dailySummaries,
    };
  }
}

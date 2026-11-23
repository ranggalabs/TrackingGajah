export interface TerminalInfo {
  status: boolean;
  ignition?: boolean;
  charging: boolean;
  alarmType: string;
  gpsTracking: boolean;
  relayState: boolean;
  deviceStatus?: string; // 'Move' | 'Stop' | 'Offline'
  stopTimeMinutes?: number;
  satellites?: number;
}

export interface ElephantGps {
  guid: string;
  deviceGuid: string;
  name: string;
  platNo: string; // Collar ID
  gpsNumber: string; // GT02A IMEI
  gpsType: string;
  latitude: number;
  longitude: number;
  speed: number;
  odoMeter?: number;
  course?: number;
  voltageLevel: number | null;
  gsmSigStrength: number | null;
  terminalInfo: TerminalInfo;
  lastFixTime?: string | null;
  lastSyncTime?: string | null;
  updatedAt: string;
}

export interface HistoryPoint {
  _id?: string;
  deviceGuid?: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  dataType?: number; // 1 = GPS Satelit, 2 = LBS BTS
  isStop?: boolean;
  stopTimeMinute?: number;
  distanceMeters?: number;
  fixTime: string;
  parseTime?: string;
  satCnt: number;
}

export interface DailyAnalyticsSummary {
  date: string;
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

export interface AnalyticsResponse {
  totalPointsAllDays: number;
  totalDaysRecorded: number;
  totalDistanceAllDaysKm: number;
  maxSpeedAllDaysKmh: number;
  gpsRatioPercent: number;
  lbsRatioPercent: number;
  availableDates: string[];
  dailySummaries: DailyAnalyticsSummary[];
}

/**
 * GT06 Protocol Parser for GT02A GPS Tracker
 * Supports: Login (0x01), Location (0x12, 0x22), Heartbeat/Status (0x13)
 */

export interface ParsedGpsLocation {
  fixTime: Date;
  satellites: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  isGpsRealTime: boolean;
  isGpsPositioned: boolean;
  isEastLongitude: boolean;
  isNorthLatitude: boolean;
  mcc?: number;
  mnc?: number;
  lac?: number;
  cellId?: number;
}

export interface ParsedHeartbeat {
  terminalInfo: {
    defenseActivated: boolean;
    accHigh: boolean;
    charging: boolean;
    alarmType: string;
    gpsTracking: boolean;
    relayState: boolean;
  };
  voltageLevel: number;
  gsmSigStrength: number;
}

export class Gt06Parser {
  /**
   * Calculate CRC16 ITU-T for GT06 response
   */
  public static crc16(buffer: Buffer): number {
    let crc = 0xffff;
    for (let i = 0; i < buffer.length; i++) {
      crc = (crc >>> 8) ^ Gt06Parser.crcTable[(crc ^ buffer[i]) & 0xff];
    }
    return (~crc) & 0xffff;
  }

  private static crcTable: number[] = (() => {
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let curr = i;
      for (let j = 0; j < 8; j++) {
        if ((curr & 0x0001) !== 0) {
          curr = (curr >>> 1) ^ 0x8408;
        } else {
          curr = curr >>> 1;
        }
      }
      table.push(curr);
    }
    return table;
  })();

  /**
   * Build GT06 Response Packet (ACK)
   */
  public static buildAck(protocolNumber: number, serialNumber: number): Buffer {
    const body = Buffer.from([0x05, protocolNumber, (serialNumber >> 8) & 0xff, serialNumber & 0xff]);
    const crc = this.crc16(body);

    return Buffer.from([
      0x78,
      0x78,
      0x05,
      protocolNumber,
      (serialNumber >> 8) & 0xff,
      serialNumber & 0xff,
      (crc >> 8) & 0xff,
      crc & 0xff,
      0x0d,
      0x0a,
    ]);
  }

  /**
   * Parse IMEI from Login Packet (BCD encoded 8 bytes)
   */
  public static parseImei(buffer: Buffer, offset: number = 4): string {
    let imei = '';
    for (let i = 0; i < 8; i++) {
      const byte = buffer[offset + i];
      const high = (byte >> 4) & 0x0f;
      const low = byte & 0x0f;
      imei += high.toString(16) + low.toString(16);
    }
    // Remove leading zero if 16 digits (IMEI is usually 15 digits)
    if (imei.startsWith('0') && imei.length === 16) {
      imei = imei.substring(1);
    }
    return imei;
  }

  /**
   * Parse Location Packet (0x12 or 0x22)
   */
  public static parseLocation(buffer: Buffer): ParsedGpsLocation {
    const year = 2000 + buffer[4];
    const month = buffer[5] - 1;
    const day = buffer[6];
    const hour = buffer[7];
    const minute = buffer[8];
    const second = buffer[9];
    const fixTime = new Date(Date.UTC(year, month, day, hour, minute, second));

    const satByte = buffer[10];
    const satellites = satByte & 0x0f;

    // Latitude & Longitude in 1/1,800,000 degrees (30000 * 60)
    const rawLat = buffer.readUInt32BE(11);
    const rawLon = buffer.readUInt32BE(15);
    let latitude = rawLat / 1800000.0;
    let longitude = rawLon / 1800000.0;

    const speed = buffer[19]; // km/h

    // Course & Status byte 20 & 21
    const courseStatus = buffer.readUInt16BE(20);
    const course = courseStatus & 0x03ff; // bits 0-9
    const isGpsRealTime = (courseStatus & 0x2000) === 0;
    const isGpsPositioned = (courseStatus & 0x1000) !== 0;
    const isEastLongitude = (courseStatus & 0x0800) === 0;
    const isNorthLatitude = (courseStatus & 0x0400) !== 0;

    if (!isNorthLatitude) {
      latitude = -latitude;
    }
    if (!isEastLongitude) {
      longitude = -longitude;
    }

    return {
      fixTime,
      satellites,
      latitude: parseFloat(latitude.toFixed(6)),
      longitude: parseFloat(longitude.toFixed(6)),
      speed,
      course,
      isGpsRealTime,
      isGpsPositioned,
      isEastLongitude,
      isNorthLatitude,
    };
  }

  /**
   * Parse Heartbeat Packet (0x13)
   */
  public static parseHeartbeat(buffer: Buffer): ParsedHeartbeat {
    const termByte = buffer[4];
    const defenseActivated = (termByte & 0x01) !== 0;
    const accHigh = (termByte & 0x02) !== 0;
    const charging = (termByte & 0x04) !== 0;

    const alarmCode = (termByte >> 3) & 0x07;
    const alarmTypes = ['normal', 'sos', 'power_cut', 'low_battery', 'vibration', 'overspeed'];
    const alarmType = alarmTypes[alarmCode] || 'normal';

    const gpsTracking = (termByte & 0x40) !== 0;
    const relayState = (termByte & 0x80) === 0;

    const voltageLevel = buffer[5]; // 0-6 level or raw voltage
    const gsmSigStrength = buffer[6]; // CSQ (0-31)

    return {
      terminalInfo: {
        defenseActivated,
        accHigh,
        charging,
        alarmType,
        gpsTracking,
        relayState,
      },
      voltageLevel,
      gsmSigStrength,
    };
  }
}

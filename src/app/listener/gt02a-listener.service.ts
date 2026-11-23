import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as net from 'net';
import { Gt06Parser } from './gt06.parser';
import { Gps, GpsDocument } from '../gps/schemas/gps.schema';
import {
  History,
  HistoryDocument,
  DailyHistory,
  DailyHistoryDocument,
  LatestHistory,
  LatestHistoryDocument,
} from '../histories/schemas/history.schema';

@Injectable()
export class Gt02aListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Gt02aListenerService.name);
  private server: net.Server;
  private readonly clients = new Map<net.Socket, { imei?: string; deviceGuid?: string }>();

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Gps.name) private readonly gpsModel: Model<GpsDocument>,
    @InjectModel(History.name) private readonly historyModel: Model<HistoryDocument>,
    @InjectModel(DailyHistory.name) private readonly dailyHistoryModel: Model<DailyHistoryDocument>,
    @InjectModel(LatestHistory.name) private readonly latestHistoryModel: Model<LatestHistoryDocument>,
  ) {}

  onModuleInit() {
    const port = this.configService.get<number>('GT02A_TCP_PORT') || 7018;
    this.startTcpServer(port);
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close(() => {
        this.logger.log('GT02A TCP Server stopped');
      });
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  private startTcpServer(port: number) {
    this.server = net.createServer((socket) => {
      const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
      this.logger.log(`[GT02A Connection] Perangkat terhubung dari ${clientAddress}`);
      this.clients.set(socket, {});

      socket.on('data', async (data: Buffer) => {
        try {
          await this.handleIncomingData(socket, data);
        } catch (err) {
          this.logger.error(`Error processing packet from ${clientAddress}: ${err.message}`);
        }
      });

      socket.on('close', () => {
        const client = this.clients.get(socket);
        this.logger.warn(`[GT02A Disconnect] Perangkat IMEI ${client?.imei || 'Unknown'} terputus`);
        this.clients.delete(socket);
      });

      socket.on('error', (err) => {
        this.logger.error(`[GT02A Socket Error] ${clientAddress}: ${err.message}`);
      });
    });

    this.server.listen(port, '0.0.0.0', () => {
      this.logger.log(`🚀 GT02A TCP Listener aktif pada port 0.0.0.0:${port}`);
    });
  }

  private async handleIncomingData(socket: net.Socket, data: Buffer) {
    if (data.length < 5) return;

    if (data[0] !== 0x78 || data[1] !== 0x78) {
      this.logger.debug(`Unknown start bits: ${data.slice(0, 2).toString('hex')}`);
      return;
    }

    const protocolNumber = data[3];

    // 1. LOGIN PACKET (0x01)
    if (protocolNumber === 0x01) {
      const imei = Gt06Parser.parseImei(data, 4);
      const serialNumber = data.readUInt16BE(4 + 8);
      this.logger.log(`[LOGIN] Menerima Login Packet dari GT02A IMEI: ${imei}`);

      const gpsDevice = await this.gpsModel.findOne({ gpsNumber: imei }).exec();
      const deviceGuid = gpsDevice?.deviceGuid || `DEV-GAJAH-${imei}`;

      this.clients.set(socket, { imei, deviceGuid });

      const ack = Gt06Parser.buildAck(protocolNumber, serialNumber);
      socket.write(ack);
      this.logger.log(`[LOGIN ACK] Terkirim ke IMEI: ${imei}`);
      return;
    }

    // 2. LOCATION PACKET (0x12 atau 0x22)
    if (protocolNumber === 0x12 || protocolNumber === 0x22) {
      const client = this.clients.get(socket);
      const location = Gt06Parser.parseLocation(data);
      this.logger.log(
        `[LOCATION] IMEI ${client?.imei || 'N/A'} -> Lat: ${location.latitude}, Lon: ${location.longitude}, Speed: ${location.speed} km/h, FixTime: ${location.fixTime.toISOString()}`,
      );

      const imei = client?.imei;
      const gpsDevice = await this.gpsModel.findOne({
        $or: [{ deviceGuid: client?.deviceGuid }, { gpsNumber: imei }],
      }).exec();

      const deviceGuid = gpsDevice?.deviceGuid || client?.deviceGuid || imei || 'UNKNOWN_DEVICE';
      const platNo = gpsDevice?.platNo || 'UNKNOWN';
      const now = new Date();

      const historyRecord = {
        deviceGuid,
        platNo,
        vehicleType: 'hewan',
        terminalInfo: gpsDevice?.terminalInfo || {},
        voltageLevel: gpsDevice?.voltageLevel ?? null,
        gsmSigStrength: gpsDevice?.gsmSigStrength ?? null,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed,
        course: location.course,
        satCnt: location.satellites,
        fixTime: location.fixTime,
        parseTime: now,
        dateTime: now,
      };

      // Cek apakah titik fixTime & koordinat ini sudah pernah dicatat agar tidak menduplikasi data statis
      const lastHistory = await this.historyModel
        .findOne({ deviceGuid })
        .sort({ fixTime: -1, createdAt: -1 })
        .exec();

      const isNewCoordinateOrFix =
        !lastHistory ||
        lastHistory.latitude !== location.latitude ||
        lastHistory.longitude !== location.longitude ||
        Math.abs(new Date(lastHistory.fixTime).getTime() - location.fixTime.getTime()) > 1000;

      if (isNewCoordinateOrFix) {
        await this.historyModel.create(historyRecord);
      }

      // Upsert ke koleksi 'latesthistories' (1 record per deviceGuid)
      await this.latestHistoryModel.updateOne(
        { deviceGuid },
        { $set: historyRecord },
        { upsert: true },
      );

      // Update posisi di koleksi 'gps'
      await this.gpsModel.updateOne(
        { $or: [{ deviceGuid }, { gpsNumber: imei }] },
        {
          $set: {
            latitude: location.latitude,
            longitude: location.longitude,
            speed: location.speed,
            course: location.course,
            lastFixTime: location.fixTime,
            lastSyncTime: now,
            'terminalInfo.gpsTracking': location.isGpsPositioned,
            'terminalInfo.satellites': location.satellites,
          },
        },
      );

      // Simpan ke 'dailyhistories' hanya jika titik baru dan jeda > 30 detik
      if (isNewCoordinateOrFix) {
        const lastDaily = await this.dailyHistoryModel
          .findOne({ deviceGuid })
          .sort({ fixTime: -1 })
          .exec();

        if (
          !lastDaily ||
          Math.abs(location.fixTime.getTime() - new Date(lastDaily.fixTime).getTime()) > 30000
        ) {
          await this.dailyHistoryModel.create(historyRecord);
        }
      }
      return;
    }

    // 3. HEARTBEAT / STATUS PACKET (0x13)
    if (protocolNumber === 0x13) {
      const client = this.clients.get(socket);
      const heartbeat = Gt06Parser.parseHeartbeat(data);
      const serialNumber = data.readUInt16BE(data.length - 6);

      this.logger.log(
        `[HEARTBEAT] IMEI ${client?.imei || 'N/A'} -> VoltLevel: ${heartbeat.voltageLevel}, GSM: ${heartbeat.gsmSigStrength}`,
      );

      if (client?.imei || client?.deviceGuid) {
        await this.gpsModel.updateOne(
          { $or: [{ deviceGuid: client?.deviceGuid }, { gpsNumber: client?.imei }] },
          {
            $set: {
              'terminalInfo.status': true,
              'terminalInfo.ignition': heartbeat.terminalInfo.accHigh,
              'terminalInfo.charging': heartbeat.terminalInfo.charging,
              'terminalInfo.alarmType': heartbeat.terminalInfo.alarmType,
              'terminalInfo.gpsTracking': heartbeat.terminalInfo.gpsTracking,
              'terminalInfo.relayState': heartbeat.terminalInfo.relayState,
              voltageLevel: heartbeat.voltageLevel,
              gsmSigStrength: heartbeat.gsmSigStrength,
              lastSyncTime: new Date(),
            },
          },
        );
      }

      const ack = Gt06Parser.buildAck(protocolNumber, serialNumber);
      socket.write(ack);
    }
  }
}

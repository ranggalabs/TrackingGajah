import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GpsDocument = Gps & Document;

export enum GpsType {
  HEWAN = 'hewan',
  KENDARAAN = 'kendaraan',
  MANUSIA = 'manusia',
  OTHER = 'other',
}

@Schema({ _id: false })
export class TerminalInfo {
  @Prop({ default: false })
  status: boolean;

  @Prop({ default: false })
  ignition: boolean;

  @Prop({ default: false })
  charging: boolean;

  @Prop({ default: 'normal' })
  alarmType: string;

  @Prop({ default: false })
  gpsTracking: boolean;

  @Prop({ default: false })
  relayState: boolean;

  @Prop({ default: 'Offline' })
  deviceStatus: string; // 'Move' | 'Stop' | 'Offline'

  @Prop({ default: 0, type: Number })
  stopTimeMinutes: number;

  @Prop({ default: 0, type: Number })
  satellites: number;
}

@Schema({ timestamps: true, collection: 'gps' })
export class Gps {
  @Prop({ required: true, unique: true, index: true })
  guid: string;

  @Prop({ required: true, unique: true, index: true })
  deviceGuid: string;

  @Prop({ required: true, index: true })
  userGuid: string;

  @Prop({ required: true, index: true })
  companyGuid: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  platNo: string;

  @Prop({ required: true, unique: true, index: true })
  gpsNumber: string;

  @Prop({ required: true, enum: GpsType, default: GpsType.HEWAN })
  gpsType: GpsType;

  @Prop({ type: TerminalInfo, default: () => ({}) })
  terminalInfo: TerminalInfo;

  @Prop({ default: null, type: Number })
  voltageLevel: number | null;

  @Prop({ default: null, type: Number })
  gsmSigStrength: number | null;

  @Prop({ default: 0, type: Number })
  latitude: number;

  @Prop({ default: 0, type: Number })
  longitude: number;

  @Prop({ default: 0, type: Number })
  odoMeter: number;

  @Prop({ default: 0, type: Number })
  speed: number;

  @Prop({ default: 0, type: Number })
  course: number;

  @Prop({ type: Date, default: null })
  lastFixTime: Date | null;

  @Prop({ type: Date, default: null })
  lastSyncTime: Date | null;
}

export const GpsSchema = SchemaFactory.createForClass(Gps);

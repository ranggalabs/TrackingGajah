import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { TerminalInfo } from '../../gps/schemas/gps.schema';

export type HistoryDocument = History & Document;

@Schema({ timestamps: true, collection: 'histories' })
export class History {
  @Prop({ required: true, index: true })
  deviceGuid: string;

  @Prop({ default: '' })
  platNo: string;

  @Prop({ default: 'hewan' })
  vehicleType: string;

  @Prop({ type: TerminalInfo, default: () => ({}) })
  terminalInfo: TerminalInfo;

  @Prop({ default: null, type: Number })
  voltageLevel: number | null;

  @Prop({ default: null, type: Number })
  gsmSigStrength: number | null;

  @Prop({ required: true, type: Number })
  latitude: number;

  @Prop({ required: true, type: Number })
  longitude: number;

  @Prop({ default: 0, type: Number })
  speed: number;

  @Prop({ default: 0, type: Number })
  course: number;

  @Prop({ default: 1, type: Number })
  dataType: number; // 1 = GPS Satelit, 2 = LBS BTS

  @Prop({ default: false, type: Boolean })
  isStop: boolean;

  @Prop({ default: 0, type: Number })
  stopTimeMinute: number;

  @Prop({ default: 0, type: Number })
  distanceMeters: number;

  @Prop({ default: 0, type: Number })
  mcc: number;

  @Prop({ default: 0, type: Number })
  mnc: number;

  @Prop({ default: 0, type: Number })
  lac: number;

  @Prop({ default: 0, type: Number })
  cellId: number;

  @Prop({ default: 0, type: Number })
  satCnt: number;

  @Prop({ default: Date.now, index: true })
  fixTime: Date;

  @Prop({ default: Date.now })
  parseTime: Date;

  @Prop({ default: Date.now })
  dateTime: Date;
}

export const HistorySchema = SchemaFactory.createForClass(History);

export type DailyHistoryDocument = DailyHistory & Document;
@Schema({ timestamps: true, collection: 'dailyhistories' })
export class DailyHistory extends History {}
export const DailyHistorySchema = SchemaFactory.createForClass(DailyHistory);

export type LatestHistoryDocument = LatestHistory & Document;
@Schema({ timestamps: true, collection: 'latesthistories' })
export class LatestHistory extends History {
  @Prop({ required: true, unique: true, index: true })
  declare deviceGuid: string;
}
export const LatestHistorySchema = SchemaFactory.createForClass(LatestHistory);

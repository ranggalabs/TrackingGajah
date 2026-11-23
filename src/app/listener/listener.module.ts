import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Gt02aListenerService } from './gt02a-listener.service';
import { DyegooSyncService } from './dyegoo-sync.service';
import { Gps, GpsSchema } from '../gps/schemas/gps.schema';
import {
  History,
  HistorySchema,
  DailyHistory,
  DailyHistorySchema,
  LatestHistory,
  LatestHistorySchema,
} from '../histories/schemas/history.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Gps.name, schema: GpsSchema },
      { name: History.name, schema: HistorySchema },
      { name: DailyHistory.name, schema: DailyHistorySchema },
      { name: LatestHistory.name, schema: LatestHistorySchema },
    ]),
  ],
  providers: [Gt02aListenerService, DyegooSyncService],
  exports: [Gt02aListenerService, DyegooSyncService],
})
export class ListenerModule {}

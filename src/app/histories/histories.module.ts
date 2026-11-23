import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HistoriesController } from './histories.controller';
import { HistoriesService } from './histories.service';
import {
  History,
  HistorySchema,
  DailyHistory,
  DailyHistorySchema,
  LatestHistory,
  LatestHistorySchema,
} from './schemas/history.schema';
import { Gps, GpsSchema } from '../gps/schemas/gps.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: History.name, schema: HistorySchema },
      { name: DailyHistory.name, schema: DailyHistorySchema },
      { name: LatestHistory.name, schema: LatestHistorySchema },
      { name: Gps.name, schema: GpsSchema },
    ]),
  ],
  controllers: [HistoriesController],
  providers: [HistoriesService],
  exports: [HistoriesService],
})
export class HistoriesModule {}

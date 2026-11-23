import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GpsController } from './gps.controller';
import { GpsService } from './gps.service';
import { Gps, GpsSchema } from './schemas/gps.schema';
import { ListenerModule } from '../listener/listener.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Gps.name, schema: GpsSchema }]),
    ListenerModule,
  ],
  controllers: [GpsController],
  providers: [GpsService],
  exports: [GpsService],
})
export class GpsModule {}

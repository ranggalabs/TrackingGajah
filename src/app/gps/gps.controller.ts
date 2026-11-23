import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GpsService } from './gps.service';
import { CreateGpsDto } from './dto/create-gps.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { DyegooSyncService } from '../listener/dyegoo-sync.service';

@ApiTags('GPS (Pelacakan Gajah / GT02A)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gps')
export class GpsController {
  constructor(
    private readonly gpsService: GpsService,
    private readonly dyegooSyncService: DyegooSyncService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Mendaftarkan unit pelacak gajah (GT02A) baru' })
  async create(@Body() dto: CreateGpsDto, @CurrentUser() user: any) {
    return this.gpsService.create(dto, user);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Memicu sinkronisasi langsung dengan perangkat fisik GT02A / Dyegoo beserta riwayat perjalanan' })
  async triggerLiveSync(@CurrentUser() user: any) {
    const rawPayload = await this.dyegooSyncService.syncFromDyegoo(true);
    const list = await this.gpsService.findAll(user.companyGuid, 1, 20);
    return {
      syncedAt: new Date().toISOString(),
      dyegooOnline: Boolean(rawPayload),
      rawStatus: rawPayload?.status || 'Unavailable',
      items: list.items,
    };
  }

  @Get('all/paginate')
  @ApiOperation({ summary: 'Mendapatkan daftar perangkat pelacak dengan paginasi' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @CurrentUser() user: any,
  ) {
    return this.gpsService.findAll(user.companyGuid, Number(page), Number(limit));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mendapatkan rincian data pelacak berdasarkan ID / DeviceGUID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.gpsService.findOne(id, user.companyGuid);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Menghapus data pelacak gajah' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.gpsService.remove(id, user.companyGuid);
  }
}

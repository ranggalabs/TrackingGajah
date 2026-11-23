import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HistoriesService } from './histories.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@ApiTags('Histories & Tracking Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('histories')
export class HistoriesController {
  constructor(private readonly historiesService: HistoriesService) {}

  @Get('analytics/:deviceGuid')
  @ApiOperation({
    summary: 'Mendapatkan analitik harian & keseluruhan (Jarak Haversine, Kecepatan, Area Jelajah, Sinyal GPS vs LBS)',
  })
  async getAnalytics(
    @Param('deviceGuid') deviceGuid: string,
    @CurrentUser() user: any,
  ) {
    return this.historiesService.getAnalytics(deviceGuid, user.companyGuid);
  }

  @Get('last/:deviceGuid')
  @ApiOperation({ summary: 'Mendapatkan posisi real-time terakhir gajah / GT02A' })
  async getLatestPosition(
    @Param('deviceGuid') deviceGuid: string,
    @CurrentUser() user: any,
  ) {
    return this.historiesService.getLatestPosition(deviceGuid, user.companyGuid);
  }

  @Get('raw/:deviceGuid')
  @ApiOperation({ summary: 'Mendapatkan log titik koordinat dengan filter tanggal opsional' })
  @ApiQuery({ name: 'limit', required: false, example: 2000 })
  @ApiQuery({ name: 'date', required: false, example: '2026-11-18' })
  async getHistories(
    @Param('deviceGuid') deviceGuid: string,
    @Query('limit') limit = 2000,
    @Query('date') date?: string,
    @CurrentUser() user?: any,
  ) {
    return this.historiesService.getHistories(
      deviceGuid,
      user.companyGuid,
      Number(limit),
      date,
    );
  }

  @Get('daily/:deviceGuid')
  @ApiOperation({ summary: 'Mendapatkan rekam jejak rute harian gajah' })
  @ApiQuery({ name: 'date', required: false, example: '2026-11-18' })
  async getDailyHistories(
    @Param('deviceGuid') deviceGuid: string,
    @Query('date') date: string,
    @CurrentUser() user: any,
  ) {
    return this.historiesService.getDailyHistories(deviceGuid, date, user.companyGuid);
  }
}

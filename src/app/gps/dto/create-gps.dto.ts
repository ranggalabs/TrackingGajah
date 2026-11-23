import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GpsType } from '../schemas/gps.schema';

export class CreateGpsDto {
  @ApiProperty({ example: 'Gajah Sumatera - Bona', description: 'Nama atau identitas gajah' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'COLLAR-G-001', description: 'ID kalung pelacak (Collar ID)' })
  @IsString()
  @IsNotEmpty()
  platNo: string;

  @ApiProperty({ example: '868120345678901', description: 'Nomor IMEI perangkat GT02A' })
  @IsString()
  @IsNotEmpty()
  gpsNumber: string;

  @ApiProperty({ enum: GpsType, default: GpsType.HEWAN })
  @IsEnum(GpsType)
  @IsOptional()
  gpsType?: GpsType = GpsType.HEWAN;
}

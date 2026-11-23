import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Gps, GpsDocument, GpsType } from './schemas/gps.schema';
import { CreateGpsDto } from './dto/create-gps.dto';

@Injectable()
export class GpsService {
  constructor(@InjectModel(Gps.name) private readonly gpsModel: Model<GpsDocument>) {}

  async create(dto: CreateGpsDto, user: { guid: string; companyGuid: string }): Promise<Gps> {
    const existing = await this.gpsModel
      .findOne({ gpsNumber: dto.gpsNumber, companyGuid: user.companyGuid })
      .exec();

    if (existing) {
      throw new ConflictException('Perangkat GT02A dengan IMEI ini sudah terdaftar');
    }

    const deviceGuid = `DEV-${uuidv4()}`;
    const newGps = new this.gpsModel({
      guid: uuidv4(),
      deviceGuid,
      userGuid: user.guid,
      companyGuid: user.companyGuid,
      name: dto.name,
      platNo: dto.platNo,
      gpsNumber: dto.gpsNumber,
      gpsType: dto.gpsType || GpsType.HEWAN,
      voltageLevel: null,
      gsmSigStrength: null,
      latitude: 0,
      longitude: 0,
      odoMeter: 0,
      speed: 0,
      course: 0,
      lastFixTime: null,
      lastSyncTime: null,
    });

    return newGps.save();
  }

  async findAll(companyGuid: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.gpsModel
        .find({ companyGuid })
        .skip(skip)
        .limit(limit)
        .sort({ updatedAt: -1 })
        .exec(),
      this.gpsModel.countDocuments({ companyGuid }),
    ]);

    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, companyGuid: string): Promise<Gps> {
    const item = await this.gpsModel
      .findOne({
        $or: [{ guid: id }, { deviceGuid: id }, { gpsNumber: id }],
        companyGuid,
      })
      .exec();

    if (!item) {
      throw new NotFoundException('Data pelacak gajah tidak ditemukan');
    }
    return item;
  }

  async remove(id: string, companyGuid: string) {
    const res = await this.gpsModel
      .deleteOne({
        $or: [{ guid: id }, { deviceGuid: id }],
        companyGuid,
      })
      .exec();

    if (res.deletedCount === 0) {
      throw new NotFoundException('Data tidak ditemukan atau bukan milik organisasi Anda');
    }
    return { message: 'Perangkat berhasil dihapus' };
  }
}

import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const defaultEmail = 'admin@trackinggajah.com';
    const existing = await this.userModel.findOne({ email: defaultEmail }).exec();
    if (!existing) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      await this.userModel.create({
        guid: 'USER-ADMIN-DEFAULT',
        email: defaultEmail,
        password: hashedPassword,
        name: 'Admin Konservasi Gajah',
        companyGuid: 'COMPANY-GAJAH-01',
        role: UserRole.ADMIN,
        isActivate: true,
      });
      this.logger.log(`✅ Akun default [${defaultEmail}] siap digunakan.`);
    }

    // Seed akun berbasis ID Alat (28044909404 / 123456)
    const deviceAccount = '28044909404';
    const existingDeviceAcc = await this.userModel.findOne({ email: deviceAccount }).exec();
    if (!existingDeviceAcc) {
      const salt = await bcrypt.genSalt(10);
      const hashedDevicePass = await bcrypt.hash('123456', salt);
      await this.userModel.create({
        guid: 'USER-DEVICE-28044909404',
        email: deviceAccount,
        password: hashedDevicePass,
        name: 'Operator Collar GT02A (28044909404)',
        companyGuid: 'COMPANY-GAJAH-01',
        role: UserRole.ADMIN,
        isActivate: true,
      });
      this.logger.log(`✅ Akun perangkat [${deviceAccount}] siap digunakan.`);
    }
  }

  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email }).exec();
    if (existing) {
      throw new ConflictException('Email sudah terdaftar');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const newUser = new this.userModel({
      guid: uuidv4(),
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      companyGuid: dto.companyGuid,
      role: UserRole.USER,
      isActivate: true,
    });

    await newUser.save();

    return {
      message: 'Registrasi berhasil',
      user: {
        guid: newUser.guid,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        companyGuid: newUser.companyGuid,
      },
    };
  }

  async login(dto: LoginDto) {
    const identifier = dto.email.trim();
    const lookupEmail =
      identifier === '355228044909404' ? '28044909404' : identifier;

    const user = await this.userModel.findOne({ email: lookupEmail }).exec();
    if (!user) {
      throw new UnauthorizedException('Email/ID atau kata sandi tidak cocok');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email/ID atau kata sandi tidak cocok');
    }

    const payload = {
      sub: user.guid,
      email: user.email,
      role: user.role,
      companyGuid: user.companyGuid,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        guid: user.guid,
        name: user.name,
        email: user.email,
        role: user.role,
        companyGuid: user.companyGuid,
      },
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallbackSecretKey',
    });
  }

  async validate(payload: { sub: string; email: string; role: string; companyGuid: string }) {
    const user = await this.userModel.findOne({ guid: payload.sub }).exec();
    if (!user || !user.isActivate) {
      throw new UnauthorizedException('Pengguna tidak ditemukan atau belum aktif');
    }
    return {
      guid: user.guid,
      email: user.email,
      name: user.name,
      role: user.role,
      companyGuid: user.companyGuid,
    };
  }
}

import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'admin@trackinggajah.com',
    description: 'Email pengguna atau ID/IMEI perangkat (misal: 28044909404)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email atau ID perangkat wajib diisi' })
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty({ message: 'Kata sandi wajib diisi' })
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'Admin Konservasi' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'admin@trackinggajah.com' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @ApiProperty({ example: 'COMPANY-GAJAH-01' })
  @IsString()
  @IsNotEmpty()
  companyGuid: string;
}

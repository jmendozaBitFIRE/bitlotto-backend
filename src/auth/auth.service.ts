import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { Role } from './enums/role.enum';

@Injectable()
export class AuthService {
  private readonly saltRounds = 12;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<any> {
    const user = await this.usersService.findByEmailWithClient(loginDto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const userAny = user as any;
    if (userAny.role === Role.ORGANIZADOR && userAny.clientId) {
      const client = userAny.client;
      if (!client || client.status !== 'active') {
        throw new ForbiddenException('Tu cuenta ha sido desactivada. Contacta al administrador.');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  async validateGoogleUser(googleUser: any): Promise<any> {
    const { email, googleId, firstName, lastName, picture } = googleUser;
    
    if (!email) {
      throw new UnauthorizedException('La cuenta de Google debe tener un correo electrónico asociado.');
    }

    const name = `${firstName} ${lastName}`;

    // 1. Try to find user by googleId
    let user = await this.usersService.findByGoogleId(googleId);

    if (!user) {
      // 2. Try to find user by email to link accounts
      user = await this.usersService.findByEmail(email);

      if (user) {
        // Link existing account
        user = await this.usersService.updateGoogleId(user.id, googleId, name, picture);
      } else {
        // 3. Create new user
        user = await this.usersService.create({
          email,
          googleId,
          name,
          avatar: picture,
          role: Role.ORGANIZADOR,
        });
      }
    }

    // 4. Check if inactive (using same logic as standard login)
    const userWithClient = await this.usersService.findByEmailWithClient(email);
    if (userWithClient && (userWithClient as any).role === Role.ORGANIZADOR && (userWithClient as any).clientId) {
      const client = (userWithClient as any).client;
      if (!client || client.status !== 'active') {
        throw new ForbiddenException('Tu cuenta ha sido desactivada. Contacta al administrador.');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user as any;
    return result;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  async refreshToken(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
    };
  }

  async resetPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    
    // Always return success to avoid user enumeration
    if (!user) {
      console.log(`Reset request for non-existent email: ${email}`);
      return { message: 'Si el correo existe, se enviará una nueva contraseña.' };
    }

    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, this.saltRounds);
    
    await this.usersService.updatePassword(user.id, hashedPassword);

    // Mock email sending
    console.log('--- ENVIANDO EMAIL DE RECUPERACIÓN ---');
    console.log(`Para: ${email}`);
    console.log(`Mensaje: Tu nueva contraseña temporal es: ${tempPassword}`);
    console.log('--------------------------------------');

    return { message: 'Si el correo existe, se enviará una nueva contraseña.' };
  }

  private generateTempPassword(length = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let retVal = '';
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
  }
}

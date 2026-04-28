import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { makeUser, makeClient } from '../test/fixtures';

jest.mock('bcrypt');
import * as bcrypt from 'bcrypt';

const mockUsersService = {
  findByEmailWithClient: jest.fn(),
  findByEmail: jest.fn(),
  updatePassword: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('mock-token');
    service = new AuthService(mockUsersService as any, mockJwtService as any);
  });

  describe('validateUser', () => {
    it('returns user without passwordHash when credentials are valid', async () => {
      const user = makeUser({ role: 'SUPERADMIN', clientId: null, client: null });
      mockUsersService.findByEmailWithClient.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser({ email: user.email, password: 'secret' });

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe(user.id);
    });

    it('throws UnauthorizedException for unknown email', async () => {
      mockUsersService.findByEmailWithClient.mockResolvedValue(null);

      await expect(
        service.validateUser({ email: 'nobody@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockUsersService.findByEmailWithClient.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser({ email: 'organizer@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when ORGANIZADOR client is inactive', async () => {
      const client = makeClient({ status: 'inactive' });
      const user = makeUser({ role: 'ORGANIZADOR', clientId: client.id, client });
      mockUsersService.findByEmailWithClient.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.validateUser({ email: user.email, password: 'pass' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ORGANIZADOR login when clientId is null (no client restriction)', async () => {
      const user = makeUser({ role: 'ORGANIZADOR', clientId: null, client: null });
      mockUsersService.findByEmailWithClient.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser({ email: user.email, password: 'pass' });

      expect(result).toBeDefined();
      expect(result.role).toBe('ORGANIZADOR');
    });

    it('allows ORGANIZADOR login when client is active', async () => {
      const client = makeClient({ status: 'active' });
      const user = makeUser({ role: 'ORGANIZADOR', clientId: client.id, client });
      mockUsersService.findByEmailWithClient.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser({ email: user.email, password: 'pass' });

      expect(result).toBeDefined();
    });
  });

  describe('login', () => {
    it('returns access_token, refresh_token and user payload', async () => {
      const user = makeUser({ role: 'ORGANIZADOR' });

      const result = await service.login(user);

      expect(result).toMatchObject({
        access_token: 'mock-token',
        refresh_token: 'mock-token',
        user: { id: user.id, email: user.email, role: user.role },
      });
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });
  });
});

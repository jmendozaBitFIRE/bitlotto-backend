import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from './enums/role.enum';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

describe('AuthService (Google OAuth)', () => {
  let authService: AuthService;
  let usersService: UsersService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockGoogleUser = {
    googleId: 'google-123',
    email: 'test@gmail.com',
    firstName: 'Test',
    lastName: 'User',
    picture: 'http://avatar.com/test.jpg',
  };

  it('should create a new account with ORGANIZER role for a new Google user', async () => {
    mockPrismaService.user.findUnique
      .mockResolvedValueOnce(null) // findByGoogleId
      .mockResolvedValueOnce(null) // findByEmail
      .mockResolvedValueOnce(null); // findByEmailWithClient

    const createdUser = {
      id: 'uuid-1',
      email: mockGoogleUser.email,
      googleId: mockGoogleUser.googleId,
      name: 'Test User',
      avatar: mockGoogleUser.picture,
      role: Role.ORGANIZADOR,
    };

    mockPrismaService.user.create.mockResolvedValue(createdUser);

    const result = await authService.validateGoogleUser(mockGoogleUser);

    expect(mockPrismaService.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: mockGoogleUser.email,
        googleId: mockGoogleUser.googleId,
        role: Role.ORGANIZADOR,
        name: 'Test User',
        avatar: mockGoogleUser.picture,
      }),
    });
    expect(result.email).toBe(mockGoogleUser.email);
  });

  it('should log in and not create duplicate for a returning Google user', async () => {
    const existingUser = {
      id: 'uuid-1',
      email: mockGoogleUser.email,
      googleId: mockGoogleUser.googleId,
      role: Role.ORGANIZADOR,
    };

    mockPrismaService.user.findUnique
      .mockResolvedValueOnce(existingUser) // findByGoogleId
      .mockResolvedValueOnce({ ...existingUser, client: { status: 'active' } }); // findByEmailWithClient

    const result = await authService.validateGoogleUser(mockGoogleUser);

    expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    expect(result.id).toBe('uuid-1');
  });

  it('should link accounts if email already exists without googleId', async () => {
    const existingUser = {
      id: 'uuid-1',
      email: mockGoogleUser.email,
      googleId: null,
      role: Role.ORGANIZADOR,
    };

    mockPrismaService.user.findUnique
      .mockResolvedValueOnce(null) // findByGoogleId
      .mockResolvedValueOnce(existingUser) // findByEmail
      .mockResolvedValueOnce({ ...existingUser, client: { status: 'active' } }); // findByEmailWithClient

    mockPrismaService.user.update.mockResolvedValue({
      ...existingUser,
      googleId: mockGoogleUser.googleId,
    });

    await authService.validateGoogleUser(mockGoogleUser);

    expect(mockPrismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      data: expect.objectContaining({
        googleId: mockGoogleUser.googleId,
      }),
    });
  });

  it('should reject inactive users via Google', async () => {
    const existingUser = {
      id: 'uuid-1',
      email: mockGoogleUser.email,
      googleId: mockGoogleUser.googleId,
      role: Role.ORGANIZADOR,
      clientId: 'client-1',
    };

    mockPrismaService.user.findUnique
      .mockResolvedValueOnce(existingUser) // findByGoogleId
      .mockResolvedValueOnce({ 
        ...existingUser, 
        client: { status: 'inactive' } 
      }); // findByEmailWithClient

    await expect(authService.validateGoogleUser(mockGoogleUser))
      .rejects.toThrow(ForbiddenException);
  });

  it('should store googleId correctly on first login', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(null);
    mockPrismaService.user.create.mockResolvedValue({
      id: 'uuid-1',
      googleId: mockGoogleUser.googleId,
      email: mockGoogleUser.email,
    });

    await authService.validateGoogleUser(mockGoogleUser);

    expect(mockPrismaService.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        googleId: mockGoogleUser.googleId,
      }),
    });
  });

  it('should save avatar and name from Google profile', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(null);
    mockPrismaService.user.create.mockResolvedValue({
      id: 'uuid-1',
      name: 'Test User',
      avatar: mockGoogleUser.picture,
    });

    await authService.validateGoogleUser(mockGoogleUser);

    expect(mockPrismaService.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Test User',
        avatar: mockGoogleUser.picture,
      }),
    });
  });

  it('should throw an error if Google returns no email', async () => {
    const userWithoutEmail = { ...mockGoogleUser, email: undefined };
    await expect(authService.validateGoogleUser(userWithoutEmail))
      .rejects.toThrow(UnauthorizedException);
  });
});

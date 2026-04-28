import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RafflesService } from './raffles.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { UpdateRaffleDto } from './dto/update-raffle.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/enums/role.enum';
import { imageStorage, imageFileFilter } from '../common/storage';

@Controller('raffles')
@UseGuards(RolesGuard)
@Roles(Role.ORGANIZADOR)
export class RafflesController {
  constructor(private rafflesService: RafflesService) {}

  @Get('limit')
  getRaffleLimit(@Request() req) {
    return this.rafflesService.getRaffleLimit(req.user.id);
  }

  @Get()
  findAll(@Request() req) {
    return this.rafflesService.findAllByOrganizer(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.rafflesService.findOne(id, req.user.id);
  }

  @Post()
  create(@Body() dto: CreateRaffleDto, @Request() req) {
    return this.rafflesService.create(req.user.id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRaffleDto, @Request() req) {
    return this.rafflesService.update(id, req.user.id, dto);
  }

  @Post('upload/image')
  @UseInterceptors(
    FileInterceptor('file', { storage: imageStorage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return { url: `/uploads/${file.filename}` };
  }
}

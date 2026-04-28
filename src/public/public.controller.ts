import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PublicService } from './public.service';
import { RafflesService } from '../raffles/raffles.service';
import { ReserveTicketsDto } from './dto/reserve-tickets.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { Public } from '../auth/decorators/public.decorator';
import { imageStorage, imageFileFilter } from '../common/storage';

@Controller('public')
@Public()
export class PublicController {
  constructor(
    private publicService: PublicService,
    private rafflesService: RafflesService,
  ) {}

  @Get('raffles/:domain')
  getRaffleByDomain(@Param('domain') domain: string) {
    return this.rafflesService.getByDomain(domain);
  }

  @Post('tickets/reserve')
  reserveTickets(@Body() dto: ReserveTicketsDto) {
    return this.publicService.reserveTickets(dto);
  }

  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.publicService.createOrder(dto);
  }

  @Patch('orders/:id/receipt')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadReceipt(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return this.publicService.attachReceipt(id, `/uploads/${file.filename}`);
  }
}

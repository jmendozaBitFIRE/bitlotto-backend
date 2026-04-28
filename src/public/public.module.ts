import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { RafflesModule } from '../raffles/raffles.module';

@Module({
  imports: [RafflesModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}

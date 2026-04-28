import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsPositive,
  IsOptional,
  IsIn,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRaffleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  prizeDescription: string;

  @IsOptional()
  @IsString()
  prizeImage?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  ticketPrice: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  totalTickets: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'El dominio solo puede contener letras minúsculas, números y guiones' })
  domain: string;

  @IsOptional()
  @IsIn(['draft', 'active'])
  status?: string;
}

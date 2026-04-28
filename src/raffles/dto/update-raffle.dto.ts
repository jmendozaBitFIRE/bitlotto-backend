import { IsString, IsOptional, IsNumber, IsInt, IsIn, IsPositive, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRaffleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  prizeDescription?: string;

  @IsOptional()
  @IsString()
  prizeImage?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  ticketPrice?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'El dominio solo puede contener letras minúsculas, números y guiones' })
  domain?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'closed'])
  status?: string;
}

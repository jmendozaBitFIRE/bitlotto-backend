import { IsString, IsNotEmpty, IsArray, ArrayMinSize, Length, Matches } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  raffleId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ticketIds: string[];

  @IsString()
  @IsNotEmpty()
  buyerName: string;

  @IsString()
  @Length(10, 10, { message: 'El teléfono debe tener exactamente 10 dígitos' })
  @Matches(/^\d{10}$/, { message: 'El teléfono debe contener solo dígitos' })
  buyerPhone: string;

  @IsString()
  @IsNotEmpty()
  buyerCity: string;
}

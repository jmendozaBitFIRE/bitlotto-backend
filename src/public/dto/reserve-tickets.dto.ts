import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class ReserveTicketsDto {
  @IsString()
  @IsNotEmpty()
  raffleId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ticketIds: string[];
}

import { IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['confirmed', 'rejected'])
  status: string;
}

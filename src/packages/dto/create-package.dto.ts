import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreatePackageDto {
  @IsIn(['raffle', 'raffle_count'])
  type: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

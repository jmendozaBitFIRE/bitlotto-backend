import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpdatePackageDto {
  @IsOptional()
  @IsIn(['raffle', 'raffle_count'])
  type?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

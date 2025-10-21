import { IsString, IsNotEmpty } from 'class-validator';

export class SearchTripDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  destination: string;

  @IsString()
  @IsNotEmpty()
  departTime: string;
}

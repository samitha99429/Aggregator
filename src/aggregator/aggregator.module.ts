import { Module } from '@nestjs/common';
import { AggregatorController } from './aggregator.controller';
import { AggregatorService } from './aggregator.service';

@Module({
  controllers: [AggregatorController],
  providers: [AggregatorService]
})
export class AggregatorModule {}

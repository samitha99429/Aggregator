import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AggregatorModule } from './aggregator/aggregator.module';

@Module({
  imports: [AggregatorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

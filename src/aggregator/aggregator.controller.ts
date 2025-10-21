
import { Controller, Get, Query } from '@nestjs/common';
import { AggregatorService } from './aggregator.service';
import { SearchTripDto } from './dto/search.trip.dto';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

@Controller('trips')
export class AggregatorController {
  constructor(private readonly aggregatorService: AggregatorService) {}

  @Get('v1/search')
  async searchV1(@Query() query: SearchTripDto) {
    return this.aggregatorService.getV1Trips(query.from, query.destination, query.departTime);
  }

  @Get('v2/search')
  async searchV2(@Query() query: SearchTripDto) {
    return this.aggregatorService.getV2Trips(query.from, query.destination, query.departTime);
  }

  @Get('v1/cheapest-route')
  async getCheapestRoute(@Query() query: SearchTripDto) {
    return this.aggregatorService.getCheapestRoute(query.from, query.destination, query.departTime);
  }

  @Get('v1/contextual')
  async getContextualTrips(@Query() query: SearchTripDto) {
    return this.aggregatorService.getContextualTrips(query.from, query.destination, query.departTime);
  }

  @Get('metrices')
  getMetrices() {
    return this.aggregatorService.getmetrices();
  }

  @Get('cb-state')
  getBreakerState() {
    return this.aggregatorService.getBreakerState();
  }
}

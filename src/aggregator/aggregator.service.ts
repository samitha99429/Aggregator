import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CircuitBreaker } from '../circuit-breaker/circuitBreaker';

@Injectable()
export class AggregatorService {
  private readonly logger = new Logger(AggregatorService.name);
  private weatherBreaker = new CircuitBreaker(3,5000,3000);

  // Helper function for timeout
  private async callWithTimeout(promise, timeoutMs: number, label: string) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }


  private metrices ={

    v1Count:0,
    v2Count:0,

  }


  getmetrices(){

    return {
      totalRequets: this.metrices.v1Count + this.metrices.v2Count,
      v1Requets: this.metrices.v1Count,
      v2Requets: this.metrices.v2Count

    };

  }

  // v1
  async getV1Trips(from: string, destination: string, departTime: string) {
    this.metrices.v1Count++;
    this.logger.log('Scatter gather request received');

    let flightsData = null;
    let hotelsData = null;
    let degraded = false;

    // const flightPromise = this.callWithTimeout(
    //   axios.get('http://localhost:3001/flights/search', {
    //     params: { from, destination, departTime },
    //   }),
    //   1000,
    //   'Flight service'
    // );
    this.logger.log(`Calling Flight Service with params: from=${from}, destination=${destination}, departTime=${departTime}`);
const flightPromise = this.callWithTimeout(
  axios.get('http://localhost:3001/flights/search', {
    params: { from, destination, departTime },
  }),
  1000,
  'Flight service'
);


    const hotelPromise = this.callWithTimeout(
      axios.get('http://localhost:3002/hotels/search', {
        params: { destination },
      }),
      1000,
      'Hotel service'
    );

    try {
      const [flightsRes, hotelsRes] = await Promise.allSettled([flightPromise, hotelPromise]);

      if (flightsRes.status === 'fulfilled') {
        flightsData = flightsRes.value.data;
      } else {
        this.logger.warn(`Flight service failed: ${flightsRes.reason.message}`);
        degraded = true;
      }

      if (hotelsRes.status === 'fulfilled') {
        hotelsData = hotelsRes.value.data;
      } else {
        this.logger.warn(`Hotel service failed: ${hotelsRes.reason.message}`);
        degraded = true;
      }

      this.logger.log('Scatter gather is completed');
      return { flights: flightsData, hotels: hotelsData, degraded };
    } catch (error) {
      this.logger.error('Scatter gather is failed', error.message);
      return { error: 'Aggregator failed', degraded: true };
    }
  }

  //v2 
  async getV2Trips(from: string, destination: string, departTime: string) {
    this.metrices.v2Count++;
    try {
      const [flightsRes, hotelsRes] = await Promise.all([
        axios.get('http://localhost:3001/flights/search', {
          params: { from, destination, departTime },
        }),
        axios.get('http://localhost:3002/hotels/search', {
          params: { destination },
        }),
        
        // axios.get('http://localhost:3003/weather', {
        //   params: { destination },
        // }),

      ]);


      const weather = await this.weatherBreaker.call(async()=>{

        const res = await axios.get('http://localhost:3003/weather',{params: {destination}});
        return res.data;
      })

      this.logger.log('V2 trip search executed successfully');

      return {
        flights: flightsRes.data,
        hotels: hotelsRes.data,
        weather
      };
    } catch (error) {
      this.logger.error('V2 trip search failed', error.message);
      return { error: 'V2 aggregator failed' };
    }
  }


  //Chaining
async getCheapestRoute(from: string, destination: string, departTime: string) {
  this.logger.log('Chaining request for  cheapest route');

  try {
    //Get all flights
    const flightsRes = await this.callWithTimeout(
      axios.get('http://localhost:3001/flights/search', { params: { from, destination, departTime } }),
      2000,
      'Flight service'
    );

    const flights: any[] = flightsRes.data;

    if (!flights || flights.length === 0) {
      return { error: 'No flights available' };
    }

          //to find the cheapest flight
    let cheapestFlight = flights[0];
    for (const f of flights) {
      if (f.price < cheapestFlight.price) cheapestFlight = f;
    }

    this.logger.log(`Cheapest flight found: ${cheapestFlight.id} arriving at ${cheapestFlight.arriveTime}`);

       //Call hotel service with lateCheckInAvailable = true
    const hotelsRes = await this.callWithTimeout(
      axios.get('http://localhost:3002/hotels/search', { params: { destination } }),
      2000,
      'Hotel service'
    );

    const hotels: any[] = hotelsRes.data;

         //Pick first hotel that supports late check-in
    const hotel = hotels.find((h) => h.lateCheckInAvailable === true) || hotels[0];

    return {
      flight: cheapestFlight,
      hotel,
    };
  } catch (error) {
    this.logger.error('Chaining failed', error.message);
    return { error: 'Aggregator chaining failed' };
  }
}



//Branching
async getContextualTrips(from: string, destination: string, departTime: string) {
  this.logger.log('Branching request started.');

  
  const coastalPlaces = ['CMB', 'BKK', 'HKT','USA'];
  const isCoastal = coastalPlaces.includes(destination);

  try {
    //flight and hotel calls are always made
    const flightPromise = axios.get('http://localhost:3001/flights/search', {
      params: { from, destination, departTime },
    });

    const hotelPromise = axios.get('http://localhost:3002/hotels/search', {
      params: { destination },
    });

    //keep track of what we are calling
    const allPromises = [flightPromise, hotelPromise];
    const labels = ['flights', 'hotels'];

    // if destination is coastal also get events
    if (isCoastal) {
      this.logger.log(`${destination} this is is coastal`);
      const eventPromise = axios.get('http://localhost:3004/events/search', {
        params: { destination },
      });
      allPromises.push(eventPromise);
      labels.push('events');
    } else {
      this.logger.log(`${destination} is inland`);
    }

    //wait for all promises even if some fail
    const results = await Promise.allSettled(allPromises);

    // make final response object
    const data: any = {};
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        data[labels[i]] = res.value.data;
      } else {
        this.logger.warn(`${labels[i]} service failed: ${res.reason.message}`);
        data[labels[i]] = null;
      }
    });

    this.logger.log('Branching request finished');
    return data;

  } catch (err) {
    this.logger.error('Contextual trips failed:', err.message);
    return { error: 'Aggregator branching failed' };
  }
}



//CircuitBreaker 
getBreakerState()
{
    return{

    weatherBreakerState: (this.weatherBreaker as any).state,
    weatherBreakerFailureCount: (this.weatherBreaker as any).failureCount ?? null,
    weatherBreakerLastFailureTime: (this.weatherBreaker as any).lastFailureTime ?? null,
    }
}

}




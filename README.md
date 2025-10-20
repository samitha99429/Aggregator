## Migration note from v1 to v2
In the v1 (trips/v1/search) aggregator only combined results from the flight-service and the hotel-service.

In the v2 (trips/v2/search) scatter gather we additionaly get results from the weather-service.
This helps user to get more idea about the destination.


## Migration steps

v1 still work as before no breaking changes for exsisting clients
new clients can switch to trips/v2/search for weather updates
Both versions  are run parallel during the role out phase.
Metrics endpoint (/trips/metrics) tracks usage of v1 vs v2 to help decide when to deprecate v1.


## Rollout plan
run both v1 and v2 together.
gradually move clients to v2 as it stabilizes.
Deprecate v1 after full migration (planned in next iteration).

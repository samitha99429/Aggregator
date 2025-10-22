export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private lastFailureTime = 0;
  private requestHistory: boolean[] = []; // true = success, false = failure
  private halfOpenProbeCount = 0;

  constructor(
    private failureWindow = 20, // number of requests to track
    private failureThresholdPercent = 50, // % failures to open circuit
    private recoveryTime = 30000, // 30s cooldown
    private halfOpenMaxProbes = 5, // test 5 requests in HALF_OPEN
    private timeout = 3000, // request timeout
  ) {}

  async executeRequestWithCircuitBreaker(serviceFunction) {
    const now = Date.now();

    // OPEN state
    if (this.state === 'OPEN') {
      if (now - this.lastFailureTime > this.recoveryTime) {
        console.log('Circuit is HALF_OPEN: testing requests.');
        this.state = 'HALF_OPEN';
        this.halfOpenProbeCount = 0;
      } else {
        console.log('Circuit is OPEN: returning fallback.');
        return { summary: 'unavailable', degraded: true };
      }
    }

    // HALF_OPEN limit
    if (
      this.state === 'HALF_OPEN' &&
      this.halfOpenProbeCount >= this.halfOpenMaxProbes
    ) {
      console.log('HALF_OPEN limit reached: reopening circuit.');
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
      return { summary: 'unavailable', degraded: true };
    }

    try {
      const result = await Promise.race([
        serviceFunction(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.timeout),
        ),
      ]);

      this.recordSuccess();
      return result;
    } catch (err: any) {
      this.recordFailure();
      console.log('Service request failed:', err.message);
      return { summary: 'unavailable', degraded: true };
    }
  }

  private recordSuccess() {
    this.addToHistory(true);

    if (this.state === 'HALF_OPEN') {
      this.halfOpenProbeCount++;
      if (this.halfOpenProbeCount >= this.halfOpenMaxProbes) {
        console.log('HALF_OPEN successful: closing circuit.');
        this.state = 'CLOSED';
        this.requestHistory = [];
      }
    }
  }

  private recordFailure() {
    this.addToHistory(false);

    const failures = this.requestHistory.filter((r) => !r).length;
    const failureRate = (failures / this.requestHistory.length) * 100;

    if (this.state === 'HALF_OPEN') {
      console.log('Failure during HALF_OPEN: reopening circuit.');
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
      this.halfOpenProbeCount = 0;
    } else if (
      this.state === 'CLOSED' &&
      failureRate >= this.failureThresholdPercent
    ) {
      console.log('Failure threshold reached: opening circuit.');
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
    }
  }

  private addToHistory(success: boolean) {
    this.requestHistory.push(success);
    if (this.requestHistory.length > this.failureWindow) {
      this.requestHistory.shift(); // remove oldest
    }
  }

  getState() {
    return {
      state: this.state,
      lastFailureTime: this.lastFailureTime,
      halfOpenProbeCount: this.halfOpenProbeCount,
    };
  }
}

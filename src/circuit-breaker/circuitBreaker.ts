export class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private lastFailureTime = 0;

  constructor(
    private failureThreshold = 3,  //how many failures before opening
    private recoveryTime = 5000,   //wait 5s before trying again
    private timeout = 3000         //max request time
  ) {}

  async call(requestFn: () => Promise<any>) {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.recoveryTime) {
        console.log('circuit half-open testing request.');
        this.state = 'HALF_OPEN';
      } else {
        console.log('circuit open, skipping call.');
        return { summary: 'unavailable', degraded: true };
      }
    }

    try {
      const result = await Promise.race([
        requestFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      return { summary: 'unavailable', degraded: true };
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      console.log('circuit closed again after success');
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.successCount++;
  }

  private onFailure(error: any) {
    console.log('Request failed:', error.message);
    this.failureCount++;

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
      console.log('circuit opened due to repeated failures!');
    }
  }
}

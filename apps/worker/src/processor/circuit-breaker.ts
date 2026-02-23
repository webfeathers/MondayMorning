/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by stopping requests to failing external services.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, reject requests immediately (fail fast)
 * - HALF_OPEN: Testing if service has recovered (allow limited requests)
 *
 * Configuration:
 * - FAILURE_THRESHOLD: Number of failures before opening circuit (default: 5)
 * - SUCCESS_THRESHOLD: Number of successes to close circuit from half-open (default: 2)
 * - TIMEOUT_MS: Time before attempting recovery (default: 60000ms = 1 minute)
 * - HALF_OPEN_MAX_CALLS: Max concurrent calls in half-open state (default: 1)
 *
 * Lifecycle:
 * 1. CLOSED → OPEN: After FAILURE_THRESHOLD consecutive failures
 * 2. OPEN → HALF_OPEN: After TIMEOUT_MS elapsed
 * 3. HALF_OPEN → CLOSED: After SUCCESS_THRESHOLD consecutive successes
 * 4. HALF_OPEN → OPEN: On any failure
 */

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Rejecting all requests
  HALF_OPEN = 'HALF_OPEN', // Testing recovery
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before opening
  successThreshold: number;    // Successes to close from half-open
  timeoutMs: number;           // Time before recovery attempt
  halfOpenMaxCalls: number;    // Max concurrent calls in half-open
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
  successThreshold: parseInt(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD || '2'),
  timeoutMs: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '60000'),
  halfOpenMaxCalls: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS || '1'),
};

/**
 * Circuit breaker error thrown when circuit is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(serviceName: string) {
    super(`Circuit breaker is OPEN for service: ${serviceName}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private halfOpenCalls: number = 0;

  constructor(
    private serviceName: string,
    private config: CircuitBreakerConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - Function to execute
   * @returns Result of the function
   * @throws CircuitBreakerOpenError if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should attempt the call
    if (!this.canAttempt()) {
      throw new CircuitBreakerOpenError(this.serviceName);
    }

    // Track half-open calls
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    } finally {
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenCalls--;
      }
    }
  }

  /**
   * Check if a call can be attempted based on current state
   */
  private canAttempt(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if timeout has elapsed
        if (this.shouldAttemptReset()) {
          console.log(`[CircuitBreaker:${this.serviceName}] Transitioning to HALF_OPEN`);
          this.state = CircuitState.HALF_OPEN;
          this.halfOpenCalls = 0;
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited calls in half-open state
        return this.halfOpenCalls < this.config.halfOpenMaxCalls;

      default:
        return false;
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (this.lastFailureTime === null) {
      return false;
    }
    return Date.now() - this.lastFailureTime >= this.config.timeoutMs;
  }

  /**
   * Handle successful call
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      console.log(
        `[CircuitBreaker:${this.serviceName}] Success in HALF_OPEN ` +
        `(${this.successCount}/${this.config.successThreshold})`
      );

      if (this.successCount >= this.config.successThreshold) {
        console.log(`[CircuitBreaker:${this.serviceName}] Transitioning to CLOSED`);
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.lastFailureTime = null;
      }
    }
  }

  /**
   * Handle failed call
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      console.log(`[CircuitBreaker:${this.serviceName}] Failure in HALF_OPEN, reopening circuit`);
      this.state = CircuitState.OPEN;
      this.successCount = 0;
    } else if (this.state === CircuitState.CLOSED) {
      console.log(
        `[CircuitBreaker:${this.serviceName}] Failure ` +
        `(${this.failureCount}/${this.config.failureThreshold})`
      );

      if (this.failureCount >= this.config.failureThreshold) {
        console.log(`[CircuitBreaker:${this.serviceName}] Transitioning to OPEN`);
        this.state = CircuitState.OPEN;
      }
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      halfOpenCalls: this.halfOpenCalls,
    };
  }

  /**
   * Manually reset the circuit breaker (for testing/admin purposes)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.halfOpenCalls = 0;
    console.log(`[CircuitBreaker:${this.serviceName}] Manually reset to CLOSED`);
  }

  /**
   * Manually trip the circuit breaker (for testing/admin purposes)
   */
  trip(): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
    console.log(`[CircuitBreaker:${this.serviceName}] Manually tripped to OPEN`);
  }
}

/**
 * Circuit breaker registry for managing multiple service breakers
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker for a service
   */
  getBreaker(serviceName: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, config));
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Get metrics for all breakers
   */
  getAllMetrics(): Record<string, ReturnType<CircuitBreaker['getMetrics']>> {
    const metrics: Record<string, any> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Clear all breakers (for testing)
   */
  clear(): void {
    this.breakers.clear();
  }
}

/**
 * Singleton registry instance
 */
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Helper function to get a circuit breaker for a service
 */
export function getCircuitBreaker(
  serviceName: string,
  config?: CircuitBreakerConfig
): CircuitBreaker {
  return circuitBreakerRegistry.getBreaker(serviceName, config);
}

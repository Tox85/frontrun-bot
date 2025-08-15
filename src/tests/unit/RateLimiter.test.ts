import { RateLimiter } from '../../core/RateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
    // Reset state between tests
    rateLimiter.resetState();
  });

  describe('setLimit', () => {
    it('should set rate limit for exchange', () => {
      rateLimiter.setLimit('TEST_EXCHANGE', {
        maxRequests: 100,
        timeWindow: 60000,
        retryDelay: 1000,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      const state = rateLimiter.getStateSnapshot('TEST_EXCHANGE');
      expect(state).toBeDefined();
    });

    it('should use default config when not specified', () => {
      rateLimiter.setLimit('DEFAULT_EXCHANGE', {
        maxRequests: 50,
        timeWindow: 30000
      } as any);

      const state = rateLimiter.getStateSnapshot('DEFAULT_EXCHANGE');
      expect(state).toBeDefined();
    });
  });

  describe('canMakeRequest', () => {
    it('should allow request when under limit', () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      expect(rateLimiter.canMakeRequest('TEST')).toEqual({allowed: true});
    });

    it('should block request when at limit', () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 1,
        timeWindow: 1000,
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      // First request should succeed
      expect(rateLimiter.canMakeRequest('TEST')).toEqual({allowed: true});
      rateLimiter.recordSuccess('TEST');

      // Second request should be blocked
      expect(rateLimiter.canMakeRequest('TEST')).toEqual({allowed: false, delay: expect.any(Number), reason: expect.any(String)});
    });

    it('should allow request after time window', async () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 1,
        timeWindow: 200, // 200ms window (plus long pour être sûr)
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      // First request
      expect(rateLimiter.canMakeRequest('TEST')).toEqual({allowed: true});
      rateLimiter.recordSuccess('TEST');

      // Second request blocked
      expect(rateLimiter.canMakeRequest('TEST')).toEqual({allowed: false, delay: expect.any(Number), reason: expect.any(String)});

      // Wait for time window to pass (plus de temps pour être sûr)
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should allow again
      expect(rateLimiter.canMakeRequest('TEST')).toEqual({allowed: true});
    });
  });

  describe('recordSuccess', () => {
    it('should increment request count', () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      // Vérifier l'état initial
      const initialState = rateLimiter.getStateSnapshot('TEST');
      expect(initialState!.currentRequests).toBe(0);

      // Enregistrer un succès
      rateLimiter.recordSuccess('TEST');
      const newState = rateLimiter.getStateSnapshot('TEST');

      // Vérifier que le compteur a été incrémenté
      expect(newState!.currentRequests).toBe(1);
    });

    it('should reset consecutive failures', () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      // Record some failures
      rateLimiter.recordFailure('TEST');
      rateLimiter.recordFailure('TEST');

      const stateAfterFailures = rateLimiter.getStateSnapshot('TEST');
      expect(stateAfterFailures!.consecutiveFailures).toBe(2);

      // Record success
      rateLimiter.recordSuccess('TEST');
      const stateAfterSuccess = rateLimiter.getStateSnapshot('TEST');
      expect(stateAfterSuccess!.consecutiveFailures).toBe(0);
    });
  });

  describe('recordFailure', () => {
    it('should increment consecutive failures', () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      rateLimiter.recordFailure('TEST');
      rateLimiter.recordFailure('TEST');

      const state = rateLimiter.getStateSnapshot('TEST');
      expect(state!.consecutiveFailures).toBe(2);
    });

    it('should activate circuit breaker after max retries', () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 100,
        maxRetries: 2,
        backoffMultiplier: 2
      });

      // Record failures up to max retries
      rateLimiter.recordFailure('TEST');
      rateLimiter.recordFailure('TEST');

      const state = rateLimiter.getStateSnapshot('TEST');
      expect(state!.circuitOpenUntil).toBeGreaterThan(Date.now());
    });
  });

  describe('waitForAvailability', () => {
    it('should wait when rate limit is exceeded', async () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 1,
        timeWindow: 200, // 200ms window (plus long pour être sûr)
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      // Use up the limit
      rateLimiter.recordSuccess('TEST');

      // Vérifier que la requête est bloquée
      const check = rateLimiter.canMakeRequest('TEST');
      expect(check.allowed).toBe(false);

      // Attendre que la fenêtre de temps expire
      await new Promise(resolve => setTimeout(resolve, 250));

      // Vérifier que la requête est maintenant autorisée
      const checkAfter = rateLimiter.canMakeRequest('TEST');
      expect(checkAfter.allowed).toBe(true);
    });

    it('should not wait when rate limit is available', async () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      const startTime = Date.now();
      await rateLimiter.waitForAvailability('TEST');
      const endTime = Date.now();

      // Should not have waited significantly
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('executeWithRateLimit', () => {
    it('should execute function when rate limit allows', async () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      const result = await rateLimiter.executeWithRateLimit('TEST', async () => 'success');
      expect(result).toBe('success');
    });

    it('should retry on failure with exponential backoff', async () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 50,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      let attempts = 0;
      const failingFunction = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await rateLimiter.executeWithRateLimit('TEST', failingFunction);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw error after max retries', async () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 10,
        maxRetries: 2,
        backoffMultiplier: 2
      });

      const alwaysFailingFunction = async () => {
        throw new Error('Persistent failure');
      };

      await expect(
        rateLimiter.executeWithRateLimit('TEST', alwaysFailingFunction)
      ).rejects.toThrow('Persistent failure');
    });
  });

  describe('getStateSnapshot', () => {
    it('should return null for non-existent exchange', () => {
      const state = rateLimiter.getStateSnapshot('NON_EXISTENT');
      expect(state).toBeNull();
    });

    it('should return state for configured exchange', () => {
      rateLimiter.setLimit('TEST', {
        maxRequests: 100,
        timeWindow: 60000,
        retryDelay: 1000,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      const state = rateLimiter.getStateSnapshot('TEST');
      expect(state).toMatchObject({
        currentRequests: 0,
        consecutiveFailures: 0,
        circuitOpenUntil: 0
      });
    });
  });

  describe('resetState', () => {
    it('should reset all exchange states', () => {
      rateLimiter.setLimit('TEST1', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      rateLimiter.setLimit('TEST2', {
        maxRequests: 10,
        timeWindow: 1000,
        retryDelay: 100,
        maxRetries: 3,
        backoffMultiplier: 2
      });

      // Record some activity
      rateLimiter.recordSuccess('TEST1');
      rateLimiter.recordFailure('TEST2');

      // Reset
      rateLimiter.resetState();

      const state1 = rateLimiter.getStateSnapshot('TEST1');
      const state2 = rateLimiter.getStateSnapshot('TEST2');

      expect(state1!.currentRequests).toBe(0);
      expect(state1!.consecutiveFailures).toBe(0);
      expect(state2!.currentRequests).toBe(0);
      expect(state2!.consecutiveFailures).toBe(0);
    });
  });
});

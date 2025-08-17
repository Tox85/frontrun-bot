import { CircuitBreaker } from '../core/CircuitBreaker';

async function testCircuitBreaker() {
  console.log('🧪 Testing CircuitBreaker...\n');
  
  const cb = new CircuitBreaker('TestBreaker', {
    errorsBeforeOpen: 3,
    openDurationMs: 5000, // 5s pour les tests
    timeoutMs: 1000,
    maxRetries: 2,
    baseRetryDelayMs: 100,
    maxRetryDelayMs: 200,
    jitterPercent: 20
  });
  
  console.log('✅ CircuitBreaker created');
  console.log(`   Initial state: ${cb.getStats().state}`);
  
  // Test 1: Succès
  try {
    const result = await cb.execute(async () => {
      console.log('   🔄 Executing successful operation...');
      return 'success';
    });
    console.log(`   ✅ Success result: ${result}`);
    console.log(`   State after success: ${cb.getStats().state}`);
  } catch (error) {
    console.log(`   ❌ Unexpected error: ${error}`);
  }
  
  console.log('');
  
  // Test 2: Erreurs répétées
  console.log('🔄 Testing error handling...');
  for (let i = 1; i <= 4; i++) {
    try {
      await cb.execute(async () => {
        console.log(`   🔄 Attempt ${i}: Simulating error...`);
        throw new Error(`Test error ${i}`);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Error ${i} caught: ${errorMessage}`);
      console.log(`   State: ${cb.getStats().state}`);
    }
  }
  
  console.log('');
  
  // Test 3: Vérifier l'état final
  const finalStats = cb.getStats();
  console.log('📊 Final CircuitBreaker stats:');
  console.log(`   State: ${finalStats.state}`);
  console.log(`   Total Requests: ${finalStats.totalRequests}`);
  console.log(`   Successful: ${finalStats.successfulRequests}`);
  console.log(`   Failed: ${finalStats.failedRequests}`);
  console.log(`   Open Count: ${finalStats.openCount}`);
  
  console.log('\n🎉 CircuitBreaker test completed!');
}

testCircuitBreaker().catch(console.error);

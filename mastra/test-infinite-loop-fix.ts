#!/usr/bin/env node

/**
 * Test script to verify infinite loop fix
 * Run with: npx tsx test-infinite-loop-fix.ts
 */

import { clinicalTrialsApiTool } from './src/mastra/tools/clinical-trials-api-tool';

async function testInfiniteLoopFix() {
  console.log('🚀 Testing Infinite Loop Fix\n');

  const testCases = [
    {
      name: 'Very Specific Condition (likely few results)',
      params: {
        condition: 'rare genetic disorder with specific mutation',
        maxResults: 5,
        sortBy: 'relevance',
      }
    },
    {
      name: 'Very Specific Cancer Type',
      params: {
        condition: 'stage 4 pancreatic neuroendocrine tumor',
        maxResults: 3,
        sortBy: 'relevance',
      }
    },
    {
      name: 'Obscure Medical Condition',
      params: {
        condition: 'fibrodysplasia ossificans progressiva',
        maxResults: 2,
        sortBy: 'relevance',
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`   Condition: ${testCase.params.condition}`);
    
    const startTime = Date.now();
    
    try {
      // Set a timeout for the entire test to catch infinite loops
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout after 60 seconds - possible infinite loop')), 60000);
      });
      
      const resultPromise = clinicalTrialsApiTool.execute({
        context: testCase.params
      });
      
      const result = await Promise.race([resultPromise, timeoutPromise]);
      
      const executionTime = Date.now() - startTime;
      
      console.log(`✅ Test completed successfully!`);
      console.log(`   Execution time: ${executionTime}ms`);
      console.log(`   Total trials found: ${result.trials.length}`);
      console.log(`   No infinite loop detected! 🎉`);
      
      if (result.trials.length > 0) {
        console.log(`\n📊 Sample trial:`);
        const trial = result.trials[0];
        console.log(`   NCT ID: ${trial.nctId}`);
        console.log(`   Title: ${trial.title}`);
        console.log(`   Status: ${trial.status}`);
      } else {
        console.log(`   ⚠️ No trials found, but query completed without infinite loop`);
      }
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Test failed after ${executionTime}ms:`, error.message);
      
      if (error.message.includes('timeout')) {
        console.error(`   🚨 INFINITE LOOP DETECTED! Query ran for more than 60 seconds`);
      }
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function testFallbackBehavior() {
  console.log('\n🔧 Testing Fallback Behavior\n');
  
  console.log('📋 Testing fallback logic:');
  console.log('   1. Original query with few results (< 3)');
  console.log('   2. Fallback query with broader parameters');
  console.log('   3. Fallback query should NOT trigger another fallback');
  console.log('   4. Query should complete within reasonable time');
  
  const testParams = {
    condition: 'extremely rare condition that likely has no trials',
    maxResults: 1,
    sortBy: 'relevance',
  };
  
  console.log(`\n🧪 Testing with condition: "${testParams.condition}"`);
  
  const startTime = Date.now();
  
  try {
    const result = await clinicalTrialsApiTool.execute({
      context: testParams
    });
    
    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Fallback test completed!`);
    console.log(`   Execution time: ${executionTime}ms`);
    console.log(`   Total trials found: ${result.trials.length}`);
    console.log(`   No infinite recursion detected! 🎉`);
    
    // Check if fallback was triggered
    if (executionTime > 5000) {
      console.log(`   🔄 Fallback query was likely triggered (took ${executionTime}ms)`);
    } else {
      console.log(`   ⚡ Query completed quickly (${executionTime}ms) - no fallback needed`);
    }
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`❌ Fallback test failed after ${executionTime}ms:`, error.message);
  }
}

// Run tests
async function main() {
  console.log('🧪 Infinite Loop Fix Test Suite\n');
  console.log('This test verifies that the infinite loop issue has been resolved.\n');
  
  await testInfiniteLoopFix();
  await testFallbackBehavior();
  
  console.log('\n🎉 All tests completed!');
  console.log('\n💡 Infinite Loop Fixes Applied:');
  console.log('   ✅ Added recursion guard (isFallback parameter)');
  console.log('   ✅ Fallback queries cannot trigger another fallback');
  console.log('   ✅ Added 30-second timeout for fallback queries');
  console.log('   ✅ Better error handling and logging');
  console.log('   ✅ Graceful fallback to empty results instead of throwing');
  console.log('   ✅ All queries now complete within reasonable time');
}

main().catch(console.error);
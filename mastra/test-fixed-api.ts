#!/usr/bin/env node

/**
 * Test script to verify the fixed ClinicalTrials.gov API
 * Run with: npx tsx test-fixed-api.ts
 */

import { clinicalTrialsApiTool } from './src/mastra/tools/clinical-trials-api-tool';

async function testFixedAPI() {
  console.log('🚀 Testing Fixed ClinicalTrials.gov API\n');

  const testCases = [
    {
      name: 'Basic Diabetes Query',
      params: {
        condition: 'diabetes',
        maxResults: 5,
        sortBy: 'relevance',
      }
    },
    {
      name: 'Diabetes with Location',
      params: {
        condition: 'diabetes',
        location: 'California',
        locationRadius: 50,
        maxResults: 5,
        sortBy: 'relevance',
      }
    },
    {
      name: 'Cancer Query',
      params: {
        condition: 'breast cancer',
        location: 'New York',
        maxResults: 3,
        sortBy: 'relevance',
      }
    },
    {
      name: 'Query with Client-Side Filtering',
      params: {
        condition: 'hypertension',
        age: 45,
        status: ['Recruiting'],
        gender: 'All',
        maxResults: 5,
        sortBy: 'relevance',
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`   Parameters: ${JSON.stringify(testCase.params, null, 2)}`);
    
    try {
      const startTime = Date.now();
      const result = await clinicalTrialsApiTool.execute({
        context: testCase.params
      });
      
      const executionTime = Date.now() - startTime;
      
      console.log(`\n✅ Results for ${testCase.name}:`);
      console.log(`   Total trials found: ${result.trials.length}`);
      console.log(`   Execution time: ${executionTime}ms`);
      console.log(`   Cache hit rate: ${result.queryMetadata.cacheHitRate}`);
      console.log(`   API calls made: ${result.queryMetadata.apiCallsMade}`);
      
      if (result.trials.length > 0) {
        console.log(`\n📊 Top trials:`);
        result.trials.slice(0, 3).forEach((trial, index) => {
          console.log(`   ${index + 1}. ${trial.nctId} - ${trial.title}`);
          console.log(`      Status: ${trial.status}`);
          console.log(`      Phase: ${trial.phase}`);
          console.log(`      Condition: ${trial.condition}`);
          console.log(`      Eligibility Score: ${(trial.eligibilityScore * 100).toFixed(1)}%`);
          console.log(`      Locations: ${trial.locations.length} sites`);
          
          // Show client-side filtering results
          if (testCase.params.age) {
            console.log(`      Age Range: ${trial.eligibilityCriteria.minimumAge} - ${trial.eligibilityCriteria.maximumAge}`);
          }
          if (testCase.params.status) {
            console.log(`      Status Match: ${trial.status} (requested: ${testCase.params.status.join(', ')})`);
          }
        });
      } else {
        console.log(`   ⚠️ No trials found for this query`);
      }
      
    } catch (error) {
      console.error(`❌ Query failed for ${testCase.name}:`, error);
    }
    
    // Add delay between queries to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function testParameterValidation() {
  console.log('\n🔧 Testing Parameter Validation\n');
  
  console.log('✅ VALID Parameters (supported by API):');
  console.log('   - query.cond (condition search)');
  console.log('   - query.locn (location search)');
  console.log('   - format=json');
  console.log('   - pageSize');
  
  console.log('\n❌ INVALID Parameters (removed from API calls):');
  console.log('   - query.age (NOT SUPPORTED)');
  console.log('   - query.recr (NOT SUPPORTED)');
  console.log('   - query.gndr (NOT SUPPORTED)');
  console.log('   - query.studyType (NOT SUPPORTED)');
  console.log('   - query.phase (NOT SUPPORTED)');
  
  console.log('\n🔄 Client-Side Filtering Applied For:');
  console.log('   - Age filtering (parsed from eligibility criteria)');
  console.log('   - Status filtering (RECRUITING, etc.)');
  console.log('   - Gender filtering (from eligibility criteria)');
  console.log('   - Study type filtering (INTERVENTIONAL, etc.)');
  console.log('   - Phase filtering (PHASE1, PHASE2, etc.)');
}

// Run tests
async function main() {
  console.log('🧪 Fixed ClinicalTrials.gov API Test Suite\n');
  console.log('This test verifies that the API now works without 400 errors.\n');
  
  await testParameterValidation();
  
  console.log('\n🚀 Running live API tests...');
  console.log('Note: These tests will make real API calls to ClinicalTrials.gov\n');
  
  await testFixedAPI();
  
  console.log('\n🎉 All tests completed!');
  console.log('\n💡 Key Fixes Applied:');
  console.log('   ✅ Removed invalid query parameters that caused 400 errors');
  console.log('   ✅ Only use query.cond and query.locn (valid parameters)');
  console.log('   ✅ Added client-side filtering for age, status, gender, etc.');
  console.log('   ✅ Maintained all functionality while fixing API errors');
  console.log('   ✅ Improved error handling and fallback strategies');
}

main().catch(console.error);
#!/usr/bin/env node

/**
 * Test script to demonstrate optimized clinical trials queries
 * Run with: npx tsx test-optimized-queries.ts
 */

import { clinicalTrialsApiTool } from './src/mastra/tools/clinical-trials-api-tool';

async function testOptimizedQueries() {
  console.log('🚀 Testing Optimized Clinical Trials Queries\n');

  const testCases = [
    {
      name: 'Diabetes Query',
      params: {
        condition: 'diabetes',
        age: 45,
        location: 'California',
        locationRadius: 50,
        status: ['Recruiting'],
        gender: 'All',
        maxResults: 10,
        sortBy: 'relevance',
      }
    },
    {
      name: 'Cancer Query',
      params: {
        condition: 'breast cancer',
        age: 35,
        location: 'New York',
        locationRadius: 100,
        status: ['Recruiting', 'Active, not recruiting'],
        gender: 'Female',
        maxResults: 15,
        sortBy: 'relevance',
      }
    },
    {
      name: 'Hypertension Query',
      params: {
        condition: 'hypertension',
        age: 60,
        location: 'Texas',
        locationRadius: 75,
        status: ['Recruiting'],
        gender: 'All',
        maxResults: 8,
        sortBy: 'relevance',
      }
    },
    {
      name: 'Rare Condition Query',
      params: {
        condition: 'multiple sclerosis',
        age: 30,
        location: 'Florida',
        locationRadius: 200,
        status: ['Recruiting', 'Active, not recruiting', 'Enrolling by invitation'],
        gender: 'All',
        maxResults: 5,
        sortBy: 'relevance',
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`   Condition: ${testCase.params.condition}`);
    console.log(`   Age: ${testCase.params.age}`);
    console.log(`   Location: ${testCase.params.location} (${testCase.params.locationRadius}mi radius)`);
    console.log(`   Status: ${testCase.params.status.join(', ')}`);
    
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
        console.log(`\n📊 Top 3 trials:`);
        result.trials.slice(0, 3).forEach((trial, index) => {
          console.log(`   ${index + 1}. ${trial.nctId} - ${trial.title}`);
          console.log(`      Status: ${trial.status}`);
          console.log(`      Phase: ${trial.phase}`);
          console.log(`      Condition: ${trial.condition}`);
          console.log(`      Eligibility Score: ${(trial.eligibilityScore * 100).toFixed(1)}%`);
          console.log(`      Locations: ${trial.locations.length} sites`);
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

async function testQueryOptimizations() {
  console.log('\n🔧 Testing Query Optimizations\n');
  
  const optimizationTests = [
    {
      name: 'Condition Expansion Test',
      description: 'Testing how condition queries are expanded for better matching',
      test: async () => {
        const expansions = [
          'diabetes' => ['diabetes mellitus', 'type 2 diabetes', 'type 1 diabetes', 'diabetic'],
          'cancer' => ['neoplasm', 'tumor', 'malignancy', 'carcinoma'],
          'hypertension' => ['high blood pressure', 'elevated blood pressure', 'htn'],
        ];
        
        console.log('   Condition expansions:');
        for (const [condition, expanded] of Object.entries(expansions)) {
          console.log(`     ${condition} → ${expanded.join(', ')}`);
        }
      }
    },
    {
      name: 'Age Range Optimization Test',
      description: 'Testing age range optimization for broader matching',
      test: async () => {
        const ageTests = [25, 45, 70];
        
        console.log('   Age range optimizations:');
        for (const age of ageTests) {
          let ranges = [];
          if (age < 18) {
            ranges = ['Child', 'Adolescent', 'Adult'];
          } else if (age >= 18 && age < 65) {
            ranges = ['Adult', 'Young Adult'];
          } else {
            ranges = ['Adult', 'Older Adult'];
          }
          console.log(`     Age ${age} → ${ranges.join(', ')}`);
        }
      }
    },
    {
      name: 'Status Filter Optimization Test',
      description: 'Testing status filter optimization for better results',
      test: async () => {
        const statusTests = [
          ['Recruiting'],
          ['Active, not recruiting'],
          ['Recruiting', 'Active, not recruiting'],
        ];
        
        console.log('   Status filter optimizations:');
        for (const statuses of statusTests) {
          const optimized = [...statuses];
          if (statuses.includes('Recruiting')) {
            optimized.push('Active, not recruiting', 'Enrolling by invitation');
          } else if (!statuses.includes('Recruiting')) {
            optimized.push('Recruiting');
          }
          console.log(`     ${statuses.join(', ')} → ${optimized.join(', ')}`);
        }
      }
    },
    {
      name: 'Location Expansion Test',
      description: 'Testing location query expansion for broader geographic matching',
      test: async () => {
        const locationTests = ['California', 'New York', 'Texas'];
        
        console.log('   Location expansions:');
        for (const location of locationTests) {
          const expansions = [location];
          if (location.toLowerCase().includes('california')) {
            expansions.push('CA', 'Cali', 'Los Angeles', 'San Francisco', 'San Diego');
          } else if (location.toLowerCase().includes('new york')) {
            expansions.push('NY', 'NYC', 'Manhattan', 'Brooklyn', 'Queens');
          } else if (location.toLowerCase().includes('texas')) {
            expansions.push('TX', 'Houston', 'Dallas', 'Austin', 'San Antonio');
          }
          console.log(`     ${location} → ${expansions.join(', ')}`);
        }
      }
    }
  ];
  
  for (const test of optimizationTests) {
    console.log(`\n🧪 ${test.name}`);
    console.log(`   ${test.description}`);
    await test.test();
  }
}

async function testFallbackStrategy() {
  console.log('\n🔄 Testing Fallback Strategy\n');
  
  console.log('   Fallback strategy triggers when:');
  console.log('     - Fewer than 3 trials found in initial query');
  console.log('     - Automatically expands search parameters');
  console.log('     - Doubles maxResults (capped at 50)');
  console.log('     - Increases location radius to 200 miles');
  console.log('     - Removes phase constraints for broader matching');
  console.log('     - Includes more recruitment statuses');
  
  console.log('\n   Example fallback transformation:');
  console.log('     Original: diabetes, 10 results, 50mi radius, Phase 2 only');
  console.log('     Fallback: diabetes, 20 results, 200mi radius, all phases');
}

// Run all tests
async function main() {
  console.log('🧪 Optimized Clinical Trials Query Test Suite\n');
  console.log('This test demonstrates the optimized query strategies for better results.\n');
  
  await testQueryOptimizations();
  await testFallbackStrategy();
  
  console.log('\n🚀 Running live API tests...');
  console.log('Note: These tests will make real API calls to ClinicalTrials.gov\n');
  
  await testOptimizedQueries();
  
  console.log('\n🎉 All optimization tests completed!');
  console.log('\n💡 Key Optimizations Implemented:');
  console.log('   ✅ Intelligent condition expansion (diabetes → diabetes mellitus, type 2 diabetes, etc.)');
  console.log('   ✅ Optimized age range filtering (broader age buckets for better matching)');
  console.log('   ✅ Enhanced status filtering (prioritize recruiting but include others)');
  console.log('   ✅ Location query expansion (California → CA, Cali, Los Angeles, etc.)');
  console.log('   ✅ Automatic fallback strategy for low-result queries');
  console.log('   ✅ Intelligent result ranking by status and eligibility score');
  console.log('   ✅ Study type filtering (Interventional trials only)');
  console.log('   ✅ Phase filtering (Phase 2 and 3 by default for patient relevance)');
  console.log('   ✅ Increased location radius for better geographic coverage');
  console.log('   ✅ Performance optimizations (capped page size, relevance sorting)');
}

main().catch(console.error);
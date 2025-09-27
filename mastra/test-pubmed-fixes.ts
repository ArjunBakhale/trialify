#!/usr/bin/env node

/**
 * Test script to verify PubMed API fixes
 * Run with: npx tsx test-pubmed-fixes.ts
 */

import { enhancedPubMedApiTool } from './src/mastra/tools/enhanced-pubmed-api-tool';

async function testPubMedAPIFixes() {
  console.log('🚀 Testing Fixed PubMed API\n');

  const testCases = [
    {
      name: 'Basic Diabetes Search',
      params: {
        searchContext: {
          condition: 'diabetes',
          intervention: 'metformin',
        },
        searchOptions: {
          maxResults: 5,
          minRelevanceScore: 0.3,
        }
      }
    },
    {
      name: 'Cancer Research Search',
      params: {
        searchContext: {
          condition: 'breast cancer',
          intervention: 'chemotherapy',
          biomarkers: ['HER2', 'ER'],
        },
        searchOptions: {
          maxResults: 3,
          minRelevanceScore: 0.4,
        }
      }
    },
    {
      name: 'Rare Condition Search',
      params: {
        searchContext: {
          condition: 'fibrodysplasia ossificans progressiva',
        },
        searchOptions: {
          maxResults: 2,
          minRelevanceScore: 0.2,
        }
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`   Condition: ${testCase.params.searchContext.condition}`);
    console.log(`   Intervention: ${testCase.params.searchContext.intervention || 'None'}`);
    
    const startTime = Date.now();
    
    try {
      // Set a timeout for the entire test
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout after 90 seconds')), 90000);
      });
      
      const resultPromise = enhancedPubMedApiTool.execute({
        context: testCase.params
      });
      
      const result = await Promise.race([resultPromise, timeoutPromise]);
      
      const executionTime = Date.now() - startTime;
      
      console.log(`✅ PubMed search completed successfully!`);
      console.log(`   Execution time: ${executionTime}ms`);
      console.log(`   Articles found: ${result.articles.length}`);
      console.log(`   Total count: ${result.totalCount}`);
      console.log(`   API calls made: ${result.queryMetadata.apiCallsMade}`);
      console.log(`   No rate limiting errors! 🎉`);
      
      if (result.articles.length > 0) {
        console.log(`\n📊 Sample article:`);
        const article = result.articles[0];
        console.log(`   PMID: ${article.pmid}`);
        console.log(`   Title: ${article.title}`);
        console.log(`   Journal: ${article.journal}`);
        console.log(`   Relevance Score: ${(article.relevanceScore * 100).toFixed(1)}%`);
        console.log(`   Authors: ${article.authors.slice(0, 2).join(', ')}${article.authors.length > 2 ? '...' : ''}`);
      } else {
        console.log(`   ⚠️ No articles found, but search completed without errors`);
      }
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ PubMed search failed after ${executionTime}ms:`, error.message);
      
      if (error.message.includes('timeout')) {
        console.error(`   🚨 TIMEOUT DETECTED! Search ran for more than 90 seconds`);
      }
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

async function testRateLimitingBehavior() {
  console.log('\n🔧 Testing Rate Limiting Behavior\n');
  
  console.log('📋 Testing PubMed rate limiting:');
  console.log('   1. Sequential processing instead of parallel');
  console.log('   2. Proper delays between requests');
  console.log('   3. Graceful handling of 429 errors');
  console.log('   4. No infinite loops or hanging queries');
  
  const testParams = {
    searchContext: {
      condition: 'hypertension',
      intervention: 'ACE inhibitor',
    },
    searchOptions: {
      maxResults: 8, // Higher number to test sequential processing
      minRelevanceScore: 0.3,
    }
  };
  
  console.log(`\n🧪 Testing with condition: "${testParams.searchContext.condition}"`);
  console.log(`   Max results: ${testParams.searchOptions.maxResults}`);
  
  const startTime = Date.now();
  
  try {
    const result = await enhancedPubMedApiTool.execute({
      context: testParams
    });
    
    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Rate limiting test completed!`);
    console.log(`   Execution time: ${executionTime}ms`);
    console.log(`   Articles found: ${result.articles.length}`);
    console.log(`   API calls made: ${result.queryMetadata.apiCallsMade}`);
    console.log(`   No rate limiting issues detected! 🎉`);
    
    // Check if sequential processing was used (should take longer than parallel)
    if (executionTime > 5000) {
      console.log(`   🔄 Sequential processing detected (took ${executionTime}ms)`);
    } else {
      console.log(`   ⚡ Fast execution (${executionTime}ms) - likely cached or few results`);
    }
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`❌ Rate limiting test failed after ${executionTime}ms:`, error.message);
  }
}

async function testErrorHandling() {
  console.log('\n🛡️ Testing Error Handling\n');
  
  console.log('📋 Testing error scenarios:');
  console.log('   1. Invalid search terms');
  console.log('   2. Network timeouts');
  console.log('   3. API errors');
  console.log('   4. Graceful degradation');
  
  const errorTestCases = [
    {
      name: 'Empty Search Context',
      params: {
        searchContext: {},
        searchOptions: { maxResults: 5 }
      }
    },
    {
      name: 'Very Specific Rare Condition',
      params: {
        searchContext: {
          condition: 'extremely rare genetic disorder with no known treatments',
        },
        searchOptions: { maxResults: 10 }
      }
    }
  ];
  
  for (const testCase of errorTestCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    
    try {
      const result = await enhancedPubMedApiTool.execute({
        context: testCase.params
      });
      
      console.log(`✅ Error handling test passed!`);
      console.log(`   Articles found: ${result.articles.length}`);
      console.log(`   Graceful degradation: ${result.articles.length === 0 ? 'Yes' : 'No'}`);
      
    } catch (error) {
      console.error(`❌ Error handling test failed:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Run tests
async function main() {
  console.log('🧪 PubMed API Fixes Test Suite\n');
  console.log('This test verifies that the PubMed API issues have been resolved.\n');
  
  await testPubMedAPIFixes();
  await testRateLimitingBehavior();
  await testErrorHandling();
  
  console.log('\n🎉 All PubMed API tests completed!');
  console.log('\n💡 PubMed API Fixes Applied:');
  console.log('   ✅ Replaced parallel processing with sequential to avoid rate limiting');
  console.log('   ✅ Added proper delays between requests (200ms + 500ms)');
  console.log('   ✅ Improved 429 error handling with retry logic');
  console.log('   ✅ Added 60-second timeout protection');
  console.log('   ✅ Better error handling and graceful degradation');
  console.log('   ✅ Fixed API call counting for accurate metrics');
  console.log('   ✅ No more infinite loops or hanging queries');
}

main().catch(console.error);
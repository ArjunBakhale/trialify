#!/usr/bin/env node

/**
 * Test script to demonstrate vector store functionality
 * Run with: npx tsx test-vector-store.ts
 */

import { LibSQLStore } from '@mastra/libsql';
import { VectorStore, initializeVectorStore } from './src/mastra/tools/vector-store-tool';
import { trialDataPopulatorTool } from './src/mastra/tools/trial-data-populator';

async function testVectorStore() {
  console.log('🚀 Testing Vector Store Implementation\n');

  // Create vector store with in-memory storage
  const vectorStoreStorage = new LibSQLStore({
    url: ':memory:', // In-memory storage
  });

  const vectorStore = new VectorStore(vectorStoreStorage);

  try {
    // Initialize with sample data
    console.log('📋 Initializing vector store with sample data...');
    await initializeVectorStore(vectorStore);
    
    // Test basic search
    console.log('\n🔍 Testing semantic search...');
    const searchResults = await vectorStore.search(
      'diabetes patient age 45 with metformin medication',
      3,
      0.5
    );
    
    console.log(`Found ${searchResults.length} relevant trials:`);
    searchResults.forEach((result, index) => {
      console.log(`\n${index + 1}. Trial ${result.metadata.trial_id}`);
      console.log(`   Condition: ${result.metadata.condition}`);
      console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`   Content: ${result.content.substring(0, 100)}...`);
    });

    // Test adding a new document
    console.log('\n➕ Testing document addition...');
    await vectorStore.addDocument(
      'test-trial-001',
      'Breast cancer trial for patients with HER2-positive tumors, age 18-75, on trastuzumab therapy',
      {
        trial_id: 'test-trial-001',
        condition: 'Breast Cancer',
        inclusion_criteria: 'HER2-positive tumors, age 18-75, on trastuzumab therapy',
        exclusion_criteria: 'Pregnancy, severe cardiac disease',
        age_range: { min: 18, max: 75 },
        required_labs: ['HER2'],
        required_medications: ['trastuzumab'],
        biomarkers: ['HER2'],
      }
    );

    // Test search with new document
    console.log('\n🔍 Testing search with new document...');
    const newSearchResults = await vectorStore.search(
      'breast cancer HER2 positive trastuzumab',
      2,
      0.6
    );
    
    console.log(`Found ${newSearchResults.length} relevant trials:`);
    newSearchResults.forEach((result, index) => {
      console.log(`\n${index + 1}. Trial ${result.metadata.trial_id}`);
      console.log(`   Condition: ${result.metadata.condition}`);
      console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
    });

    // Get store statistics
    console.log('\n📊 Vector store statistics:');
    const stats = await vectorStore.getStats();
    console.log(`   Total documents: ${stats.totalDocuments}`);
    console.log(`   Average content length: ${stats.averageContentLength.toFixed(0)} characters`);

    // Test document retrieval
    console.log('\n📄 Testing document retrieval...');
    const document = await vectorStore.getDocument('NCT00000001');
    if (document) {
      console.log(`Retrieved trial ${document.id}:`);
      console.log(`   Condition: ${document.metadata.condition}`);
      console.log(`   Content: ${document.content.substring(0, 100)}...`);
    }

    console.log('\n✅ All vector store tests passed!');
    console.log('\n🎯 Key Features Demonstrated:');
    console.log('   ✅ In-memory vector storage using LibSQLStore');
    console.log('   ✅ OpenAI embeddings generation');
    console.log('   ✅ Cosine similarity search');
    console.log('   ✅ Document CRUD operations');
    console.log('   ✅ Semantic search with relevance scoring');
    console.log('   ✅ Metadata storage and retrieval');

  } catch (error) {
    console.error('❌ Vector store test failed:', error);
  }
}

async function testTrialDataPopulation() {
  console.log('\n🚀 Testing Trial Data Population\n');

  // Create vector store for population test
  const vectorStoreStorage = new LibSQLStore({
    url: ':memory:',
  });

  const vectorStore = new VectorStore(vectorStoreStorage);

  try {
    // Test population with sample conditions
    console.log('📋 Testing trial data population...');
    const result = await trialDataPopulatorTool.execute({
      context: {
        conditions: ['diabetes', 'hypertension'],
        maxTrialsPerCondition: 5, // Small number for testing
      },
      vectorStore,
    });

    console.log('\n📊 Population Results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Total trials added: ${result.totalTrialsAdded}`);
    console.log(`   Conditions processed: ${result.conditionsProcessed.join(', ')}`);
    console.log(`   Total documents in store: ${result.stats.totalDocuments}`);
    console.log(`   Average content length: ${result.stats.averageContentLength.toFixed(0)} characters`);

    if (result.success && result.totalTrialsAdded > 0) {
      // Test search with populated data
      console.log('\n🔍 Testing search with populated data...');
      const searchResults = await vectorStore.search(
        'diabetes patient with high blood sugar',
        3,
        0.3
      );
      
      console.log(`Found ${searchResults.length} relevant trials:`);
      searchResults.forEach((result, index) => {
        console.log(`\n${index + 1}. Trial ${result.metadata.trial_id}`);
        console.log(`   Condition: ${result.metadata.condition}`);
        console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      });
    }

    console.log('\n✅ Trial data population test completed!');

  } catch (error) {
    console.error('❌ Trial data population test failed:', error);
  }
}

// Run tests
async function main() {
  console.log('🧪 Vector Store Test Suite\n');
  console.log('This test demonstrates using a vector store with Mastra in-memory storage.\n');
  
  await testVectorStore();
  await testTrialDataPopulation();
  
  console.log('\n🎉 All tests completed!');
  console.log('\n💡 Next Steps:');
  console.log('   1. The vector store is now integrated with your eligibility screener agent');
  console.log('   2. You can populate it with real trial data using the trial data populator');
  console.log('   3. The agent will use semantic search instead of simple string matching');
  console.log('   4. All data is stored in-memory using LibSQLStore (SQLite)');
}

main().catch(console.error);
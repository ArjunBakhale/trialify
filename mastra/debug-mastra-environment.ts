#!/usr/bin/env npx tsx

import { mastra } from './src/mastra/index';

async function debugMastraEnvironment() {
  console.log('🔍 Debugging Mastra Environment');
  console.log('================================================================================\n');

  try {
    console.log('🔄 Testing Mastra instance...');
    console.log('Mastra instance:', !!mastra);
    console.log('Workflows:', Object.keys(mastra.getWorkflows()));
    console.log('Agents:', Object.keys(mastra.getAgents()));
    console.log('');

    console.log('🔄 Testing workflow retrieval...');
    const workflow = mastra.getWorkflow('clinicalTrialWorkflow');
    console.log('Workflow retrieved:', !!workflow);
    console.log('Workflow ID:', workflow.id);
    console.log('');

    console.log('🔄 Testing Node.js environment...');
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Architecture:', process.arch);
    console.log('');

    console.log('🔄 Testing stream compatibility...');
    console.log('ReadableStream available:', typeof ReadableStream !== 'undefined');
    console.log('WritableStream available:', typeof WritableStream !== 'undefined');
    console.log('EventTarget available:', typeof EventTarget !== 'undefined');
    console.log('');

    // Try to create a simple stream to test
    try {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue('test');
          controller.close();
        }
      });
      console.log('✅ ReadableStream creation successful');
    } catch (error) {
      console.log('❌ ReadableStream creation failed:', error);
    }

    // Try to create a simple EventTarget
    try {
      const target = new EventTarget();
      console.log('✅ EventTarget creation successful');
    } catch (error) {
      console.log('❌ EventTarget creation failed:', error);
    }

  } catch (error) {
    console.error('❌ Mastra environment debug failed:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

debugMastraEnvironment().catch(console.error);
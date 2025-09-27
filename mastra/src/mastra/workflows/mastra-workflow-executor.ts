import { Workflow } from '@mastra/core/workflows';

/**
 * Mastra Workflow Executor that properly handles workflow execution
 * and extracts results from the execution context
 */
export class MastraWorkflowExecutor {
  /**
   * Execute a Mastra workflow and return the final result
   */
  static async executeWorkflow<TInput, TOutput>(
    workflow: Workflow<any, any, any, any, any, any>,
    inputData: TInput
  ): Promise<TOutput> {
    try {
      console.log('🔄 Creating Mastra workflow run...');
      
      // Create a run using createRunAsync
      const run = workflow.createRunAsync({
        inputData
      });

      console.log('🔄 Executing Mastra workflow...');
      
      // Await the run to get the execution object
      const execution = await run;
      
      console.log('✅ Mastra workflow execution completed');
      
      // Try to extract the final result from the execution
      let result: TOutput | null = null;
      
      // Method 1: Check executionResults.stepResults
      if (execution.executionResults?.stepResults) {
        console.log('🔄 Extracting results from step execution...');
        
        const stepResults = execution.executionResults.stepResults;
        const stepIds = Object.keys(stepResults);
        
        console.log('Executed steps:', stepIds);
        
        // Get the result from the last step
        const lastStepId = stepIds[stepIds.length - 1];
        if (lastStepId && stepResults[lastStepId]) {
          result = stepResults[lastStepId] as TOutput;
          console.log('✅ Found result from last step:', lastStepId);
        }
      }
      
      // Method 2: Check execution state
      if (!result && execution.state && typeof execution.state === 'object') {
        console.log('🔄 Checking execution state for results...');
        const stateKeys = Object.keys(execution.state);
        console.log('State keys:', stateKeys);
        
        // Look for the final result in the state
        for (const key of stateKeys) {
          const value = execution.state[key];
          if (value && typeof value === 'object' && (value.clinicalReport || value.result)) {
            result = value as TOutput;
            console.log('✅ Found result in execution state');
            break;
          }
        }
      }
      
      // Method 3: Check if execution has a direct result property
      if (!result && (execution as any).result) {
        result = (execution as any).result as TOutput;
        console.log('✅ Found result in execution object');
      }
      
      if (result) {
        console.log('✅ Successfully extracted workflow result');
        return result;
      }
      
      // If no result found, try to execute the workflow steps manually
      console.log('⚠️ No results found in execution, attempting manual execution...');
      
      // This is a fallback - we'll call the individual steps manually
      throw new Error('Workflow execution completed but no results were found. This indicates a Mastra framework issue.');
      
    } catch (error) {
      console.error('❌ Mastra workflow execution failed:', error);
      throw error;
    }
  }
  
  /**
   * Execute a workflow with retry logic
   */
  static async executeWorkflowWithRetry<TInput, TOutput>(
    workflow: Workflow<any, any, any, any, any, any>,
    inputData: TInput,
    maxRetries: number = 3
  ): Promise<TOutput> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} to execute workflow...`);
        return await this.executeWorkflow(workflow, inputData);
      } catch (error) {
        lastError = error as Error;
        console.log(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
  }
}
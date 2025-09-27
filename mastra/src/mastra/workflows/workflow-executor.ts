import { Workflow } from '@mastra/core/workflows';

/**
 * Custom workflow executor that bypasses the problematic execute method
 * and uses createRunAsync instead
 */
export class WorkflowExecutor {
  /**
   * Execute a workflow using createRunAsync and extract the final result
   */
  static async executeWorkflow<TInput, TOutput>(
    workflow: Workflow<any, any, any, any, any, any>,
    inputData: TInput
  ): Promise<TOutput> {
    try {
      console.log('🔄 Creating workflow run...');
      
      // Create a run using createRunAsync
      const run = workflow.createRunAsync({
        inputData
      });

      console.log('🔄 Executing workflow...');
      
      // Await the run to get the execution object
      const execution = await run;
      
      console.log('✅ Workflow execution completed');
      console.log('Execution state:', execution.state);
      
      // Try to extract the final result from executionResults
      if (execution.executionResults?.stepResults) {
        console.log('🔄 Extracting results from step execution...');
        
        const stepResults = execution.executionResults.stepResults;
        const stepIds = Object.keys(stepResults);
        
        console.log('Executed steps:', stepIds);
        
        // Get the result from the last step
        const lastStepId = stepIds[stepIds.length - 1];
        if (lastStepId && stepResults[lastStepId]) {
          const lastStepResult = stepResults[lastStepId];
          console.log('✅ Found result from last step:', lastStepId);
          console.log('Result keys:', Object.keys(lastStepResult));
          
          return lastStepResult as TOutput;
        }
      }
      
      // If no step results, try to get from execution state
      if (execution.state && typeof execution.state === 'object') {
        console.log('🔄 Checking execution state for results...');
        const stateKeys = Object.keys(execution.state);
        console.log('State keys:', stateKeys);
        
        // Look for the final result in the state
        for (const key of stateKeys) {
          const value = execution.state[key];
          if (value && typeof value === 'object' && value.clinicalReport) {
            console.log('✅ Found clinical report in state');
            return value as TOutput;
          }
        }
      }
      
      console.log('⚠️ No results found in execution');
      throw new Error('Workflow execution completed but no results were found');
      
    } catch (error) {
      console.error('❌ Workflow execution failed:', error);
      throw error;
    }
  }
}
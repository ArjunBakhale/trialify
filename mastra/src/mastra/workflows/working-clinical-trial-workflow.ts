import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { ClinicalTrialService } from './clinical-trial-service';

// Input schema for the clinical trial workflow
const clinicalTrialWorkflowInputSchema = z.object({
  patientData: z.string().min(10, "Patient data must be at least 10 characters"),
  demographics: z.object({
    age: z.number().int().positive().optional(),
    location: z.string().optional(),
  }).optional(),
  searchPreferences: z.object({
    maxTrials: z.number().int().positive().max(20).default(10),
    includeCompletedTrials: z.boolean().default(false),
    maxLiteratureResults: z.number().int().positive().max(10).default(5),
  }).optional(),
});

// Single step that does everything
const processClinicalTrial = createStep({
  id: 'process-clinical-trial',
  description: 'Process patient case and find relevant clinical trials',
  inputSchema: clinicalTrialWorkflowInputSchema,
  outputSchema: z.object({
    clinicalReport: z.object({
      patient_summary: z.string(),
      eligible_trials: z.array(z.object({
        nct_id: z.string(),
        title: z.string(),
        match_score: z.number(),
        eligibility_reasoning: z.string(),
        literature_support: z.array(z.string()).default([]),
        contact_information: z.object({
          central_contact: z.string().optional(),
          overall_official: z.string().optional(),
          locations: z.array(z.string()).default([]),
        }),
        next_steps: z.array(z.string()).default([]),
      })),
      ineligible_trials: z.array(z.object({
        nct_id: z.string(),
        title: z.string(),
        exclusion_reason: z.string(),
        alternative_recommendations: z.array(z.string()).default([]),
      })),
      recommendations: z.string(),
      literature_support: z.array(z.string()),
      safety_flags: z.array(z.string()).default([]),
      workflow_metadata: z.object({
        execution_time_ms: z.number(),
        agents_activated: z.array(z.string()),
        api_calls_made: z.number(),
        confidence_score: z.number().min(0).max(1),
      }),
    }),
  }),
  execute: async ({ inputData }) => {
    console.log('🔄 Working Clinical Trial Workflow - Processing patient case...');
    
    // Use the working ClinicalTrialService
    const result = await ClinicalTrialService.processPatientCase({
      patientData: inputData.patientData,
      demographics: inputData.demographics,
      searchPreferences: inputData.searchPreferences
    });

    console.log('✅ Working workflow completed successfully');
    
    return result;
  },
});

// Create the working clinical trial workflow
const workingClinicalTrialWorkflow = createWorkflow({
  id: 'working-clinical-trial-workflow',
  inputSchema: clinicalTrialWorkflowInputSchema,
  outputSchema: z.object({
    clinicalReport: z.object({
      patient_summary: z.string(),
      eligible_trials: z.array(z.object({
        nct_id: z.string(),
        title: z.string(),
        match_score: z.number(),
        eligibility_reasoning: z.string(),
        literature_support: z.array(z.string()).default([]),
        contact_information: z.object({
          central_contact: z.string().optional(),
          overall_official: z.string().optional(),
          locations: z.array(z.string()).default([]),
        }),
        next_steps: z.array(z.string()).default([]),
      })),
      ineligible_trials: z.array(z.object({
        nct_id: z.string(),
        title: z.string(),
        exclusion_reason: z.string(),
        alternative_recommendations: z.array(z.string()).default([]),
      })),
      recommendations: z.string(),
      literature_support: z.array(z.string()),
      safety_flags: z.array(z.string()).default([]),
      workflow_metadata: z.object({
        execution_time_ms: z.number(),
        agents_activated: z.array(z.string()),
        api_calls_made: z.number(),
        confidence_score: z.number().min(0).max(1),
      }),
    }),
  }),
})
  .then(processClinicalTrial);

workingClinicalTrialWorkflow.commit();

// Create a wrapper that provides the Mastra workflow interface but bypasses the execution issues
export class WorkingClinicalTrialWorkflow {
  private workflow = workingClinicalTrialWorkflow;
  
  get id() {
    return this.workflow.id;
  }
  
  get inputSchema() {
    return this.workflow.inputSchema;
  }
  
  get outputSchema() {
    return this.workflow.outputSchema;
  }
  
  /**
   * Execute the workflow with proper error handling
   */
  async execute(inputData: any) {
    try {
      console.log('🔄 Executing Working Clinical Trial Workflow...');
      
      // Since the Mastra execution engine has issues, we'll call the service directly
      const result = await ClinicalTrialService.processPatientCase({
        patientData: inputData.patientData,
        demographics: inputData.demographics,
        searchPreferences: inputData.searchPreferences
      });
      
      console.log('✅ Working workflow executed successfully');
      return result;
      
    } catch (error) {
      console.error('❌ Working workflow execution failed:', error);
      throw error;
    }
  }
  
  /**
   * Create a run (for compatibility with Mastra interface)
   */
  createRunAsync(options: any) {
    return {
      then: async (callback: any) => {
        try {
          const result = await this.execute(options.inputData);
          return callback(result);
        } catch (error) {
          throw error;
        }
      }
    };
  }
}

// Export both the original workflow and the working wrapper
export { workingClinicalTrialWorkflow };
export const workingClinicalTrialWorkflowWrapper = new WorkingClinicalTrialWorkflow();
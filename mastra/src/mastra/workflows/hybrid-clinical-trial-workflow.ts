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

// Single step that does everything (hybrid approach)
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
    console.log('🔄 Hybrid Clinical Trial Workflow - Processing patient case...');
    
    // Use the working ClinicalTrialService
    const result = await ClinicalTrialService.processPatientCase({
      patientData: inputData.patientData,
      demographics: inputData.demographics,
      searchPreferences: inputData.searchPreferences
    });

    console.log('✅ Hybrid workflow completed successfully');
    
    return result;
  },
});

// Create the hybrid clinical trial workflow
const hybridClinicalTrialWorkflow = createWorkflow({
  id: 'hybrid-clinical-trial-workflow',
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

hybridClinicalTrialWorkflow.commit();

export { hybridClinicalTrialWorkflow };
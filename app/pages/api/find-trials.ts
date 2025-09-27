import { NextApiRequest, NextApiResponse } from 'next';
import { mastra } from "@mastramain/index";
import { z } from 'zod';

// Define types based on your workflow output schema
interface EligibleTrial {
  nct_id: string;
  title: string;
  match_score: number;
  eligibility_reasoning: string;
  literature_support: string[];
  contact_information: {
    central_contact?: string;
    overall_official?: string;
    locations: string[];
  };
  next_steps: string[];
}

interface IneligibleTrial {
  nct_id: string;
  title: string;
  exclusion_reason: string;
  alternative_recommendations: string[];
}

interface ClinicalReport {
  patient_summary: string;
  eligible_trials: EligibleTrial[];
  ineligible_trials: IneligibleTrial[];
  recommendations: string;
  literature_support: string[];
  safety_flags: string[];
  workflow_metadata: {
    execution_time_ms: number;
    agents_activated: string[];
    api_calls_made: number;
    confidence_score: number;
  };
}

interface WorkflowResult {
  clinicalReport: ClinicalReport;
}

// Request validation schema
const findTrialsSchema = z.object({
  patientInfo: z.string().min(10, 'Patient information must be at least 10 characters'),
  demographics: z.object({
    age: z.number().optional(),
    location: z.string().optional(),
  }).optional(),
  preferences: z.object({
    maxTrials: z.number().min(1).max(10).default(3),
    includeCompletedTrials: z.boolean().default(false),
    maxLiteratureResults: z.number().min(1).max(10).default(5),
  }).optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Validate request body
    const validationResult = findTrialsSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors
      });
    }

    const { patientInfo, demographics, preferences } = validationResult.data;

    // Prepare workflow input matching your workflow's input schema
    const workflowInput = {
      inputData: {  // Wrap the input data in an inputData property
        patientData: patientInfo,
        demographics: demographics ? {
          age: demographics.age,
          location: demographics.location
        } : undefined,
        searchPreferences: preferences ? {
        maxTrials: preferences.maxTrials || 3,
        includeCompletedTrials: preferences.includeCompletedTrials || false,
        maxLiteratureResults: preferences.maxLiteratureResults || 5
      } : undefined
  }
    };

    // Execute the clinical trial workflow
    const run = await mastra.getWorkflow("clinicalTrialWorkflow").createRunAsync();
    const result = await run.start(workflowInput);

    if (result.status !== 'success') {
      throw new Error(`${result.status}: Failed to process clinical trial matching request`);
    }

    // Extract and format the results - accessing the correct property path
    const workflowResult = result.result as WorkflowResult;
    const clinicalReport = workflowResult.clinicalReport;

    // Return formatted response matching your expected structure
    return res.status(200).json({
      success: true,
      data: {
        matches: clinicalReport.eligible_trials.slice(0, 3).map((trial: EligibleTrial) => ({
          id: trial.nct_id,
          title: trial.title,
          phase: 'N/A', // Phase not available in eligible_trials structure
          status: 'Active', // Status not available, defaulting
          location: trial.contact_information.locations[0] || 'Multiple locations',
          summary: trial.eligibility_reasoning,
          matchScore: trial.match_score,
          matchReason: trial.eligibility_reasoning,
          eligibilityCriteria: trial.eligibility_reasoning,
          contactInfo: trial.contact_information.central_contact ? {
            name: trial.contact_information.central_contact,
            phone: 'N/A',
            email: 'N/A'
          } : null,
          studyDetails: {
            sponsor: 'N/A', // Not available in workflow output
            estimatedCompletion: 'N/A', // Not available in workflow output
            enrollment: 0 // Not available in workflow output
          },
          nextSteps: trial.next_steps
        })),
        patientSummary: {
          summary: clinicalReport.patient_summary,
          recommendations: clinicalReport.recommendations,
          safetyFlags: clinicalReport.safety_flags
        },
        supportingEvidence: clinicalReport.literature_support.slice(0, 3).map((evidence: string) => ({
          title: evidence,
          abstract: 'N/A', // Not available in current structure
          relevance: 1.0, // Default relevance
          url: 'N/A' // Not available in current structure
        })),
        metadata: {
          processingTime: clinicalReport.workflow_metadata.execution_time_ms,
          agentsActivated: clinicalReport.workflow_metadata.agents_activated,
          confidenceScore: clinicalReport.workflow_metadata.confidence_score,
          apiCallsMade: clinicalReport.workflow_metadata.api_calls_made
        }
      }
    });

  } catch (error) {
    console.error('Clinical trial matching error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process clinical trial matching request',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}

// Export configuration for Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: '8mb',
  },
}
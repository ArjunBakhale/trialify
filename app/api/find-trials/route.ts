import { NextRequest, NextResponse } from 'next/server';
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
  // Dropout risk data
  dropoutRisk?: {
    overallRisk: number;
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
    confidence: number;
  };
  riskFactors?: Array<{
    factor: string;
    impact: number;
    description: string;
    mitigation?: string;
  }>;
  riskMitigationRecommendations?: string[];
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

// Only export POST handler - App Router automatically handles method routing
export async function POST(request: NextRequest) {
  try {
    console.log('✅ POST request received to /api/find-trials');
    // Parse the request body
    const body = await request.json();
    console.log('Received request body:', body); // Debug log

    // Validate request body
    const validationResult = findTrialsSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.errors); // Debug log
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors
      }, { status: 400 });
    }

    const { patientInfo, demographics, preferences } = validationResult.data;
    console.log('Validated data:', { patientInfo, demographics, preferences }); // Debug log

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

    console.log('Prepared workflow input:', workflowInput); // Debug log

    // Execute the working clinical trial workflow with dropout prediction
    console.log('🔄 Getting workflow: workingClinicalTrialWorkflow');
    let workflow;
    try {
      workflow = mastra.getWorkflow("workingClinicalTrialWorkflow");
      console.log('✅ Workflow found:', workflow.id);
    } catch (workflowError) {
      console.error('❌ Failed to get workflow:', workflowError);
      throw new Error(`Workflow not found: ${workflowError}`);
    }
    
    const run = await workflow.createRunAsync();
    console.log('✅ Workflow run created, starting execution...');
    const result = await run.start(workflowInput);
    console.log('✅ Workflow execution completed, status:', result.status);

    if (result.status !== 'success') {
      throw new Error(`${result.status}: Failed to process clinical trial matching request`);
    }

    // Extract and format the results - accessing the correct property path
    const workflowResult = result.result as WorkflowResult;
    const clinicalReport = workflowResult.clinicalReport;

    // Return formatted response matching your expected structure
    const responseData = {
      success: true,
      data: {
        matches: clinicalReport.eligible_trials.slice(0, 3).map((trial: EligibleTrial) => ({
          id: trial.nct_id,
          title: trial.title,
          phase: 'Phase III', // Enhanced mock data
          status: 'Recruiting', // Enhanced mock data
          location: trial.contact_information.locations[0] || 'Multiple locations',
          summary: trial.eligibility_reasoning,
          matchScore: trial.match_score,
          matchReason: trial.eligibility_reasoning,
          eligibilityCriteria: trial.eligibility_reasoning,
          contactInfo: trial.contact_information.central_contact ? {
            name: trial.contact_information.central_contact,
            phone: '(555) 123-4567', // Enhanced mock data
            email: 'trials@example.com' // Enhanced mock data
          } : null,
          studyDetails: {
            sponsor: 'National Institute of Health', // Enhanced mock data
            estimatedCompletion: 'December 2025', // Enhanced mock data
            enrollment: 500 // Enhanced mock data
          },
          nextSteps: trial.next_steps,
          // Dropout risk data
          dropoutRisk: trial.dropoutRisk,
          riskFactors: trial.riskFactors,
          riskMitigationRecommendations: trial.riskMitigationRecommendations
        })),
        patientSummary: {
          summary: clinicalReport.patient_summary,
          recommendations: clinicalReport.recommendations,
          safetyFlags: clinicalReport.safety_flags
        },
        supportingEvidence: clinicalReport.literature_support.slice(0, 3).map((evidence: string) => ({
          title: evidence,
          abstract: 'This study provides important insights into treatment efficacy and patient outcomes in clinical trial settings.', // Enhanced mock data
          relevance: 0.92, // Enhanced mock data
          url: 'https://pubmed.ncbi.nlm.nih.gov/example' // Enhanced mock data
        })),
        metadata: {
          processingTime: clinicalReport.workflow_metadata.execution_time_ms,
          agentsActivated: clinicalReport.workflow_metadata.agents_activated,
          confidenceScore: clinicalReport.workflow_metadata.confidence_score,
          apiCallsMade: clinicalReport.workflow_metadata.api_calls_made
        }
      }
    };

    console.log('Returning successful response'); // Debug log
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Clinical trial matching error:', error);
    console.error('❌ Error stack:', (error as Error).stack);
    console.error('❌ Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      cause: (error as Error).cause
    });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process clinical trial matching request',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 });
  }
}

// Handle other HTTP methods
export async function GET() {
  console.log('❌ GET request received to /api/find-trials - this endpoint only accepts POST requests');
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. This endpoint only accepts POST requests.'
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. This endpoint only accepts POST requests.'
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. This endpoint only accepts POST requests.'
  }, { status: 405 });
}
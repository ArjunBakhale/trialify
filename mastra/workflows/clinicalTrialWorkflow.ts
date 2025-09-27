import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { emrAnalysisAgent, analyzePatientEMR } from "../agents/emrAnalysisAgent";
import { trialScoutAgent, scoutClinicalTrials } from "../agents/trialScoutAgent";
import { eligibilityScreenerAgent, screenEligibility } from "../agents/eligibilityScreenerAgent";
import { summarizationAgent, generateClinicalReport, suspendForPhysicianReview } from "../agents/summarizationAgent";
import { ClinicalReport, ClinicalReportSchema } from "../agents/summarizationAgent";

/**
 * Clinical Trial Matching Workflow
 * 
 * Orchestrates the 4-agent pipeline with human-in-the-loop checkpoints:
 * Patient Input → EMR_Analysis_Agent → Trial_Scout_Agent → Eligibility_Screener_Agent → Summarization_Agent → Clinical Report
 * 
 * Design Principles:
 * - Multi-Agent Orchestration: Sequential workflow with clear hand-offs
 * - Human-in-the-Loop Assurance: Suspension points for physician review
 * - Operational Observability: Real-time monitoring via .watch() hooks
 * - Performance Discipline: Target sub-10 second execution
 * - Agent Separation of Concerns: Each agent owns distinct pipeline step
 */

// -----------------------------
// Workflow Input/Output Schemas
// -----------------------------
const WorkflowInputSchema = z.object({
  patientData: z.string().min(10, "Patient data must be at least 10 characters"),
  demographics: z.object({
    age: z.number().int().positive().optional(),
    location: z.string().optional(),
  }).optional(),
  workflowOptions: z.object({
    enablePhysicianReview: z.boolean().default(true),
    maxTrials: z.number().int().positive().max(20).default(10),
    includeCompletedTrials: z.boolean().default(false),
    maxLiteratureResults: z.number().int().positive().max(10).default(5),
  }).optional(),
});

const WorkflowOutputSchema = z.object({
  clinicalReport: ClinicalReportSchema,
  workflowMetadata: z.object({
    totalExecutionTimeMs: z.number(),
    agentsActivated: z.array(z.string()),
    apiCallsMade: z.number(),
    suspensionPoints: z.array(z.string()).default([]),
    performanceMetrics: z.object({
      emrAnalysisTimeMs: z.number(),
      trialScoutTimeMs: z.number(),
      eligibilityScreeningTimeMs: z.number(),
      reportGenerationTimeMs: z.number(),
    }),
  }),
});

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;
export type WorkflowOutput = z.infer<typeof WorkflowOutputSchema>;

// -----------------------------
// Step Input/Output Schemas
// -----------------------------
const AnalyzePatientStepOutputSchema = z.object({
  patientProfile: z.any(), // From EMR analysis
  stepMetadata: z.object({
    executionTimeMs: z.number(),
    agent: z.string(),
    status: z.string(),
  }),
});

const FindTrialsStepOutputSchema = z.object({
  trialScoutResults: z.any(), // From trial scouting
  stepMetadata: z.object({
    executionTimeMs: z.number(),
    agent: z.string(),
    status: z.string(),
    trialsFound: z.number(),
  }),
});

const ScreenEligibilityStepOutputSchema = z.object({
  eligibilityResults: z.any(), // From eligibility screening
  stepMetadata: z.object({
    executionTimeMs: z.number(),
    agent: z.string(),
    status: z.string(),
    trialsAssessed: z.number(),
  }),
});

const PhysicianReviewStepOutputSchema = z.object({
  reviewCompleted: z.boolean(),
  stepMetadata: z.object({
    executionTimeMs: z.number(),
    agent: z.string(),
    status: z.string(),
    suspensionPoint: z.string().optional(),
  }),
});

const GenerateReportStepOutputSchema = z.object({
  clinicalReport: ClinicalReportSchema,
  stepMetadata: z.object({
    executionTimeMs: z.number(),
    agent: z.string(),
    status: z.string(),
    reportGenerated: z.boolean(),
  }),
});

// -----------------------------
// Workflow Steps
// -----------------------------
const analyzePatientStep = createStep({
  id: "analyzePatient",
  inputSchema: WorkflowInputSchema,
  outputSchema: AnalyzePatientStepOutputSchema,
  execute: async ({ inputData }) => {
    const startTime = Date.now();
    console.log("🔍 Step 1: Starting EMR Analysis...");

    try {
      const result = await analyzePatientEMR(
        inputData.patientData,
        inputData.demographics
      );

      const executionTime = Date.now() - startTime;
      console.log(`✅ EMR Analysis completed in ${executionTime}ms`);

      return {
        patientProfile: result,
        stepMetadata: {
          executionTimeMs: executionTime,
          agent: "EMR_Analysis_Agent",
          status: "completed",
        },
      };
    } catch (error) {
      console.error("❌ EMR Analysis failed:", error);
      throw new Error(`EMR Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

const findTrialsStep = createStep({
  id: "findTrials",
  inputSchema: AnalyzePatientStepOutputSchema,
  outputSchema: FindTrialsStepOutputSchema,
  execute: async ({ inputData }) => {
    const startTime = Date.now();
    console.log("🔍 Step 2: Starting Trial Scouting...");

    try {
      // Note: In the new API, inputData will include both workflow input and previous step outputs
      // We need to access the workflow options from the merged input
      const workflowInput = (inputData as any); // Type assertion needed due to merged inputs
      
      const searchPreferences = {
        maxTrials: workflowInput.workflowOptions?.maxTrials || 10,
        includeCompletedTrials: workflowInput.workflowOptions?.includeCompletedTrials || false,
        maxLiteratureResults: workflowInput.workflowOptions?.maxLiteratureResults || 5,
      };

      const result = await scoutClinicalTrials(inputData.patientProfile, searchPreferences);

      const executionTime = Date.now() - startTime;
      console.log(`✅ Trial Scouting completed in ${executionTime}ms - found ${result.candidateTrials.length} trials`);

      return {
        trialScoutResults: result,
        stepMetadata: {
          executionTimeMs: executionTime,
          agent: "Trial_Scout_Agent",
          status: "completed",
          trialsFound: result.candidateTrials.length,
        },
      };
    } catch (error) {
      console.error("❌ Trial Scouting failed:", error);
      throw new Error(`Trial Scouting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

const screenEligibilityStep = createStep({
  id: "screenEligibility",
  inputSchema: FindTrialsStepOutputSchema,
  outputSchema: ScreenEligibilityStepOutputSchema,
  execute: async ({ inputData }) => {
    const startTime = Date.now();
    console.log("🔍 Step 3: Starting Eligibility Screening...");

    try {
      // In the new API, we need to access accumulated data
      const accumulatedData = (inputData as any);
      
      const result = await screenEligibility(accumulatedData.patientProfile, inputData.trialScoutResults.candidateTrials);

      const executionTime = Date.now() - startTime;
      console.log(`✅ Eligibility Screening completed in ${executionTime}ms - assessed ${result.eligibilityAssessments.length} trials`);

      return {
        eligibilityResults: result,
        stepMetadata: {
          executionTimeMs: executionTime,
          agent: "Eligibility_Screener_Agent",
          status: "completed",
          trialsAssessed: result.eligibilityAssessments.length,
        },
      };
    } catch (error) {
      console.error("❌ Eligibility Screening failed:", error);
      throw new Error(`Eligibility Screening failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

const physicianReviewStep = createStep({
  id: "physicianReview",
  inputSchema: ScreenEligibilityStepOutputSchema,
  outputSchema: PhysicianReviewStepOutputSchema,
  execute: async ({ inputData }) => {
    // In the new API, we need to access accumulated workflow options
    const accumulatedData = (inputData as any);
    
    if (!accumulatedData.workflowOptions?.enablePhysicianReview) {
      console.log("⏭️ Skipping physician review (disabled in workflow options)");
      return {
        reviewCompleted: true,
        stepMetadata: {
          executionTimeMs: 0,
          agent: "Human-in-the-Loop",
          status: "skipped",
        },
      };
    }

    const startTime = Date.now();
    console.log("⏸️ Step 4: Physician Review Checkpoint...");

    try {
      // Suspend workflow for physician review
      await suspendForPhysicianReview(
        inputData.eligibilityResults,
        "Please review eligibility results before final report generation"
      );

      const executionTime = Date.now() - startTime;
      console.log(`✅ Physician Review completed in ${executionTime}ms`);

      return {
        reviewCompleted: true,
        stepMetadata: {
          executionTimeMs: executionTime,
          agent: "Human-in-the-Loop",
          status: "completed",
          suspensionPoint: "physician_review",
        },
      };
    } catch (error) {
      console.error("❌ Physician Review failed:", error);
      throw new Error(`Physician Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

const generateReportStep = createStep({
  id: "generateReport",
  inputSchema: PhysicianReviewStepOutputSchema,
  outputSchema: GenerateReportStepOutputSchema,
  execute: async ({ inputData }) => {
    const startTime = Date.now();
    console.log("📋 Step 5: Starting Report Generation...");

    try {
      // In the new API, we need to access accumulated data from all previous steps
      const accumulatedData = (inputData as any);
      
      const clinicalReport = await generateClinicalReport(
        accumulatedData.patientProfile,
        accumulatedData.trialScoutResults,
        accumulatedData.eligibilityResults
      );

      const executionTime = Date.now() - startTime;
      console.log(`✅ Report Generation completed in ${executionTime}ms`);

      return {
        clinicalReport,
        stepMetadata: {
          executionTimeMs: executionTime,
          agent: "Summarization_Agent",
          status: "completed",
          reportGenerated: true,
        },
      };
    } catch (error) {
      console.error("❌ Report Generation failed:", error);
      throw new Error(`Report Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

// -----------------------------
// Clinical Trial Workflow
// -----------------------------
export const clinicalTrialWorkflow = createWorkflow({
  id: "clinicalTrialWorkflow",
  inputSchema: WorkflowInputSchema,
  outputSchema: WorkflowOutputSchema,
})
.then(analyzePatientStep)
.then(findTrialsStep)
.then(screenEligibilityStep)
.then(physicianReviewStep)
.then(generateReportStep)
.commit();

/**
 * Utility function to execute the complete clinical trial workflow
 */
export async function executeClinicalTrialWorkflow(
  patientData: string,
  demographics?: { age?: number; location?: string },
  workflowOptions?: {
    enablePhysicianReview?: boolean;
    maxTrials?: number;
    includeCompletedTrials?: boolean;
    maxLiteratureResults?: number;
  }
): Promise<WorkflowOutput> {
  const startTime = Date.now();
  console.log("🚀 Starting Clinical Trial Navigator workflow...");
  
  try {
    // In the new API, we use createRunAsync
    const run = await clinicalTrialWorkflow.createRunAsync();
    const result = await run.start({
      inputData: {
        patientData,
        demographics,
        workflowOptions: {
          enablePhysicianReview: true,
          maxTrials: 10,
          includeCompletedTrials: false,
          maxLiteratureResults: 5,
          ...workflowOptions,
        },
      },
    });
    
    // In the new API, the result is wrapped in a WorkflowResult object
    if (result.status === 'success') {
      const totalExecutionTime = Date.now() - startTime;
      console.log(`✅ Workflow completed successfully in ${totalExecutionTime}ms`);
      
      return (result as any).result; // Type assertion needed
    } else {
      throw new Error(`Workflow failed: ${(result as any).error}`);
    }
  } catch (error) {
    const totalExecutionTime = Date.now() - startTime;
    console.error(`❌ Workflow execution failed after ${totalExecutionTime}ms:`, error);
    throw error;
  }
}

/**
 * Utility function for real-time workflow monitoring
 * Note: The new API may not have a direct watch equivalent
 */
export async function watchClinicalTrialWorkflow(
  patientData: string,
  demographics?: { age?: number; location?: string },
  workflowOptions?: {
    enablePhysicianReview?: boolean;
    maxTrials?: number;
    includeCompletedTrials?: boolean;
    maxLiteratureResults?: number;
  }
) {
  console.log("👀 Starting workflow monitoring...");
  
  // In the new API, we can use createRunAsync and monitor the run
  const run = await clinicalTrialWorkflow.createRunAsync();
  
  // Start the run and return the run object for monitoring
  const runPromise = run.start({
    inputData: {
      patientData,
      demographics,
      workflowOptions: {
        enablePhysicianReview: true,
        maxTrials: 10,
        includeCompletedTrials: false,
        maxLiteratureResults: 5,
        ...workflowOptions,
      },
    },
  });
  
  return { run, runPromise };
}

/**
 * Development utility for testing with mock data
 */
export const workflowUtils = {
  /**
   * Execute workflow with mock patient data
   */
  async executeWithMockData(patientType: "diabetes" | "cancer" = "diabetes") {
    const mockData = {
      diabetes: `
        Patient: John Smith, 65 years old
        Diagnosis: Type 2 Diabetes Mellitus (T2DM)
        Current HbA1c: 8.5%
        Current medications: Metformin 1000mg BID
        Lab values: eGFR 65, Creatinine 1.2
        Location: Forest Park, GA
        Insurance: Medicare
        Recent hospitalization: None
        Comorbidities: Hypertension (controlled)
      `,
      cancer: `
        Patient: Sarah Johnson, 52 years old  
        Diagnosis: Stage IIIA Non-Small Cell Lung Cancer (NSCLC)
        Histology: Adenocarcinoma
        Biomarkers: EGFR wild-type, ALK negative, PD-L1 expression 45%
        Performance status: ECOG 1
        Prior treatment: Cisplatin/Pemetrexed completed 3 cycles
        Location: Atlanta, GA
        Smoking history: 30 pack-years, quit 2 years ago
      `,
    };
    
    return executeClinicalTrialWorkflow(
      mockData[patientType],
      { age: patientType === "diabetes" ? 65 : 52, location: "Atlanta, GA" },
      { enablePhysicianReview: false } // Skip review for testing
    );
  },
  
  /**
   * Enable mock mode for offline demos
   */
  enableMockMode() {
    process.env.MASTRA_MOCK_MODE = "true";
    console.log("🎭 Mock mode enabled for offline demo");
  },
};
import { Mastra } from "@mastra/core";
import { ConsoleLogger, LogLevel } from "@mastra/core/logger";
import { emrAnalysisAgent, analyzePatientEMR } from "./agents/emrAnalysisAgent";
import { trialScoutAgent, scoutClinicalTrials } from "./agents/trialScoutAgent";
import { eligibilityScreenerAgent, screenEligibility } from "./agents/eligibilityScreenerAgent";
import { summarizationAgent, generateClinicalReport, suspendForPhysicianReview } from "./agents/summarizationAgent";
import { clinicalTrialWorkflow, executeClinicalTrialWorkflow, watchClinicalTrialWorkflow, workflowUtils } from "./workflows/clinicalTrialWorkflow";

/**
 * Main Mastra Configuration for Clinical Trial Navigator
 * 
 * Implements a 4-agent sequential workflow for matching patients to clinical trials:
 * Patient Input → EMR_Analysis_Agent → Trial_Scout_Agent → Eligibility_Screener_Agent → Summarization_Agent → Clinical Report
 * 
 * Following design principles:
 * - Patient-Centric Accuracy: Maintains fidelity and traceability throughout pipeline
 * - Agent Separation of Concerns: Each agent owns distinct pipeline step with explicit schemas
 * - Evidence-Driven Recommendations: Combines ClinicalTrials.gov + PubMed literature support
 * - Human-in-the-Loop Assurance: Workflow suspension for clinician review
 * - Operational Observability: Real-time monitoring via .watch() hooks
 */
const resolveMastraLogLevel = (value?: string | null): LogLevel => {
  switch (value?.toLowerCase()) {
    case "debug":
      return LogLevel.DEBUG;
    case "warn":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
    case "silent":
    case "none":
      return LogLevel.NONE;
    case "info":
    default:
      return process.env.NODE_ENV === "production" && process.env.MASTRA_DEV !== "true"
        ? LogLevel.WARN
        : LogLevel.INFO;
  }
};

export const mastra = new Mastra({
  /**
   * Agent Registry - 4-Agent Clinical Trial Matching Pipeline
   */
  agents: {
    /**
     * EMR_Analysis_Agent
     * Purpose: Parse unstructured patient data into structured medical profile
     * Input: Raw patient text/Synthea EMR data
     * Output: {diagnosis: string, age: number, medications: string[], labValues: object}
     */
    emrAnalysisAgent,

    /**
     * Trial_Scout_Agent  
     * Purpose: Search and retrieve relevant clinical trials with literature support
     * Input: Structured patient profile from EMR_Analysis_Agent
     * Output: Array of potential trials with PubMed literature metadata
     * Multi-API: ClinicalTrials.gov API v2 + NCBI E-utilities
     */
    trialScoutAgent,

    /**
     * Eligibility_Screener_Agent
     * Purpose: Perform RAG-powered semantic matching against trial eligibility criteria
     * Input: Patient profile + trial list
     * Output: Eligibility assessment with match scores and reasoning
     * RAG Integration: Vector store of trial inclusion/exclusion criteria
     */
    eligibilityScreenerAgent,

    /**
     * Summarization_Agent
     * Purpose: Generate structured clinical report with human-in-the-loop checkpoint
     * Input: All previous agent outputs
     * Output: Structured report using Zod schemas with physician review suspension
     */
    summarizationAgent,
  },

  /**
   * Workflow Registry
   */
  workflows: {
    /**
     * Clinical Trial Matching Workflow
     * Orchestrates the 4-agent pipeline with human-in-the-loop checkpoints
     * Target: Sub-10 second execution with real-time monitoring
     */
    clinicalTrialWorkflow,
  },

  /**
   * Logging Configuration
   * Uses Mastra ConsoleLogger to ensure compatibility with internal telemetry
   */
  logger: new ConsoleLogger({
    name: "MastraClinicalTrialNavigator",
    level: resolveMastraLogLevel(process.env.MASTRA_LOG_LEVEL ?? null),
  }),
});

/**
 * Export individual components for testing and development
 */
export {
  // Agents
  emrAnalysisAgent,
  trialScoutAgent,
  eligibilityScreenerAgent,
  summarizationAgent,
  
  // Workflows
  clinicalTrialWorkflow,
  
  // Utility functions
  analyzePatientEMR,
  scoutClinicalTrials,
  screenEligibility,
  generateClinicalReport,
  suspendForPhysicianReview,
  executeClinicalTrialWorkflow,
  watchClinicalTrialWorkflow,
  workflowUtils,
};

/**
 * Legacy utility function for workflow execution with error handling
 * @deprecated Use executeClinicalTrialWorkflow from workflowUtils instead
 */
export async function executeTrialMatchingWorkflow(
  patientData: string,
  demographics?: { age?: number; location?: string }
) {
  console.warn("⚠️ executeTrialMatchingWorkflow is deprecated. Use executeClinicalTrialWorkflow instead.");
  return executeClinicalTrialWorkflow(patientData, demographics);
}

/**
 * Legacy utility function for real-time workflow monitoring
 * @deprecated Use watchClinicalTrialWorkflow from workflowUtils instead
 */
export function watchTrialMatchingWorkflow(
  patientData: string,
  demographics?: { age?: number; location?: string }
) {
  console.warn("⚠️ watchTrialMatchingWorkflow is deprecated. Use watchClinicalTrialWorkflow instead.");
  return watchClinicalTrialWorkflow(patientData, demographics);
}

/**
 * Development utilities for mock data and offline demos
 */
export const developmentUtils = {
  /**
   * Mock patient data for testing (Synthea-style)
   */
  mockPatientData: {
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
  },

  /**
   * Enable mock mode for offline demos
   */
  enableMockMode: () => {
    process.env.MASTRA_MOCK_MODE = "true";
    console.log("🎭 Mock mode enabled for offline demo");
  },
};
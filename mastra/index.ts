import { Mastra } from "@mastra/core";
import { emrAnalysisAgent } from "./agents/emrAnalysisAgent";
import { trialScoutAgent } from "./agents/trialScoutAgent";
import { eligibilityScreenerAgent } from "./agents/eligibilityScreenerAgent";
import { summarizationAgent } from "./agents/summarizationAgent";
import { clinicalTrialWorkflow } from "./workflows/clinicalTrialWorkflow";

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
   * Memory Configuration for RAG Pipeline
   * Phase 1: In-memory adapter for demo (low setup friction)
   * Future: Migrate to Supabase pgvector for production persistence
   */
  memory: {
    provider: "in-memory",
    config: {
      // Eligibility criteria vector store configuration
      vectorDimensions: 1536, // OpenAI ada-002 embedding dimensions
      similarityThreshold: 0.8, // High threshold for clinical safety
      maxResults: 10, // Limit candidate trials for performance
    }
  },

  /**
   * Logging Configuration
   * Operational Observability: Meaningful telemetry for each agent activation
   */
  logger: {
    level: process.env.MASTRA_LOG_LEVEL || "info",
    format: "json", // Structured logging for production monitoring
  },

  /**
   * Performance Configuration
   * Performance Discipline: Target sub-10 second end-to-end execution
   */
  performance: {
    timeout: 30000, // 30 second max execution time
    retries: 2, // Retry failed API calls
    concurrency: 3, // Allow parallel tool execution where possible
  },

  /**
   * Security Configuration
   * Compliance: Secure handling of sensitive patient data
   */
  security: {
    // Avoid unnecessary persistence of sensitive data
    persistSensitiveData: false,
    // Encrypt data in transit
    encryptionEnabled: true,
  },
});

/**
 * Export individual components for testing and development
 */
export {
  emrAnalysisAgent,
  trialScoutAgent,
  eligibilityScreenerAgent,
  summarizationAgent,
  clinicalTrialWorkflow,
};

/**
 * Utility function for workflow execution with error handling
 */
export async function executeTrialMatchingWorkflow(
  patientData: string,
  demographics?: { age?: number; location?: string }
) {
  try {
    console.log("🚀 Starting Clinical Trial Navigator workflow...");
    
    const result = await mastra.workflow("clinicalTrialWorkflow").execute({
      patientData,
      demographics,
    });

    console.log("✅ Workflow completed successfully");
    return result;
  } catch (error) {
    console.error("❌ Workflow execution failed:", error);
    throw error;
  }
}

/**
 * Utility function for real-time workflow monitoring
 */
export function watchTrialMatchingWorkflow(
  patientData: string,
  demographics?: { age?: number; location?: string }
) {
  console.log("👀 Starting workflow monitoring...");
  
  return mastra.workflow("clinicalTrialWorkflow").watch({
    patientData,
    demographics,
  });
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
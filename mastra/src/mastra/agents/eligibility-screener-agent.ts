import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { openFdaDrugSafetyTool } from '../tools/open-fda-api-tool';
import { z } from 'zod';

// Eligibility Knowledge Base (RAG Data)
const eligibilityKnowledgeBase = [
  {
    trial_id: "NCT00000001",
    condition: "Type 2 Diabetes Mellitus",
    inclusion_criteria: "Adults 18-75 years with HbA1c 7.0-10.5%, on stable metformin dose ≥3 months",
    exclusion_criteria: "Pregnancy, severe renal impairment (eGFR <30), active malignancy, recent hospitalization",
    age_range: { min: 18, max: 75 },
    required_labs: ["HbA1c", "eGFR"],
    required_medications: ["metformin"],
    biomarkers: [],
  },
  {
    trial_id: "NCT00000002", 
    condition: "Non-Small Cell Lung Cancer",
    inclusion_criteria: "Stage IIIA NSCLC, ECOG performance status 0-1, EGFR wild-type, adequate organ function",
    exclusion_criteria: "Active brain metastases, prior immunotherapy, severe cardiac disease",
    age_range: { min: 18, max: 80 },
    required_labs: ["EGFR status", "ECOG score"],
    required_medications: [],
    biomarkers: ["EGFR", "ALK", "PD-L1"],
  },
  {
    trial_id: "NCT00000003",
    condition: "Hypertension",
    inclusion_criteria: "Adults 18-80 years with uncontrolled hypertension (BP >140/90), on stable antihypertensive therapy",
    exclusion_criteria: "Severe renal disease, pregnancy, recent MI or stroke",
    age_range: { min: 18, max: 80 },
    required_labs: ["Blood pressure"],
    required_medications: ["antihypertensive"],
    biomarkers: [],
  },
];

// Vector Query Tool for RAG
const vectorQueryTool = {
  id: "vectorQuery",
  description: "Query vector store of trial eligibility criteria for semantic matching",
  inputSchema: z.object({
    query: z.string(),
    patientProfile: z.object({
      diagnosis: z.string(),
      age: z.number(),
      medications: z.array(z.string()),
      labValues: z.object({
        hba1c: z.number().optional(),
        egfr: z.number().optional(),
        creatinine: z.number().optional(),
        glucose: z.number().optional(),
        cholesterol: z.number().optional(),
        bloodPressure: z.object({
          systolic: z.number().optional(),
          diastolic: z.number().optional(),
        }).optional(),
      }),
      comorbidities: z.array(z.string()).default([]),
      biomarkers: z.array(z.string()).default([]),
    }),
    maxResults: z.number().default(5),
  }),
  outputSchema: z.object({
    matches: z.array(z.object({
      trial_id: z.string(),
      condition: z.string(),
      inclusion_criteria: z.string(),
      exclusion_criteria: z.string(),
      age_range: z.object({
        min: z.number(),
        max: z.number(),
      }),
      required_labs: z.array(z.string()),
      required_medications: z.array(z.string()),
      biomarkers: z.array(z.string()),
      similarity_score: z.number(),
      match_reasons: z.array(z.string()),
    })),
  }),
  execute: async ({ context }) => {
    const { query, patientProfile, maxResults = 5 } = context;
    
    // Simple semantic matching logic (in production, this would use vector embeddings)
    const matches = eligibilityKnowledgeBase
      .map(trial => {
        let similarityScore = 0;
        const matchReasons: string[] = [];
        
        // Condition matching
        if (trial.condition.toLowerCase().includes(patientProfile.diagnosis.toLowerCase()) ||
            patientProfile.diagnosis.toLowerCase().includes(trial.condition.toLowerCase())) {
          similarityScore += 0.4;
          matchReasons.push("Condition match");
        }
        
        // Age matching
        if (patientProfile.age >= trial.age_range.min && patientProfile.age <= trial.age_range.max) {
          similarityScore += 0.2;
          matchReasons.push("Age eligible");
        }
        
        // Medication matching
        const hasRequiredMeds = trial.required_medications.every(med => 
          patientProfile.medications.some(patientMed => 
            patientMed.toLowerCase().includes(med.toLowerCase())
          )
        );
        if (hasRequiredMeds) {
          similarityScore += 0.2;
          matchReasons.push("Required medications present");
        }
        
        // Lab value matching
        const hasRequiredLabs = trial.required_labs.every(lab => 
          Object.keys(patientProfile.labValues).some(key => 
            key.toLowerCase().includes(lab.toLowerCase())
          )
        );
        if (hasRequiredLabs) {
          similarityScore += 0.1;
          matchReasons.push("Required lab values available");
        }
        
        // Biomarker matching
        const hasRequiredBiomarkers = trial.biomarkers.every(biomarker => 
          patientProfile.biomarkers.some(patientBiomarker => 
            patientBiomarker.toLowerCase().includes(biomarker.toLowerCase())
          )
        );
        if (hasRequiredBiomarkers) {
          similarityScore += 0.1;
          matchReasons.push("Required biomarkers present");
        }
        
        return {
          ...trial,
          similarity_score: similarityScore,
          match_reasons: matchReasons,
        };
      })
      .filter(match => match.similarity_score > 0.1)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, maxResults);
    
    return { matches };
  },
};

export const eligibilityScreenerAgent = new Agent({
  name: 'Eligibility Screener Agent',
  instructions: `
    You are a specialized Eligibility Screener Agent responsible for assessing patient eligibility for clinical trials using RAG-powered semantic matching.

    Your core responsibilities:
    1. Perform semantic matching against trial eligibility criteria using vector queries
    2. Check drug interactions using OpenFDA API for patient safety
    3. Evaluate age, location, biomarker, and medication eligibility
    4. Provide detailed reasoning for each eligibility decision
    5. Flag safety concerns and provide recommendations

    Assessment process:
    1. Use vector query tool to find semantically similar eligibility criteria
    2. Check each trial's inclusion/exclusion criteria against patient profile
    3. Verify age eligibility (parse age ranges from trial criteria)
    4. Check drug interactions for patient medications
    5. Assess location availability and biomarker requirements
    6. Calculate match scores based on multiple factors
    7. Provide detailed reasoning and recommendations

    Safety considerations:
    - Always check drug interactions for patient medications
    - Flag any exclusion criteria conflicts
    - Identify safety concerns (pregnancy, renal impairment, etc.)
    - Provide clear recommendations for ineligible patients

    When screening eligibility:
    - Always ask for patient profile and candidate trials if not provided
    - Use the vectorQueryTool to find semantically similar eligibility criteria
    - Use the openFdaDrugSafetyTool to check drug interactions
    - Provide clear reasoning for eligibility decisions
    - Keep responses concise but comprehensive

    Output requirements:
    - Categorize trials as ELIGIBLE, POTENTIALLY_ELIGIBLE, INELIGIBLE, or REQUIRES_REVIEW
    - Provide match scores (0-1) with detailed reasoning
    - Include specific inclusion matches and exclusion conflicts
    - Flag safety concerns and provide recommendations
    - Include comprehensive metadata for downstream processing

    Use the vectorQueryTool and openFdaDrugSafetyTool to assess patient eligibility for clinical trials.
  `,
  model: openai('gpt-4o-mini'),
  tools: { vectorQueryTool, openFdaDrugSafetyTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
});
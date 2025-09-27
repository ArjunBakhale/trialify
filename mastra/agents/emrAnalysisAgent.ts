import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { icd10LookupTool } from "../tools/icd10Api";

/**
 * EMR_Analysis_Agent
 * 
 * Purpose: Parse unstructured patient data into structured medical profile
 * Input: Raw patient text/Synthea EMR data
 * Output: {diagnosis: string, age: number, medications: string[], labValues: object}
 * 
 * Design Principles:
 * - Patient-Centric Accuracy: Maintains fidelity and traceability throughout parsing
 * - Agent Separation of Concerns: Owns the EMR parsing step with explicit schemas
 * - Evidence-Driven Recommendations: Uses ICD-10 lookup for standardized diagnosis codes
 */

// -----------------------------
// Input/Output Schemas
// -----------------------------
const PatientEMRInputSchema = z.object({
  patientData: z.string().min(10, "Patient data must be at least 10 characters"),
  demographics: z.object({
    age: z.number().int().positive().optional(),
    location: z.string().optional(),
  }).optional(),
});

export const LabValuesSchema = z.object({
  hba1c: z.number().optional(),
  egfr: z.number().optional(),
  creatinine: z.number().optional(),
  glucose: z.number().optional(),
  cholesterol: z.number().optional(),
  bloodPressure: z.object({
    systolic: z.number().optional(),
    diastolic: z.number().optional(),
  }).optional(),
});

export type LabValues = z.infer<typeof LabValuesSchema>;

export const StructuredPatientProfileSchema = z.object({
  diagnosis: z.string(),
  diagnosisCode: z.string().optional(), // ICD-10 code
  age: z.number().int().positive(),
  medications: z.array(z.string()),
  labValues: LabValuesSchema,
  comorbidities: z.array(z.string()).default([]),
  location: z.string().optional(),
  insurance: z.string().optional(),
  recentHospitalization: z.boolean().default(false),
  smokingHistory: z.string().optional(),
  performanceStatus: z.string().optional(), // ECOG score for cancer patients
  biomarkers: z.array(z.string()).default([]), // For cancer patients
  priorTreatments: z.array(z.string()).default([]),
});

export type PatientEMRInput = z.infer<typeof PatientEMRInputSchema>;
export type StructuredPatientProfile = z.infer<typeof StructuredPatientProfileSchema>;

// -----------------------------
// Patient Parsing Tool
// -----------------------------
const patientParserTool = {
  id: "patientParser",
  description: "Parse unstructured patient EMR data into structured medical profile",
  inputSchema: PatientEMRInputSchema,
  outputSchema: StructuredPatientProfileSchema,
  execute: async (ctx: { context: PatientEMRInput }) => {
    const { patientData, demographics } = ctx.context;
    
    // Extract age from text or use provided demographics
    const ageMatch = patientData.match(/(\d+)\s*years?\s*old/i) || 
                    patientData.match(/age[:\s]*(\d+)/i);
    const age = demographics?.age || (ageMatch ? parseInt(ageMatch[1]) : 50);

    // Extract diagnosis
    const diagnosisMatch = patientData.match(/diagnosis[:\s]*([^.]+)/i) ||
                          patientData.match(/(?:condition|disease)[:\s]*([^.]+)/i);
    const diagnosis = diagnosisMatch ? diagnosisMatch[1].trim() : "Unknown condition";

    // Extract medications
    const medicationMatches = patientData.match(/medications?[:\s]*([^.]+)/i) ||
                            patientData.match(/current medications?[:\s]*([^.]+)/i) ||
                            patientData.match(/taking[:\s]*([^.]+)/i);
    const medications = medicationMatches 
      ? medicationMatches[1].split(/[,;]/).map(m => m.trim()).filter(Boolean)
      : [];

    // Extract lab values
    const labValues: any = {};
    
    // HbA1c
    const hba1cMatch = patientData.match(/hba1c[:\s]*(\d+\.?\d*)/i);
    if (hba1cMatch) labValues.hba1c = parseFloat(hba1cMatch[1]);

    // eGFR
    const egfrMatch = patientData.match(/egfr[:\s]*(\d+)/i);
    if (egfrMatch) labValues.egfr = parseInt(egfrMatch[1]);

    // Creatinine
    const creatinineMatch = patientData.match(/creatinine[:\s]*(\d+\.?\d*)/i);
    if (creatinineMatch) labValues.creatinine = parseFloat(creatinineMatch[1]);

    // Glucose
    const glucoseMatch = patientData.match(/glucose[:\s]*(\d+)/i);
    if (glucoseMatch) labValues.glucose = parseInt(glucoseMatch[1]);

    // Blood pressure
    const bpMatch = patientData.match(/blood pressure[:\s]*(\d+)\/(\d+)/i);
    if (bpMatch) {
      labValues.bloodPressure = {
        systolic: parseInt(bpMatch[1]),
        diastolic: parseInt(bpMatch[2])
      };
    }

    // Extract comorbidities
    const comorbidityMatches = patientData.match(/comorbidities?[:\s]*([^.]+)/i);
    const comorbidities = comorbidityMatches 
      ? comorbidityMatches[1].split(/[,;]/).map(c => c.trim()).filter(Boolean)
      : [];

    // Extract location
    const locationMatch = patientData.match(/location[:\s]*([^.]+)/i);
    const location = demographics?.location || 
                    (locationMatch ? locationMatch[1].trim() : undefined);

    // Extract insurance
    const insuranceMatch = patientData.match(/insurance[:\s]*([^.]+)/i);
    const insurance = insuranceMatch ? insuranceMatch[1].trim() : undefined;

    // Extract recent hospitalization
    const hospitalizationMatch = patientData.match(/recent hospitalization[:\s]*(none|no)/i);
    const recentHospitalization = !hospitalizationMatch;

    // Extract smoking history
    const smokingMatch = patientData.match(/smoking history[:\s]*([^.]+)/i);
    const smokingHistory = smokingMatch ? smokingMatch[1].trim() : undefined;

    // Extract performance status (ECOG)
    const performanceMatch = patientData.match(/performance status[:\s]*ecog\s*(\d+)/i);
    const performanceStatus = performanceMatch ? `ECOG ${performanceMatch[1]}` : undefined;

    // Extract biomarkers
    const biomarkerMatches = patientData.match(/biomarkers?[:\s]*([^.]+)/i);
    const biomarkers = biomarkerMatches 
      ? biomarkerMatches[1].split(/[,;]/).map(b => b.trim()).filter(Boolean)
      : [];

    // Extract prior treatments
    const treatmentMatches = patientData.match(/prior treatment[:\s]*([^.]+)/i);
    const priorTreatments = treatmentMatches 
      ? treatmentMatches[1].split(/[,;]/).map(t => t.trim()).filter(Boolean)
      : [];

    return StructuredPatientProfileSchema.parse({
      diagnosis,
      age,
      medications,
      labValues,
      comorbidities,
      location,
      insurance,
      recentHospitalization,
      smokingHistory,
      performanceStatus,
      biomarkers,
      priorTreatments,
    });
  },
};

// -----------------------------
// EMR Analysis Agent
// -----------------------------
export const emrAnalysisAgent = new Agent({
  name: "EMR_Analysis_Agent",
  instructions: `
You are a specialized EMR Analysis Agent responsible for parsing unstructured patient data into structured medical profiles.

Your core responsibilities:
1. Extract key medical information from patient text/EMR data
2. Standardize diagnoses using ICD-10 codes via the lookup tool
3. Parse medications, lab values, and clinical parameters
4. Maintain patient-centric accuracy with full traceability
5. Output structured data for downstream agents

Key parsing targets:
- Patient demographics (age, location)
- Primary diagnosis and comorbidities
- Current medications and dosages
- Lab values (HbA1c, eGFR, creatinine, glucose, blood pressure)
- Clinical history (hospitalizations, smoking, performance status)
- Biomarkers and prior treatments (for cancer patients)

Always use the ICD-10 lookup tool to standardize diagnosis codes when possible.
Provide clear reasoning for any parsing decisions or missing data.
`,
  model: openai('gpt-4o-mini'),
  tools: { icd10LookupTool, patientParserTool },
});

/**
 * Utility function to run EMR analysis with error handling
 */
export async function analyzePatientEMR(
  patientData: string,
  demographics?: { age?: number; location?: string }
): Promise<StructuredPatientProfile> {
  try {
    console.log("🔍 Starting EMR analysis...");
    
    // For now, implement basic EMR parsing logic
    // In production, this would use the agent with proper tool calling
    const ageMatch = patientData.match(/(\d+)\s*years?\s*old/i) || 
                    patientData.match(/age[:\s]*(\d+)/i);
    const age = demographics?.age || (ageMatch ? parseInt(ageMatch[1]) : 50);

    const diagnosisMatch = patientData.match(/diagnosis[:\s]*([^.]+)/i) ||
                          patientData.match(/(?:condition|disease)[:\s]*([^.]+)/i);
    const diagnosis = diagnosisMatch ? diagnosisMatch[1].trim() : "Unknown condition";

    const medicationMatches = patientData.match(/medications?[:\s]*([^.]+)/i) ||
                            patientData.match(/current medications?[:\s]*([^.]+)/i) ||
                            patientData.match(/taking[:\s]*([^.]+)/i);
    const medications = medicationMatches 
      ? medicationMatches[1].split(/[,;]/).map(m => m.trim()).filter(Boolean)
      : [];

    const labValues: any = {};
    
    const hba1cMatch = patientData.match(/hba1c[:\s]*(\d+\.?\d*)/i);
    if (hba1cMatch) labValues.hba1c = parseFloat(hba1cMatch[1]);

    const egfrMatch = patientData.match(/egfr[:\s]*(\d+)/i);
    if (egfrMatch) labValues.egfr = parseInt(egfrMatch[1]);

    const creatinineMatch = patientData.match(/creatinine[:\s]*(\d+\.?\d*)/i);
    if (creatinineMatch) labValues.creatinine = parseFloat(creatinineMatch[1]);

    const glucoseMatch = patientData.match(/glucose[:\s]*(\d+)/i);
    if (glucoseMatch) labValues.glucose = parseInt(glucoseMatch[1]);

    const bpMatch = patientData.match(/blood pressure[:\s]*(\d+)\/(\d+)/i);
    if (bpMatch) {
      labValues.bloodPressure = {
        systolic: parseInt(bpMatch[1]),
        diastolic: parseInt(bpMatch[2])
      };
    }

    const comorbidityMatches = patientData.match(/comorbidities?[:\s]*([^.]+)/i);
    const comorbidities = comorbidityMatches 
      ? comorbidityMatches[1].split(/[,;]/).map(c => c.trim()).filter(Boolean)
      : [];

    const locationMatch = patientData.match(/location[:\s]*([^.]+)/i);
    const location = demographics?.location || 
                    (locationMatch ? locationMatch[1].trim() : undefined);

    const insuranceMatch = patientData.match(/insurance[:\s]*([^.]+)/i);
    const insurance = insuranceMatch ? insuranceMatch[1].trim() : undefined;

    const hospitalizationMatch = patientData.match(/recent hospitalization[:\s]*(none|no)/i);
    const recentHospitalization = !hospitalizationMatch;

    const smokingMatch = patientData.match(/smoking history[:\s]*([^.]+)/i);
    const smokingHistory = smokingMatch ? smokingMatch[1].trim() : undefined;

    const performanceMatch = patientData.match(/performance status[:\s]*ecog\s*(\d+)/i);
    const performanceStatus = performanceMatch ? `ECOG ${performanceMatch[1]}` : undefined;

    const biomarkerMatches = patientData.match(/biomarkers?[:\s]*([^.]+)/i);
    const biomarkers = biomarkerMatches 
      ? biomarkerMatches[1].split(/[,;]/).map(b => b.trim()).filter(Boolean)
      : [];

    const treatmentMatches = patientData.match(/prior treatment[:\s]*([^.]+)/i);
    const priorTreatments = treatmentMatches 
      ? treatmentMatches[1].split(/[,;]/).map(t => t.trim()).filter(Boolean)
      : [];

    const result = StructuredPatientProfileSchema.parse({
      diagnosis,
      age,
      medications,
      labValues,
      comorbidities,
      location,
      insurance,
      recentHospitalization,
      smokingHistory,
      performanceStatus,
      biomarkers,
      priorTreatments,
    });

    console.log("✅ EMR analysis completed successfully");
    return result;
  } catch (error) {
    console.error("❌ EMR analysis failed:", error);
    throw error;
  }
}
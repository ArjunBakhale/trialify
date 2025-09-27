import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

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

export const StructuredPatientProfileSchema = z.object({
  diagnosis: z.string(),
  age: z.number().int().positive(),
  medications: z.array(z.string()),
  labValues: LabValuesSchema,
  comorbidities: z.array(z.string()),
  location: z.string().optional(),
  insurance: z.string().optional(),
  recentHospitalization: z.boolean().optional(),
  smokingHistory: z.string().optional(),
  performanceStatus: z.string().optional(),
  biomarkers: z.array(z.string()).optional(),
  priorTreatments: z.array(z.string()).optional(),
});

export type LabValues = z.infer<typeof LabValuesSchema>;
export type StructuredPatientProfile = z.infer<typeof StructuredPatientProfileSchema>;

export const emrAnalysisTool = createTool({
  id: 'analyze-emr',
  description: 'Parse unstructured patient EMR data into structured medical profile',
  inputSchema: z.object({
    patientData: z.string().min(10, "Patient data must be at least 10 characters"),
    demographics: z.object({
      age: z.number().int().positive().optional(),
      location: z.string().optional(),
    }).optional(),
  }),
  outputSchema: StructuredPatientProfileSchema,
  execute: async ({ context }) => {
    return await analyzePatientEMR(context.patientData, context.demographics);
  },
});

async function analyzePatientEMR(
  patientData: string,
  demographics?: { age?: number; location?: string }
): Promise<StructuredPatientProfile> {
  try {
    console.log("🔍 Starting EMR analysis...");
    
    // Extract age
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
    const labValues: LabValues = {};
    
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
        diastolic: parseInt(bpMatch[2]),
      };
    }

    // Extract comorbidities
    const comorbidityMatches = patientData.match(/comorbidities?[:\s]*([^.]+)/i) ||
                              patientData.match(/other conditions?[:\s]*([^.]+)/i);
    const comorbidities = comorbidityMatches 
      ? comorbidityMatches[1].split(/[,;]/).map(c => c.trim()).filter(Boolean)
      : [];

    // Extract location
    const locationMatch = patientData.match(/location[:\s]*([^.]+)/i) ||
                         patientData.match(/city[:\s]*([^.]+)/i);
    const location = demographics?.location || 
                    (locationMatch ? locationMatch[1].trim() : undefined);

    // Extract insurance
    const insuranceMatch = patientData.match(/insurance[:\s]*([^.]+)/i);
    const insurance = insuranceMatch ? insuranceMatch[1].trim() : undefined;

    // Extract hospitalization status
    const hospitalizationMatch = patientData.match(/hospitalization[:\s]*(yes|no|recent)/i);
    const recentHospitalization = hospitalizationMatch ? 
      hospitalizationMatch[1].toLowerCase() === 'yes' || 
      hospitalizationMatch[1].toLowerCase() === 'recent' : undefined;

    // Extract smoking history
    const smokingMatch = patientData.match(/smoking[:\s]*([^.]+)/i);
    const smokingHistory = smokingMatch ? smokingMatch[1].trim() : undefined;

    // Extract performance status
    const performanceMatch = patientData.match(/performance status[:\s]*([^.]+)/i);
    const performanceStatus = performanceMatch ? performanceMatch[1].trim() : undefined;

    // Extract biomarkers
    const biomarkerMatches = patientData.match(/biomarkers?[:\s]*([^.]+)/i);
    const biomarkers = biomarkerMatches 
      ? biomarkerMatches[1].split(/[,;]/).map(b => b.trim()).filter(Boolean)
      : [];

    // Extract prior treatments
    const treatmentMatches = patientData.match(/prior treatments?[:\s]*([^.]+)/i) ||
                            patientData.match(/previous treatments?[:\s]*([^.]+)/i);
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
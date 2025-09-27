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
  diagnosisCode: z.string().optional(),
  age: z.number().int().positive(),
  medications: z.array(z.string()).default([]),
  labValues: LabValuesSchema.default({}),
  comorbidities: z.array(z.string()).default([]),
  location: z.string().optional(),
  insurance: z.string().optional(),
  recentHospitalization: z.boolean().default(false),
  smokingHistory: z.string().optional(),
  performanceStatus: z.string().optional(),
  biomarkers: z.array(z.string()).default([]),
  priorTreatments: z.array(z.string()).default([]),
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

export async function analyzePatientEMR(
  patientData: string,
  demographics?: { age?: number; location?: string }
): Promise<StructuredPatientProfile> {
  try {
    console.log("🔍 Starting EMR analysis...");

    const normalized = patientData.replace(/\s+/g, " ").trim();

    const findFirstMatch = (patterns: RegExp[]): RegExpExecArray | null => {
      for (const regex of patterns) {
        const match = regex.exec(normalized);
        if (match) return match;
      }
      return null;
    };

    const findAllMatches = (patterns: RegExp[]): RegExpExecArray[] => {
      const matches: RegExpExecArray[] = [];
      for (const regex of patterns) {
        let match;
        while ((match = regex.exec(normalized)) !== null) {
          matches.push(match);
        }
      }
      return matches;
    };

    const splitList = (value?: string) =>
      value
        ? value
            .split(/[,;\n]/)
            .map((entry) => entry.replace(/^(and\s+)/i, "").trim())
            .filter(Boolean)
        : [];

    // Handle edge cases and improve data quality
    const cleanDiagnosis = (diagnosis: string): string => {
      return diagnosis
        .replace(/\s+/g, " ")
        .replace(/^(the|a|an)\s+/i, "")
        .trim();
    };

    const cleanMedication = (medication: string): string => {
      return medication
        .replace(/\s+/g, " ")
        .replace(/\d+\s*mg/g, "") // Remove dosages for now
        .replace(/\d+\s*tablets?/gi, "")
        .trim();
    };

    // Handle missing data gracefully
    const handleMissingData = (field: string, value: any, defaultValue: any) => {
      if (value === undefined || value === null || value === "") {
        console.warn(`⚠️ Missing ${field}, using default: ${defaultValue}`);
        return defaultValue;
      }
      return value;
    };

    // Validate extracted values
    const validateAge = (age: number): number => {
      if (age < 0 || age > 150) {
        console.warn(`Invalid age extracted: ${age}, using default`);
        return demographics?.age ?? 50;
      }
      return age;
    };

    const validateLabValue = (value: number, name: string, min: number, max: number): number | undefined => {
      if (value < min || value > max) {
        console.warn(`Invalid ${name} value: ${value}, skipping`);
        return undefined;
      }
      return value;
    };

    // Extract age from free-form text with improved patterns
    const ageMatch = findFirstMatch([
      /(\d{1,3})\s*(?:years?|yrs?)\s*(?:old)?/i,
      /age\s*(?:is|:)?\s*(\d{1,3})/i,
      /(\d{1,3})\s*(?:y\/o|yo)\b/i,
      /(\d{1,3})\s*(?:yo|y\.o\.)/i,
      /age[:\s]*(\d{1,3})/i,
    ]);
    const extractedAge = ageMatch ? parseInt(ageMatch[1], 10) : null;
    const age = validateAge(extractedAge ?? demographics?.age ?? 50);

    // Extract diagnosis or condition statements with comprehensive patterns
    const diagnosisMatch = findFirstMatch([
      /diagnosed\s+with\s+([^.;]+)/i,
      /primary\s+diagnosis[:\s]+([^.;]+)/i,
      /has\s+a\s+history\s+of\s+([^.;]+)/i,
      /condition[:\s]+([^.;]+)/i,
      /disease[:\s]+([^.;]+)/i,
      /diagnosis[:\s]+([^.;]+)/i,
      /presenting\s+with\s+([^.;]+)/i,
      /chief\s+complaint[:\s]+([^.;]+)/i,
      /reason\s+for\s+visit[:\s]+([^.;]+)/i,
      /medical\s+condition[:\s]+([^.;]+)/i,
      /suffering\s+from\s+([^.;]+)/i,
      /affected\s+by\s+([^.;]+)/i,
      /has\s+([^.;]+)/i,
      /patient\s+with\s+([^.;]+)/i,
      /case\s+of\s+([^.;]+)/i,
      /history\s+of\s+([^.;]+)/i,
      /status\s+post\s+([^.;]+)/i,
      /s\/p\s+([^.;]+)/i,
    ]);
    const diagnosis = diagnosisMatch ? cleanDiagnosis(diagnosisMatch[1]) : "Unknown condition";

    // Extract diagnosis code if present
    const diagnosisCodeMatch = findFirstMatch([
      /(?:icd-?10|icd10)[:\s]*([a-z]\d{2}(?:\.\d+)?)/i,
      /diagnosis\s+code[:\s]*([a-z]\d{2}(?:\.\d+)?)/i,
      /code[:\s]*([a-z]\d{2}(?:\.\d+)?)/i,
    ]);
    const diagnosisCode = diagnosisCodeMatch ? diagnosisCodeMatch[1].toUpperCase() : undefined;

    // Extract medications from narrative phrases with improved patterns
    const medicationMatch = findFirstMatch([
      /current\s+medications?[:\s]+([^.;]+)/i,
      /medications?\s+include[:\s]+([^.;]+)/i,
      /taking[:\s]+([^.;]+)/i,
      /on\s+medications?[:\s]+([^.;]+)/i,
      /prescribed\s+medications?[:\s]+([^.;]+)/i,
      /drug\s+therapy[:\s]+([^.;]+)/i,
      /medication\s+list[:\s]+([^.;]+)/i,
      /current\s+therapy[:\s]+([^.;]+)/i,
    ]);
    const medications = splitList(medicationMatch?.[1]).map(cleanMedication);

    // Extract lab values with optional units or symbols
    const labValues: LabValues = {};

    const hba1cMatch = findFirstMatch([
      /hba1c[^\d]*(\d+(?:\.\d+)?)%?/i,
      /a1c[^\d]*(\d+(?:\.\d+)?)%?/i,
      /hemoglobin\s+a1c[^\d]*(\d+(?:\.\d+)?)%?/i,
    ]);
    if (hba1cMatch) {
      const value = parseFloat(hba1cMatch[1]);
      labValues.hba1c = validateLabValue(value, 'HbA1c', 3.0, 20.0);
    }

    const egfrMatch = findFirstMatch([
      /egfr[^\d]*(\d+(?:\.\d+)?)/i,
      /estimated\s+gfr[^\d]*(\d+(?:\.\d+)?)/i,
      /glomerular\s+filtration\s+rate[^\d]*(\d+(?:\.\d+)?)/i,
    ]);
    if (egfrMatch) {
      const value = parseFloat(egfrMatch[1]);
      labValues.egfr = validateLabValue(value, 'eGFR', 5.0, 200.0);
    }

    const creatinineMatch = findFirstMatch([
      /creatinine[^\d]*(\d+(?:\.\d+)?)/i,
      /serum\s+creatinine[^\d]*(\d+(?:\.\d+)?)/i,
    ]);
    if (creatinineMatch) {
      const value = parseFloat(creatinineMatch[1]);
      labValues.creatinine = validateLabValue(value, 'Creatinine', 0.1, 20.0);
    }

    const glucoseMatch = findFirstMatch([
      /glucose[^\d]*(\d+(?:\.\d+)?)/i,
      /blood\s+sugar[^\d]*(\d+(?:\.\d+)?)/i,
      /blood\s+glucose[^\d]*(\d+(?:\.\d+)?)/i,
      /fasting\s+glucose[^\d]*(\d+(?:\.\d+)?)/i,
    ]);
    if (glucoseMatch) {
      const value = parseFloat(glucoseMatch[1]);
      labValues.glucose = validateLabValue(value, 'Glucose', 20.0, 1000.0);
    }

    const bpMatch = findFirstMatch([
      /blood\s+pressure[^\d]*(\d{2,3})\s*[\/\\-]\s*(\d{2,3})/i,
      /(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mmhg)?\s*blood\s*pressure/i,
      /bp[:\s]*(\d{2,3})\s*[\/\\-]\s*(\d{2,3})/i,
      /(\d{2,3})\s*[\/\\-]\s*(\d{2,3})\s*(?:mmhg)?/i,
    ]);
    if (bpMatch) {
      const systolic = parseInt(bpMatch[1], 10);
      const diastolic = parseInt(bpMatch[2], 10);
      if (systolic >= 70 && systolic <= 300 && diastolic >= 40 && diastolic <= 200) {
        labValues.bloodPressure = { systolic, diastolic };
      } else {
        console.warn(`Invalid blood pressure values: ${systolic}/${diastolic}, skipping`);
      }
    }

    const cholesterolMatch = findFirstMatch([
      /cholesterol[^\d]*(\d+(?:\.\d+)?)/i,
      /total\s+cholesterol[^\d]*(\d+(?:\.\d+)?)/i,
      /ldl[^\d]*(\d+(?:\.\d+)?)/i,
      /hdl[^\d]*(\d+(?:\.\d+)?)/i,
    ]);
    if (cholesterolMatch) {
      const value = parseFloat(cholesterolMatch[1]);
      labValues.cholesterol = validateLabValue(value, 'Cholesterol', 50.0, 1000.0);
    }

    // Extract comorbidities or history items with improved patterns
    const comorbidityMatch = findFirstMatch([
      /comorbidities?[:\s]+([^.;]+)/i,
      /additional\s+history[:\s]+([^.;]+)/i,
      /history\s+of[:\s]+([^.;]+)/i,
      /past\s+medical\s+history[:\s]+([^.;]+)/i,
      /pmh[:\s]+([^.;]+)/i,
      /concurrent\s+conditions?[:\s]+([^.;]+)/i,
      /associated\s+conditions?[:\s]+([^.;]+)/i,
    ]);
    const comorbidities = splitList(comorbidityMatch?.[1]);

    // Extract location if available with improved patterns
    const locationMatch = findFirstMatch([
      /lives\s+in\s+([^.;]+)/i,
      /resides\s+in\s+([^.;]+)/i,
      /location[:\s]+([^.;]+)/i,
      /city[:\s]+([^.;]+)/i,
      /address[:\s]+([^.;]+)/i,
      /residence[:\s]+([^.;]+)/i,
      /from\s+([^.;]+)/i,
    ]);
    const location = demographics?.location ?? locationMatch?.[1]?.trim();

    // Insurance with improved patterns
    const insuranceMatch = findFirstMatch([
      /insurance[:\s]+([^.;]+)/i,
      /covered\s+by\s+([^.;]+)/i,
      /payer[:\s]+([^.;]+)/i,
      /coverage[:\s]+([^.;]+)/i,
      /insurance\s+provider[:\s]+([^.;]+)/i,
    ]);
    const insurance = insuranceMatch ? insuranceMatch[1].trim() : undefined;

    // Hospitalization with improved patterns
    const hospitalizationMatch = findFirstMatch([
      /recent\s+hospitalization[:\s]+(yes|no)/i,
      /hospitalized[:\s]+(yes|no)/i,
      /recently\s+hospitalized\s+(yes|no)/i,
      /hospital\s+admission[:\s]+(yes|no)/i,
      /inpatient[:\s]+(yes|no)/i,
      /admitted[:\s]+(yes|no)/i,
    ]);
    const recentHospitalization = hospitalizationMatch
      ? hospitalizationMatch[1].toLowerCase() === "yes"
      : undefined;

    // Smoking history with improved patterns
    const smokingMatch = findFirstMatch([
      /smoking\s+history[:\s]+([^.;]+)/i,
      /(?:smokes|smoked|smoking)[:\s]+([^.;]+)/i,
      /tobacco\s+use[:\s]+([^.;]+)/i,
      /cigarette\s+smoking[:\s]+([^.;]+)/i,
      /pack\s+years[:\s]+([^.;]+)/i,
    ]);
    const smokingHistory = smokingMatch ? smokingMatch[1].trim() : undefined;

    // Performance status with improved patterns
    const performanceMatch = findFirstMatch([
      /performance\s+status[:\s]+([^.;]+)/i,
      /ecog\s*(\d)/i,
      /karnofsky\s+score[:\s]+([^.;]+)/i,
      /functional\s+status[:\s]+([^.;]+)/i,
      /ps[:\s]+(\d)/i,
    ]);
    const performanceValue = performanceMatch?.[1]?.trim();
    const performanceStatus = performanceValue
      ? /ecog/i.test(performanceValue) || /ps/i.test(performanceValue)
        ? performanceValue
        : `ECOG ${performanceValue}`
      : performanceMatch?.[0]?.trim();

    // Biomarkers and prior treatments with improved patterns
    const biomarkerMatch = findFirstMatch([
      /biomarkers?[:\s]+([^.;]+)/i,
      /molecular\s+markers?[:\s]+([^.;]+)/i,
      /genetic\s+testing[:\s]+([^.;]+)/i,
      /mutation\s+status[:\s]+([^.;]+)/i,
      /protein\s+expression[:\s]+([^.;]+)/i,
    ]);
    const biomarkers = splitList(biomarkerMatch?.[1]);

    const priorTreatmentMatch = findFirstMatch([
      /prior\s+treatments?[:\s]+([^.;]+)/i,
      /previous\s+therapies?[:\s]+([^.;]+)/i,
      /treatment\s+history[:\s]+([^.;]+)/i,
      /past\s+treatments?[:\s]+([^.;]+)/i,
      /prior\s+therapy[:\s]+([^.;]+)/i,
      /chemotherapy\s+history[:\s]+([^.;]+)/i,
    ]);
    const priorTreatments = splitList(priorTreatmentMatch?.[1]);

    const result = StructuredPatientProfileSchema.parse({
      diagnosis: handleMissingData("diagnosis", diagnosis, "Unknown condition"),
      diagnosisCode,
      age: handleMissingData("age", age, 50),
      medications: handleMissingData("medications", medications, []),
      labValues: handleMissingData("labValues", labValues, {}),
      comorbidities: handleMissingData("comorbidities", comorbidities, []),
      location,
      insurance,
      recentHospitalization: handleMissingData("recentHospitalization", recentHospitalization, false),
      smokingHistory,
      performanceStatus,
      biomarkers: handleMissingData("biomarkers", biomarkers, []),
      priorTreatments: handleMissingData("priorTreatments", priorTreatments, []),
    });

    const normalizedResult: StructuredPatientProfile = {
      ...result,
      comorbidities: result.comorbidities ?? [],
      biomarkers: result.biomarkers ?? [],
      priorTreatments: result.priorTreatments ?? [],
      recentHospitalization: result.recentHospitalization ?? false,
    };

    console.log("✅ EMR analysis completed successfully");
    console.log("📊 Extracted data summary:", {
      diagnosis: normalizedResult.diagnosis,
      diagnosisCode: normalizedResult.diagnosisCode,
      age: normalizedResult.age,
      medicationCount: normalizedResult.medications.length,
      labValueCount: Object.keys(normalizedResult.labValues).length,
      comorbidityCount: normalizedResult.comorbidities.length,
    });
    return normalizedResult;
  } catch (error) {
    console.error("❌ EMR analysis failed:", error);
    console.error("📝 Input data:", patientData.substring(0, 200) + "...");
    throw error;
  }
}
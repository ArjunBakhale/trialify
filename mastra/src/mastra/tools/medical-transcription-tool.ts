import { Tool } from '@mastra/core'
import { z } from 'zod'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

export const medicalTranscriptionTool = new Tool({
  id: 'medical_transcription_analyzer',
  name: 'Medical Transcription Analyzer',
  description: 'Analyzes doctor-patient conversation transcripts to extract structured medical information for clinical trial matching',

  inputSchema: z.object({
    transcription: z.string().describe('The conversation transcript to analyze'),
    extractionMode: z.enum(['comprehensive', 'trial_focused', 'eligibility_check']).default('comprehensive').describe('Type of extraction to perform'),
    existingPatientData: z.record(z.any()).optional().describe('Existing patient form data to supplement')
  }),

  outputSchema: z.object({
    extractedData: z.object({
      // Core patient information
      demographics: z.object({
        age: z.string().optional(),
        gender: z.string().optional(),
        ethnicity: z.string().optional(),
        location: z.string().optional()
      }).optional(),

      // Medical information
      primaryDiagnosis: z.string().optional(),
      secondaryDiagnoses: z.array(z.string()).default([]),
      currentMedications: z.array(z.object({
        name: z.string(),
        dosage: z.string().optional(),
        frequency: z.string().optional(),
        duration: z.string().optional()
      })).default([]),

      symptoms: z.array(z.object({
        symptom: z.string(),
        severity: z.string().optional(),
        duration: z.string().optional(),
        onset: z.string().optional()
      })).default([]),

      // Lab values and vital signs
      labResults: z.object({
        hba1c: z.object({ value: z.string(), unit: z.string(), date: z.string().optional() }).optional(),
        egfr: z.object({ value: z.string(), unit: z.string(), date: z.string().optional() }).optional(),
        ldlCholesterol: z.object({ value: z.string(), unit: z.string(), date: z.string().optional() }).optional(),
        hdlCholesterol: z.object({ value: z.string(), unit: z.string(), date: z.string().optional() }).optional(),
        bloodPressure: z.object({
          systolic: z.string(),
          diastolic: z.string(),
          date: z.string().optional()
        }).optional(),
        other: z.array(z.object({
          test: z.string(),
          value: z.string(),
          unit: z.string().optional(),
          date: z.string().optional()
        })).default([])
      }).optional(),

      // Medical history
      medicalHistory: z.array(z.object({
        condition: z.string(),
        diagnosisDate: z.string().optional(),
        status: z.enum(['active', 'resolved', 'chronic', 'acute']).optional()
      })).default([]),

      // Treatment history
      priorTreatments: z.array(z.object({
        treatment: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        outcome: z.string().optional(),
        reason: z.string().optional()
      })).default([]),

      // Clinical trial eligibility indicators
      eligibilityFactors: z.object({
        recentHospitalization: z.boolean().optional(),
        currentlyPregnant: z.boolean().optional(),
        smokingStatus: z.enum(['never', 'former', 'current']).optional(),
        alcoholUse: z.enum(['none', 'moderate', 'heavy']).optional(),
        functionalStatus: z.string().optional(),
        cognitiveStatus: z.string().optional()
      }).optional(),

      // Red flags and contraindications
      safetyFlags: z.array(z.object({
        flag: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        description: z.string()
      })).default([])
    }),

    confidence: z.object({
      overall: z.number().min(0).max(1),
      demographics: z.number().min(0).max(1),
      diagnosis: z.number().min(0).max(1),
      medications: z.number().min(0).max(1),
      labValues: z.number().min(0).max(1)
    }),

    mappedToForm: z.record(z.any()).describe('Data mapped to patient form structure'),
    suggestedTrialCriteria: z.array(z.string()).describe('Suggested clinical trial search criteria'),
    processingNotes: z.array(z.string()).describe('Notes about the extraction process')
  }),

  execute: async ({ transcription, extractionMode = 'comprehensive', existingPatientData = {} }) => {
    try {
      // First, perform medical entity extraction
      const entityExtraction = await extractMedicalEntities(transcription, extractionMode)

      // Then, structure and validate the data
      const structuredData = await structureMedicalData(entityExtraction, existingPatientData)

      // Calculate confidence scores
      const confidence = calculateConfidenceScores(structuredData, transcription)

      // Map to patient form format
      const mappedToForm = mapToPatientForm(structuredData)

      // Generate trial search criteria suggestions
      const suggestedTrialCriteria = generateTrialCriteria(structuredData)

      return {
        extractedData: structuredData,
        confidence,
        mappedToForm,
        suggestedTrialCriteria,
        processingNotes: [
          `Extracted data using ${extractionMode} mode`,
          `Confidence: ${Math.round(confidence.overall * 100)}%`,
          `Found ${structuredData.currentMedications.length} medications`,
          `Identified ${structuredData.symptoms.length} symptoms`
        ]
      }

    } catch (error) {
      console.error('Medical transcription analysis failed:', error)
      throw new Error(`Failed to analyze medical transcription: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
})

// Helper function to extract medical entities using advanced prompting
async function extractMedicalEntities(transcription: string, mode: string) {
  const systemPrompt = getSystemPrompt(mode)

  const response = await generateText({
    model: openai('gpt-4'),
    system: systemPrompt,
    prompt: `Analyze this doctor-patient conversation transcript:\n\n${transcription}`,
    temperature: 0.1,
    maxTokens: 2000
  })

  if (!response.text) {
    throw new Error('No response from OpenAI')
  }

  try {
    return JSON.parse(response.text)
  } catch (error) {
    console.warn('Failed to parse medical entity extraction:', error)
    // Return a basic structure if parsing fails
    return {
      diagnosis: "",
      medications: [],
      symptoms: [],
      labValues: {},
      demographics: {}
    }
  }
}

function getSystemPrompt(mode: string): string {
  const basePrompt = `You are an expert medical AI that extracts structured information from doctor-patient conversations.`

  const modeInstructions = {
    comprehensive: `Extract all available medical information including demographics, symptoms, medications, lab values, medical history, and treatment plans.`,
    trial_focused: `Focus on information most relevant to clinical trial eligibility: inclusion/exclusion criteria, contraindications, previous treatments, and current status.`,
    eligibility_check: `Specifically look for factors that would affect clinical trial eligibility: age, diagnosis, current treatments, exclusion criteria, and safety factors.`
  }

  return `${basePrompt}

${modeInstructions[mode as keyof typeof modeInstructions]}

Extract information and return as JSON with this structure:
{
  "demographics": {
    "age": "number or range",
    "gender": "male/female/other",
    "ethnicity": "if mentioned",
    "location": "if mentioned"
  },
  "primaryDiagnosis": "main condition discussed",
  "secondaryDiagnoses": ["other conditions"],
  "currentMedications": [
    {
      "name": "medication name",
      "dosage": "dose if mentioned",
      "frequency": "how often if mentioned",
      "duration": "how long if mentioned"
    }
  ],
  "symptoms": [
    {
      "symptom": "symptom name",
      "severity": "mild/moderate/severe if mentioned",
      "duration": "how long if mentioned",
      "onset": "when started if mentioned"
    }
  ],
  "labResults": {
    "hba1c": {"value": "number", "unit": "%" "date": "if mentioned"},
    "egfr": {"value": "number", "unit": "mL/min/1.73m²", "date": "if mentioned"},
    "ldlCholesterol": {"value": "number", "unit": "mg/dL", "date": "if mentioned"},
    "hdlCholesterol": {"value": "number", "unit": "mg/dL", "date": "if mentioned"},
    "bloodPressure": {"systolic": "number", "diastolic": "number", "date": "if mentioned"},
    "other": [{"test": "name", "value": "result", "unit": "if known", "date": "if mentioned"}]
  },
  "medicalHistory": [
    {
      "condition": "past condition",
      "diagnosisDate": "when diagnosed if mentioned",
      "status": "active/resolved/chronic/acute"
    }
  ],
  "priorTreatments": [
    {
      "treatment": "treatment name",
      "startDate": "if mentioned",
      "endDate": "if mentioned",
      "outcome": "result if mentioned",
      "reason": "why started/stopped if mentioned"
    }
  ],
  "eligibilityFactors": {
    "recentHospitalization": true/false if mentioned,
    "currentlyPregnant": true/false if mentioned,
    "smokingStatus": "never/former/current if mentioned",
    "alcoholUse": "none/moderate/heavy if mentioned",
    "functionalStatus": "description if mentioned",
    "cognitiveStatus": "description if mentioned"
  },
  "safetyFlags": [
    {
      "flag": "safety concern",
      "severity": "low/medium/high/critical",
      "description": "explanation"
    }
  ]
}

Only include information explicitly mentioned in the conversation. Do not infer or assume values not stated.`
}

function structureMedicalData(rawData: any, existingData: any) {
  // Merge and validate extracted data with existing patient data
  return {
    demographics: { ...existingData.demographics, ...rawData.demographics },
    primaryDiagnosis: rawData.primaryDiagnosis || existingData.diagnosis || "",
    secondaryDiagnoses: rawData.secondaryDiagnoses || [],
    currentMedications: rawData.currentMedications || [],
    symptoms: rawData.symptoms || [],
    labResults: rawData.labResults || {},
    medicalHistory: rawData.medicalHistory || [],
    priorTreatments: rawData.priorTreatments || [],
    eligibilityFactors: rawData.eligibilityFactors || {},
    safetyFlags: rawData.safetyFlags || []
  }
}

function calculateConfidenceScores(data: any, transcription: string) {
  // Calculate confidence based on data completeness and transcript quality
  const transcriptLength = transcription.length
  const wordCount = transcription.split(' ').length

  const hasKey = (obj: any, key: string) => obj && obj[key] && obj[key] !== ""
  const hasArray = (obj: any, key: string) => obj && obj[key] && Array.isArray(obj[key]) && obj[key].length > 0

  const demographics = hasKey(data.demographics, 'age') ? 0.8 : 0.3
  const diagnosis = hasKey(data, 'primaryDiagnosis') ? 0.9 : 0.2
  const medications = hasArray(data, 'currentMedications') ? 0.8 : 0.4
  const labValues = data.labResults && Object.keys(data.labResults).length > 0 ? 0.7 : 0.3

  // Adjust based on transcript quality
  const transcriptQuality = Math.min(1, Math.max(0.3, wordCount / 200))

  const overall = (demographics + diagnosis + medications + labValues) / 4 * transcriptQuality

  return {
    overall: Math.round(overall * 100) / 100,
    demographics: Math.round(demographics * 100) / 100,
    diagnosis: Math.round(diagnosis * 100) / 100,
    medications: Math.round(medications * 100) / 100,
    labValues: Math.round(labValues * 100) / 100
  }
}

function mapToPatientForm(data: any) {
  return {
    diagnosis: data.primaryDiagnosis || "",
    age: data.demographics?.age || "",
    medications: data.currentMedications?.map((med: any) => med.name) || [],
    comorbidities: [
      ...data.secondaryDiagnoses || [],
      ...data.medicalHistory?.map((h: any) => h.condition) || []
    ],
    symptoms: data.symptoms?.map((s: any) => s.symptom) || [],
    labValues: {
      hba1c: data.labResults?.hba1c?.value || "",
      egfr: data.labResults?.egfr?.value || "",
      ldl: data.labResults?.ldlCholesterol?.value || "",
      hdl: data.labResults?.hdlCholesterol?.value || ""
    },
    bloodPressure: {
      systolic: data.labResults?.bloodPressure?.systolic || "",
      diastolic: data.labResults?.bloodPressure?.diastolic || ""
    },
    priorTreatments: data.priorTreatments?.map((t: any) => t.treatment) || [],
    hospitalized: data.eligibilityFactors?.recentHospitalization ? "yes" : "no",
    smokingHistory: data.eligibilityFactors?.smokingStatus || ""
  }
}

function generateTrialCriteria(data: any): string[] {
  const criteria = []

  if (data.primaryDiagnosis) {
    criteria.push(`Primary diagnosis: ${data.primaryDiagnosis}`)
  }

  if (data.demographics?.age) {
    criteria.push(`Age: ${data.demographics.age}`)
  }

  if (data.currentMedications?.length > 0) {
    criteria.push(`Current medications: ${data.currentMedications.map((m: any) => m.name).join(', ')}`)
  }

  if (data.safetyFlags?.length > 0) {
    criteria.push(`Safety considerations: ${data.safetyFlags.map((f: any) => f.flag).join(', ')}`)
  }

  return criteria
}
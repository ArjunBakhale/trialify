import { Agent } from '@mastra/core'
import { z } from 'zod'
import { medicalTranscriptionTool } from '../tools/medical-transcription-tool'

export const conversationAnalysisAgent = new Agent({
  name: 'ConversationAnalysisAgent',
  instructions: `You are a specialized medical AI agent that analyzes doctor-patient conversations to extract structured clinical information for clinical trial matching.

Your role is to:
1. Process audio transcriptions of medical consultations
2. Extract relevant clinical data (diagnosis, medications, symptoms, lab values)
3. Identify potential clinical trial eligibility factors
4. Flag safety concerns or contraindications
5. Map extracted information to standardized medical forms
6. Provide confidence assessments for extracted data

Key responsibilities:
- Maintain HIPAA compliance and patient privacy
- Focus on factual information explicitly stated in conversations
- Avoid making medical diagnoses or treatment recommendations
- Identify gaps in information that may need clarification
- Suggest relevant clinical trial search criteria

Processing guidelines:
- Use medical terminology appropriately
- Distinguish between patient-reported symptoms and physician assessments
- Note temporal aspects (current vs. historical information)
- Identify medication adherence and side effects when mentioned
- Flag any safety concerns or red flags for clinical trials

Always prioritize accuracy over completeness and clearly indicate confidence levels for extracted information.`,

  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4',
    toolChoice: 'auto'
  },

  tools: [medicalTranscriptionTool],

  enabledTools: ['medical_transcription_analyzer']
})

// Conversation analysis workflow
export async function analyzeConversation(transcription: string, patientContext?: any) {
  try {
    console.log('🔍 Starting conversation analysis...')

    // Determine extraction mode based on available context
    let extractionMode: 'comprehensive' | 'trial_focused' | 'eligibility_check' = 'comprehensive'

    if (patientContext?.focusArea === 'trial_eligibility') {
      extractionMode = 'eligibility_check'
    } else if (patientContext?.existingDiagnosis) {
      extractionMode = 'trial_focused'
    }

    const prompt = `Analyze this doctor-patient conversation transcript and extract all relevant medical information for clinical trial matching:

Transcript:
${transcription}

${patientContext ? `
Existing patient context:
${JSON.stringify(patientContext, null, 2)}
` : ''}

Please provide a comprehensive analysis including:
1. All medical information mentioned
2. Clinical trial eligibility factors
3. Safety considerations
4. Confidence assessment of extracted data
5. Suggestions for additional information needed

Use the medical_transcription_analyzer tool to process this information.`

    const response = await conversationAnalysisAgent.generate(prompt)

    // Process the response to extract structured data
    const analysisResult = processAgentResponse(response)

    console.log('✅ Conversation analysis completed')

    return {
      success: true,
      data: analysisResult,
      processingTime: Date.now(),
      extractionMode
    }

  } catch (error) {
    console.error('❌ Conversation analysis failed:', error)

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during analysis',
      processingTime: Date.now()
    }
  }
}

// Process and validate agent response
function processAgentResponse(response: any) {
  // Extract tool calls and results from agent response
  const toolResults = response.toolCalls || []

  let medicalData = {
    extractedData: {},
    confidence: { overall: 0.5 },
    mappedToForm: {},
    suggestedTrialCriteria: [],
    processingNotes: []
  }

  // Find medical transcription tool results
  for (const toolCall of toolResults) {
    if (toolCall.toolName === 'medical_transcription_analyzer') {
      medicalData = { ...medicalData, ...toolCall.result }
      break
    }
  }

  // Add additional analysis
  const analysis = {
    ...medicalData,
    conversationSummary: generateConversationSummary(medicalData.extractedData),
    trialEligibilityAssessment: assessTrialEligibility(medicalData.extractedData),
    dataQualityMetrics: calculateDataQuality(medicalData),
    recommendedNextSteps: generateNextSteps(medicalData.extractedData, medicalData.confidence)
  }

  return analysis
}

// Generate conversation summary
function generateConversationSummary(extractedData: any) {
  const summary = []

  if (extractedData.primaryDiagnosis) {
    summary.push(`Primary diagnosis: ${extractedData.primaryDiagnosis}`)
  }

  if (extractedData.currentMedications?.length > 0) {
    summary.push(`Current medications: ${extractedData.currentMedications.length} identified`)
  }

  if (extractedData.symptoms?.length > 0) {
    summary.push(`Symptoms discussed: ${extractedData.symptoms.length} identified`)
  }

  if (extractedData.labResults && Object.keys(extractedData.labResults).length > 0) {
    summary.push(`Lab results: ${Object.keys(extractedData.labResults).length} values mentioned`)
  }

  if (extractedData.safetyFlags?.length > 0) {
    summary.push(`Safety flags: ${extractedData.safetyFlags.length} identified`)
  }

  return summary.join('. ')
}

// Assess clinical trial eligibility
function assessTrialEligibility(extractedData: any) {
  const assessment = {
    eligibilityFactors: [],
    potentialExclusions: [],
    requiredClarifications: [],
    overallAssessment: 'REQUIRES_REVIEW'
  }

  // Check age eligibility
  if (extractedData.demographics?.age) {
    const age = parseInt(extractedData.demographics.age)
    if (age >= 18 && age <= 80) {
      assessment.eligibilityFactors.push('Age within typical trial range')
    } else if (age < 18) {
      assessment.potentialExclusions.push('Under 18 years old')
    } else {
      assessment.eligibilityFactors.push('Advanced age - trial-specific review needed')
    }
  } else {
    assessment.requiredClarifications.push('Age not specified')
  }

  // Check diagnosis
  if (extractedData.primaryDiagnosis) {
    assessment.eligibilityFactors.push(`Primary diagnosis: ${extractedData.primaryDiagnosis}`)
  } else {
    assessment.requiredClarifications.push('Primary diagnosis not clearly stated')
  }

  // Check safety flags
  if (extractedData.safetyFlags?.length > 0) {
    const highRiskFlags = extractedData.safetyFlags.filter((f: any) =>
      f.severity === 'high' || f.severity === 'critical'
    )
    if (highRiskFlags.length > 0) {
      assessment.potentialExclusions.push(...highRiskFlags.map((f: any) => f.flag))
    }
  }

  // Check current treatments
  if (extractedData.currentMedications?.length > 0) {
    assessment.eligibilityFactors.push(`Current treatments: ${extractedData.currentMedications.length} medications`)
  }

  // Check recent hospitalization
  if (extractedData.eligibilityFactors?.recentHospitalization) {
    assessment.potentialExclusions.push('Recent hospitalization')
  }

  // Overall assessment
  if (assessment.potentialExclusions.length === 0 && assessment.requiredClarifications.length <= 2) {
    assessment.overallAssessment = 'LIKELY_ELIGIBLE'
  } else if (assessment.potentialExclusions.length > 2) {
    assessment.overallAssessment = 'LIKELY_INELIGIBLE'
  }

  return assessment
}

// Calculate data quality metrics
function calculateDataQuality(medicalData: any) {
  const confidence = medicalData.confidence || {}
  const extractedData = medicalData.extractedData || {}

  return {
    overallScore: confidence.overall || 0.5,
    completeness: calculateCompleteness(extractedData),
    reliability: calculateReliability(confidence),
    missingCriticalInfo: identifyMissingInfo(extractedData),
    dataIntegrity: assessDataIntegrity(extractedData)
  }
}

function calculateCompleteness(data: any): number {
  const requiredFields = [
    'primaryDiagnosis',
    'demographics.age',
    'currentMedications',
    'symptoms'
  ]

  let completedFields = 0
  for (const field of requiredFields) {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      if (data[parent]?.[child]) completedFields++
    } else {
      if (data[field] && (Array.isArray(data[field]) ? data[field].length > 0 : true)) {
        completedFields++
      }
    }
  }

  return completedFields / requiredFields.length
}

function calculateReliability(confidence: any): number {
  const scores = Object.values(confidence).filter(score => typeof score === 'number')
  return scores.length > 0 ? scores.reduce((sum: number, score: any) => sum + score, 0) / scores.length : 0.5
}

function identifyMissingInfo(data: any): string[] {
  const missing = []

  if (!data.primaryDiagnosis) missing.push('Primary diagnosis')
  if (!data.demographics?.age) missing.push('Patient age')
  if (!data.currentMedications?.length) missing.push('Current medications')
  if (!data.labResults || Object.keys(data.labResults).length === 0) missing.push('Recent lab results')
  if (!data.medicalHistory?.length) missing.push('Medical history')

  return missing
}

function assessDataIntegrity(data: any): 'HIGH' | 'MEDIUM' | 'LOW' {
  let integrityScore = 0

  // Check for contradictions or inconsistencies
  if (data.primaryDiagnosis && data.currentMedications?.length > 0) {
    integrityScore += 2 // Diagnosis and medications are consistent
  }

  if (data.symptoms?.length > 0 && data.primaryDiagnosis) {
    integrityScore += 1 // Symptoms align with diagnosis
  }

  if (data.labResults && Object.keys(data.labResults).length > 0) {
    integrityScore += 1 // Lab results provide supporting evidence
  }

  if (integrityScore >= 3) return 'HIGH'
  if (integrityScore >= 2) return 'MEDIUM'
  return 'LOW'
}

// Generate recommended next steps
function generateNextSteps(extractedData: any, confidence: any) {
  const steps = []

  if (confidence.overall < 0.7) {
    steps.push('Review and verify extracted information with patient/provider')
  }

  if (!extractedData.primaryDiagnosis) {
    steps.push('Clarify primary diagnosis')
  }

  if (!extractedData.demographics?.age) {
    steps.push('Confirm patient age for trial eligibility')
  }

  if (!extractedData.currentMedications?.length) {
    steps.push('Obtain complete current medication list')
  }

  if (!extractedData.labResults || Object.keys(extractedData.labResults).length === 0) {
    steps.push('Request recent lab results if relevant to trials')
  }

  if (extractedData.safetyFlags?.length > 0) {
    steps.push('Review safety flags before trial enrollment')
  }

  if (steps.length === 0) {
    steps.push('Proceed with clinical trial matching based on extracted data')
  }

  return steps
}

export default conversationAnalysisAgent
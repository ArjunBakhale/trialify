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
  medications: z.array(z.string()),
  labValues: LabValuesSchema,
  comorbidities: z.array(z.string()).default([]),
  location: z.string().optional(),
  insurance: z.string().optional(),
  recentHospitalization: z.boolean().default(false),
  smokingHistory: z.string().optional(),
  performanceStatus: z.string().optional(),
  biomarkers: z.array(z.string()).default([]),
  priorTreatments: z.array(z.string()).default([]),
});

export const SummarizationInputSchema = z.object({
  patientProfile: StructuredPatientProfileSchema,
  trialScoutResults: z.object({
    patientProfile: StructuredPatientProfileSchema,
    candidateTrials: z.array(z.object({
      nctId: z.string(),
      title: z.string().optional(),
      status: z.string().optional(),
      phase: z.string().optional(),
      studyType: z.string().optional(),
      condition: z.string().optional(),
      intervention: z.string().optional(),
      eligibilityCriteria: z.object({
        inclusionCriteria: z.array(z.string()),
        exclusionCriteria: z.array(z.string()),
        minimumAge: z.string().optional(),
        maximumAge: z.string().optional(),
        gender: z.string().optional(),
      }),
      locations: z.array(z.object({
        facility: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        status: z.string().optional(),
        contacts: z.array(z.object({
          name: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
        })).default([]),
      })),
      contacts: z.object({
        centralContact: z.string().optional(),
        overallOfficial: z.string().optional(),
      }).optional(),
      urls: z.object({
        clinicalTrialsGov: z.string().url(),
        studyWebsite: z.string().url().optional(),
      }),
      lastUpdate: z.string().optional(),
      enrollmentCount: z.number().optional(),
      startDate: z.string().optional(),
      completionDate: z.string().optional(),
      literatureSupport: z.array(z.object({
        pmid: z.string(),
        title: z.string(),
        authors: z.array(z.string()),
        journal: z.string().optional(),
        publicationDate: z.string().optional(),
        url: z.string().url().optional(),
        relevanceScore: z.number().min(0).max(1).optional(),
      })).default([]),
      matchReasons: z.array(z.string()).default([]),
      // Dropout risk assessment data
      dropoutRisk: z.object({
        overallRisk: z.number().min(0).max(1),
        riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']),
        confidence: z.number().min(0).max(1),
      }).optional(),
      riskFactors: z.array(z.object({
        factor: z.string(),
        impact: z.number().min(0).max(1),
        description: z.string(),
        mitigation: z.string().optional(),
      })).optional(),
      riskMitigationRecommendations: z.array(z.string()).optional(),
    })),
    searchMetadata: z.object({
      searchTerms: z.array(z.string()),
      totalTrialsFound: z.number(),
      literatureQueries: z.array(z.string()),
      executionTimeMs: z.number(),
      apiCalls: z.object({
        clinicalTrials: z.number(),
        pubmed: z.number(),
      }),
    }),
  }),
  eligibilityResults: z.object({
    patientProfile: StructuredPatientProfileSchema,
    eligibilityAssessments: z.array(z.object({
      nctId: z.string(),
      title: z.string().optional(),
      eligibilityStatus: z.enum(["ELIGIBLE", "POTENTIALLY_ELIGIBLE", "INELIGIBLE", "REQUIRES_REVIEW"]),
      matchScore: z.number().min(0).max(1),
      inclusionMatches: z.array(z.string()).default([]),
      exclusionConflicts: z.array(z.string()).default([]),
      ageEligibility: z.object({
        eligible: z.boolean(),
        reason: z.string(),
        patientAge: z.number(),
        trialMinAge: z.string().optional(),
        trialMaxAge: z.string().optional(),
      }),
      drugInteractions: z.array(z.object({
        medication: z.string(),
        interaction: z.string(),
        severity: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
        recommendation: z.string(),
      })).default([]),
      locationEligibility: z.object({
        eligible: z.boolean(),
        reason: z.string(),
        availableLocations: z.array(z.string()).default([]),
      }),
      biomarkerEligibility: z.object({
        eligible: z.boolean(),
        reason: z.string(),
        requiredBiomarkers: z.array(z.string()).default([]),
        patientBiomarkers: z.array(z.string()).default([]),
      }),
      reasoning: z.string(),
      recommendations: z.array(z.string()).default([]),
      safetyFlags: z.array(z.string()).default([]),
      // Dropout risk assessment data
      dropoutRisk: z.object({
        overallRisk: z.number().min(0).max(1),
        riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']),
        confidence: z.number().min(0).max(1),
      }).optional(),
      riskFactors: z.array(z.object({
        factor: z.string(),
        impact: z.number().min(0).max(1),
        description: z.string(),
        mitigation: z.string().optional(),
      })).optional(),
      riskMitigationRecommendations: z.array(z.string()).optional(),
    })),
    summary: z.object({
      totalTrialsAssessed: z.number(),
      eligibleTrials: z.number(),
      potentiallyEligibleTrials: z.number(),
      ineligibleTrials: z.number(),
      requiresReviewTrials: z.number(),
      averageMatchScore: z.number(),
      topRecommendations: z.array(z.string()).default([]),
      safetyConcerns: z.array(z.string()).default([]),
    }),
    metadata: z.object({
      executionTimeMs: z.number(),
      drugInteractionChecks: z.number(),
      eligibilityCriteriaEvaluated: z.number(),
    }),
  }),
});

export const ClinicalReportSchema = z.object({
  patient_summary: z.string(),
  eligible_trials: z.array(z.object({
    nct_id: z.string(),
    title: z.string(),
    match_score: z.number(),
    eligibility_reasoning: z.string(),
    literature_support: z.array(z.string()).default([]),
    contact_information: z.object({
      central_contact: z.string().optional(),
      overall_official: z.string().optional(),
      locations: z.array(z.string()).default([]),
    }),
    next_steps: z.array(z.string()).default([]),
    // Dropout risk assessment data
    dropoutRisk: z.object({
      overallRisk: z.number().min(0).max(1),
      riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']),
      confidence: z.number().min(0).max(1),
    }).optional(),
    riskFactors: z.array(z.object({
      factor: z.string(),
      impact: z.number().min(0).max(1),
      description: z.string(),
      mitigation: z.string().optional(),
    })).optional(),
    riskMitigationRecommendations: z.array(z.string()).optional(),
  })),
  ineligible_trials: z.array(z.object({
    nct_id: z.string(),
    title: z.string(),
    exclusion_reason: z.string(),
    alternative_recommendations: z.array(z.string()).default([]),
  })),
  recommendations: z.string(),
  literature_support: z.array(z.string()),
  safety_flags: z.array(z.string()).default([]),
  // Dropout risk summary
  dropoutRiskSummary: z.object({
    overallRiskLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']),
    highestRiskTrial: z.string().optional(),
    riskMitigationStrategies: z.array(z.string()),
    averageDropoutRisk: z.number().min(0).max(1).optional(),
  }).optional(),
  workflow_metadata: z.object({
    execution_time_ms: z.number(),
    agents_activated: z.array(z.string()),
    api_calls_made: z.number(),
    confidence_score: z.number().min(0).max(1),
    dropout_assessments_completed: z.number().optional(),
  }),
});

export type LabValues = z.infer<typeof LabValuesSchema>;
export type StructuredPatientProfile = z.infer<typeof StructuredPatientProfileSchema>;
export type SummarizationInput = z.infer<typeof SummarizationInputSchema>;
export type ClinicalReport = z.infer<typeof ClinicalReportSchema>;

export const reportGeneratorTool = createTool({
  id: 'generate-clinical-report',
  description: 'Generate structured clinical report from agent outputs with human-in-the-loop support',
  inputSchema: SummarizationInputSchema,
  outputSchema: ClinicalReportSchema,
  execute: async ({ context }) => {
    return await generateClinicalReport(context);
  },
});

export async function generateClinicalReport(input: SummarizationInput): Promise<ClinicalReport> {
  const { patientProfile, trialScoutResults, eligibilityResults } = input;
  
  // Validate required inputs
  if (!patientProfile) {
    throw new Error('Patient profile is required for clinical report generation');
  }
  
  if (!trialScoutResults) {
    throw new Error('Trial scout results are required for clinical report generation');
  }
  
  if (!eligibilityResults) {
    throw new Error('Eligibility results are required for clinical report generation');
  }
  
  if (!eligibilityResults.eligibilityAssessments) {
    throw new Error('Eligibility assessments are required for clinical report generation');
  }
  
  const patientAgeDisplay = typeof patientProfile.age === "number"
    ? `${patientProfile.age} years`
    : "Not specified";
  
  // Generate patient summary
  const labValueEntries = patientProfile.labValues
    ? Object.entries(patientProfile.labValues).filter(([, value]) => value !== undefined)
    : [];

  const patientSummary = `
Patient Profile Summary:
- Age: ${patientAgeDisplay}
- Primary Diagnosis: ${patientProfile.diagnosis}${patientProfile.diagnosisCode ? ` (${patientProfile.diagnosisCode})` : ''}
- Current Medications: ${(patientProfile.medications ?? []).join(', ') || 'None'}
- Key Lab Values: ${labValueEntries
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ') || 'None available'}
- Comorbidities: ${(patientProfile.comorbidities ?? []).join(', ') || 'None'}
- Location: ${patientProfile.location || 'Not specified'}
- Performance Status: ${patientProfile.performanceStatus || 'Not specified'}
- Biomarkers: ${(patientProfile.biomarkers ?? []).join(', ') || 'None'}
- Prior Treatments: ${(patientProfile.priorTreatments ?? []).join(', ') || 'None'}
  `.trim();

  // Process eligible trials
  const eligibleTrials = (eligibilityResults.eligibilityAssessments || [])
    .filter(assessment => assessment.eligibilityStatus === "ELIGIBLE")
    .map(assessment => {
      const trial = (trialScoutResults.candidateTrials || []).find(t => t.nctId === assessment.nctId);
      return {
        nct_id: assessment.nctId,
        title: assessment.title || trial?.title || 'Unknown Trial',
        match_score: assessment.matchScore,
        eligibility_reasoning: assessment.reasoning,
        literature_support: trial?.literatureSupport.map(lit => lit.title) || [],
        contact_information: {
          central_contact: trial?.contacts?.centralContact,
          overall_official: trial?.contacts?.overallOfficial,
          locations: trial?.locations?.map(loc => {
            const parts = [];
            if (loc.facility) parts.push(loc.facility);
            if (loc.city) parts.push(loc.city);
            if (loc.state) parts.push(loc.state);
            if (loc.country) parts.push(loc.country);
            return parts.length > 0 ? parts.join(', ') : 'Location not specified';
          }).filter(loc => loc !== 'Location not specified') || [],
        },
        next_steps: assessment.recommendations,
        // Include dropout risk data if available
        dropoutRisk: assessment.dropoutRisk,
        riskFactors: assessment.riskFactors,
        riskMitigationRecommendations: assessment.riskMitigationRecommendations,
      };
    });

  // Process ineligible trials
  const ineligibleTrials = (eligibilityResults.eligibilityAssessments || [])
    .filter(assessment => assessment.eligibilityStatus === "INELIGIBLE")
    .map(assessment => {
      const trial = (trialScoutResults.candidateTrials || []).find(t => t.nctId === assessment.nctId);
      return {
        nct_id: assessment.nctId,
        title: assessment.title || trial?.title || 'Unknown Trial',
        exclusion_reason: assessment.exclusionConflicts.join('; ') || 'Eligibility criteria not met',
        alternative_recommendations: assessment.recommendations,
      };
    });

  // Generate dropout risk summary first
  const dropoutRiskSummary = eligibleTrials.length > 0 ? (() => {
    const trialsWithRisk = eligibleTrials.filter(trial => trial.dropoutRisk);
    if (trialsWithRisk.length === 0) return undefined;
    
    const riskLevels = trialsWithRisk.map(trial => trial.dropoutRisk!.riskLevel);
    const riskScores = trialsWithRisk.map(trial => trial.dropoutRisk!.overallRisk);
    
    const overallRiskLevel = riskLevels.includes('VERY_HIGH') ? 'VERY_HIGH' :
                            riskLevels.includes('HIGH') ? 'HIGH' :
                            riskLevels.includes('MODERATE') ? 'MODERATE' : 'LOW';
    
    const highestRiskTrial = trialsWithRisk.reduce((highest, current) => 
      current.dropoutRisk!.overallRisk > highest.dropoutRisk!.overallRisk ? current : highest
    );
    
    const averageDropoutRisk = riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length;
    
    const riskMitigationStrategies = [
      'Implement enhanced patient support services',
      'Provide comprehensive trial education',
      'Arrange transportation assistance if needed',
      'Coordinate with primary care providers',
      'Implement frequent check-ins and monitoring',
    ];
    
    return {
      overallRiskLevel,
      highestRiskTrial: highestRiskTrial.nct_id,
      riskMitigationStrategies,
      averageDropoutRisk,
    };
  })() : undefined;

  // Generate recommendations
  const recommendations = `
Based on the comprehensive analysis, ${eligibleTrials.length} clinical trials were identified as eligible for this patient.

Top Recommendations:
${eligibleTrials.slice(0, 3).map((trial, index) => {
  const dropoutInfo = trial.dropoutRisk ? 
    ` - Dropout Risk: ${trial.dropoutRisk.riskLevel} (${(trial.dropoutRisk.overallRisk * 100).toFixed(1)}%)` : 
    '';
  return `${index + 1}. ${trial.title} (NCT: ${trial.nct_id}) - Match Score: ${(trial.match_score * 100).toFixed(1)}%${dropoutInfo}`;
}).join('\n')}

${eligibleTrials.length > 0 ? `
The patient appears to be a good candidate for clinical trial participation. Key factors supporting eligibility include:
- Age-appropriate for identified trials
- Diagnosis matches trial inclusion criteria
- No major exclusion criteria conflicts identified
- Available trial locations accessible to patient

${dropoutRiskSummary ? `
Dropout Risk Assessment:
- Overall Risk Level: ${dropoutRiskSummary.overallRiskLevel}
- Average Dropout Risk: ${(dropoutRiskSummary.averageDropoutRisk * 100).toFixed(1)}%
- Highest Risk Trial: ${dropoutRiskSummary.highestRiskTrial}

Risk Mitigation Strategies:
${dropoutRiskSummary.riskMitigationStrategies.map(strategy => `- ${strategy}`).join('\n')}
` : ''}
` : `
No immediately eligible trials were identified. Consider:
- Expanding search criteria to include broader conditions
- Evaluating potentially eligible trials that may require additional screening
- Consulting with trial coordinators for eligibility clarification
`}

Next Steps:
1. Review detailed eligibility assessments for each trial
2. Contact trial coordinators for enrollment information
3. Schedule additional screening if required
4. Consider patient preferences and logistics
${dropoutRiskSummary ? '5. Implement dropout risk mitigation strategies for high-risk trials' : ''}
  `.trim();

  // Collect literature support
  const literatureSupport = (trialScoutResults.candidateTrials || [])
    .flatMap(trial => trial.literatureSupport || [])
    .map(lit => `${lit.title} (${lit.journal || 'Unknown Journal'}, ${lit.publicationDate || 'Unknown Date'})`)
    .slice(0, 10); // Limit to top 10

  // Collect safety flags
  const safetyFlags = (eligibilityResults.eligibilityAssessments || [])
    .flatMap(assessment => assessment.safetyFlags || [])
    .filter((flag, index, array) => array.indexOf(flag) === index); // Remove duplicates

  // Calculate workflow metadata
  const totalExecutionTime = (trialScoutResults.searchMetadata?.executionTimeMs || 0) + 
                            (eligibilityResults.metadata?.executionTimeMs || 0);
  const totalApiCalls = (trialScoutResults.searchMetadata?.apiCalls?.clinicalTrials || 0) + 
                       (trialScoutResults.searchMetadata?.apiCalls?.pubmed || 0) +
                       (eligibilityResults.metadata?.drugInteractionChecks || 0);
  const confidenceScore = eligibleTrials.length > 0 ? 
    eligibleTrials.reduce((sum, trial) => sum + trial.match_score, 0) / eligibleTrials.length : 0;

  return ClinicalReportSchema.parse({
    patient_summary: patientSummary,
    eligible_trials: eligibleTrials,
    ineligible_trials: ineligibleTrials,
    recommendations,
    literature_support: literatureSupport,
    safety_flags: safetyFlags,
    dropoutRiskSummary,
    workflow_metadata: {
      execution_time_ms: totalExecutionTime,
      agents_activated: ["EMR_Analysis_Agent", "Trial_Scout_Agent", "Eligibility_Screener_Agent", "Summarization_Agent"],
      api_calls_made: totalApiCalls,
      confidence_score: confidenceScore,
      dropout_assessments_completed: eligibleTrials.filter(trial => trial.dropoutRisk).length,
    },
  });
}
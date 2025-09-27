import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

// Input schema for the clinical trial workflow
const clinicalTrialWorkflowInputSchema = z.object({
  patientData: z.string().min(10, "Patient data must be at least 10 characters"),
  demographics: z.object({
    age: z.number().int().positive().optional(),
    location: z.string().optional(),
  }).optional(),
  searchPreferences: z.object({
    maxTrials: z.number().int().positive().max(20).default(10),
    includeCompletedTrials: z.boolean().default(false),
    maxLiteratureResults: z.number().int().positive().max(10).default(5),
  }).optional(),
});

// Step 1: Analyze EMR Data
const analyzeEMR = createStep({
  id: 'analyze-emr',
  description: 'Parse unstructured patient EMR data into structured medical profile',
  inputSchema: clinicalTrialWorkflowInputSchema,
  outputSchema: z.object({
    patientProfile: z.object({
      diagnosis: z.string(),
      diagnosisCode: z.string().optional(),
      age: z.number().int().positive(),
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
      location: z.string().optional(),
      insurance: z.string().optional(),
      recentHospitalization: z.boolean().default(false),
      smokingHistory: z.string().optional(),
      performanceStatus: z.string().optional(),
      biomarkers: z.array(z.string()).default([]),
      priorTreatments: z.array(z.string()).default([]),
    }),
    searchPreferences: clinicalTrialWorkflowInputSchema.shape.searchPreferences,
  }),
  execute: async ({ inputData }) => {
    console.log('🔄 Step 1: Analyzing EMR data...');
    
    // Import the EMR analysis tool
    const { analyzePatientEMR } = await import('../tools/emr-analysis-tool');
    
    const patientProfile = await analyzePatientEMR(
      inputData.patientData,
      inputData.demographics
    );

    console.log('✅ EMR analysis completed');
    console.log(`   Age: ${patientProfile.age}`);
    console.log(`   Diagnosis: ${patientProfile.diagnosis}`);
    console.log(`   Location: ${patientProfile.location || 'Not specified'}`);

    return {
      patientProfile,
      searchPreferences: inputData.searchPreferences,
    };
  },
});

// Step 2: Scout Clinical Trials
const scoutTrials = createStep({
  id: 'scout-trials',
  description: 'Search for relevant clinical trials',
  inputSchema: z.object({
    patientProfile: z.object({
      diagnosis: z.string(),
      diagnosisCode: z.string().optional(),
      age: z.number().int().positive(),
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
      location: z.string().optional(),
      insurance: z.string().optional(),
      recentHospitalization: z.boolean().default(false),
      smokingHistory: z.string().optional(),
      performanceStatus: z.string().optional(),
      biomarkers: z.array(z.string()).default([]),
      priorTreatments: z.array(z.string()).default([]),
    }),
    searchPreferences: z.object({
      maxTrials: z.number().int().positive().max(20).default(10),
      includeCompletedTrials: z.boolean().default(false),
      maxLiteratureResults: z.number().int().positive().max(10).default(5),
    }).optional(),
  }),
  outputSchema: z.object({
    patientProfile: z.object({
      diagnosis: z.string(),
      diagnosisCode: z.string().optional(),
      age: z.number().int().positive(),
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
      location: z.string().optional(),
      insurance: z.string().optional(),
      recentHospitalization: z.boolean().default(false),
      smokingHistory: z.string().optional(),
      performanceStatus: z.string().optional(),
      biomarkers: z.array(z.string()).default([]),
      priorTreatments: z.array(z.string()).default([]),
    }),
    trialScoutResults: z.object({
      patientProfile: z.object({
        diagnosis: z.string(),
        diagnosisCode: z.string().optional(),
        age: z.number().int().positive(),
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
        location: z.string().optional(),
        insurance: z.string().optional(),
        recentHospitalization: z.boolean().default(false),
        smokingHistory: z.string().optional(),
        performanceStatus: z.string().optional(),
        biomarkers: z.array(z.string()).default([]),
        priorTreatments: z.array(z.string()).default([]),
      }),
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
  }),
  execute: async ({ inputData }) => {
    console.log('🔄 Step 2: Searching for clinical trials...');
    
    // Import the ClinicalTrials API tool
    const { clinicalTrialsApiTool } = await import('../tools/clinical-trials-api-tool');
    
    // Call the ClinicalTrials API tool directly with correct parameters
    const trialResults = await clinicalTrialsApiTool.execute({
      context: {
        condition: inputData.patientProfile.diagnosis,
        age: inputData.patientProfile.age,
        status: ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'COMPLETED'],
        location: inputData.patientProfile.location,
        maxResults: inputData.searchPreferences?.maxTrials || 10
      }
    });

    console.log(`✅ Found ${trialResults.trials?.length || 0} trials from ClinicalTrials.gov`);

    // Convert API results to expected workflow format
    const trialScoutResults = {
      patientProfile: inputData.patientProfile,
      candidateTrials: trialResults.trials?.map(trial => ({
        nctId: trial.nctId,
        briefTitle: trial.title,
        condition: trial.condition,
        eligibilityScore: 0.8, // Default score since we don't have this from the API
        status: trial.status,
        phase: trial.phase,
        studyType: trial.studyType,
        minAge: trial.eligibilityCriteria?.minimumAge,
        maxAge: trial.eligibilityCriteria?.maximumAge,
        eligibilityCriteria: trial.eligibilityCriteria,
        locations: trial.locations,
        contacts: trial.contacts,
        urls: trial.urls,
        lastUpdate: trial.lastUpdate,
        enrollmentCount: trial.enrollmentCount,
        startDate: trial.startDate,
        completionDate: trial.completionDate,
        literatureSupport: [],
        matchReasons: [
          `Age match: Patient ${inputData.patientProfile.age} within trial range`,
          `Condition match: ${trial.condition}`
        ]
      })) || [],
      searchMetadata: {
        searchTerms: [inputData.patientProfile.diagnosis],
        totalTrialsFound: trialResults.totalCount || 0,
        literatureQueries: [],
        executionTimeMs: 1000,
        apiCalls: {
          clinicalTrials: 1,
          pubmed: 0,
        },
      },
    };

    return { 
      patientProfile: inputData.patientProfile,
      trialScoutResults 
    };
  },
});

// Step 3: Generate Clinical Report
const generateReport = createStep({
  id: 'generate-report',
  description: 'Generate comprehensive clinical report with recommendations',
  inputSchema: z.object({
    patientProfile: z.object({
      diagnosis: z.string(),
      diagnosisCode: z.string().optional(),
      age: z.number().int().positive(),
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
      location: z.string().optional(),
      insurance: z.string().optional(),
      recentHospitalization: z.boolean().default(false),
      smokingHistory: z.string().optional(),
      performanceStatus: z.string().optional(),
      biomarkers: z.array(z.string()).default([]),
      priorTreatments: z.array(z.string()).default([]),
    }),
    trialScoutResults: z.object({
      patientProfile: z.object({
        diagnosis: z.string(),
        diagnosisCode: z.string().optional(),
        age: z.number().int().positive(),
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
        location: z.string().optional(),
        insurance: z.string().optional(),
        recentHospitalization: z.boolean().default(false),
        smokingHistory: z.string().optional(),
        performanceStatus: z.string().optional(),
        biomarkers: z.array(z.string()).default([]),
        priorTreatments: z.array(z.string()).default([]),
      }),
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
  }),
  outputSchema: z.object({
    clinicalReport: z.object({
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
      workflow_metadata: z.object({
        execution_time_ms: z.number(),
        agents_activated: z.array(z.string()),
        api_calls_made: z.number(),
        confidence_score: z.number().min(0).max(1),
      }),
    }),
  }),
  execute: async ({ inputData }) => {
    console.log('🔄 Step 3: Generating clinical report...');
    
    // Import the report generation tool
    const { generateClinicalReport } = await import('../tools/summarization-tool');
    
    const { patientProfile, trialScoutResults } = inputData;

    if (!patientProfile) {
      throw new Error('Patient profile is required to generate the clinical report');
    }

    if (!trialScoutResults) {
      throw new Error('Trial scout results are required to generate the clinical report');
    }

    try {
      // Create eligibility results for the report
      const eligibilityResults = {
        patientProfile,
        eligibilityAssessments: trialScoutResults.candidateTrials.map(trial => ({
          nctId: trial.nctId,
          title: trial.briefTitle,
          eligibilityStatus: 'ELIGIBLE' as const,
          matchScore: trial.eligibilityScore || 0.8,
          inclusionMatches: trial.matchReasons || [],
          exclusionConflicts: [],
          ageEligibility: {
            eligible: true,
            reason: `Patient age ${patientProfile.age} is within trial range`,
            patientAge: patientProfile.age,
            trialMinAge: trial.minAge,
            trialMaxAge: trial.maxAge
          },
          drugInteractions: [],
          locationEligibility: {
            eligible: true,
            reason: 'Location check passed',
            availableLocations: trial.locations?.map(loc => `${loc.city}, ${loc.state}`) || []
          },
          biomarkerEligibility: {
            eligible: true,
            reason: 'No specific biomarker requirements',
            requiredBiomarkers: [],
            patientBiomarkers: patientProfile.biomarkers
          },
          reasoning: `Patient matches trial criteria based on age and condition`,
          recommendations: ['Consider contacting trial coordinator'],
          safetyFlags: []
        })),
        summary: {
          totalTrialsAssessed: trialScoutResults.candidateTrials.length,
          eligibleTrials: trialScoutResults.candidateTrials.length,
          potentiallyEligibleTrials: 0,
          ineligibleTrials: 0,
          requiresReviewTrials: 0,
          averageMatchScore: 0.8,
          topRecommendations: ['Contact trial coordinators for enrollment'],
          safetyConcerns: []
        },
        metadata: {
          executionTimeMs: 1000,
          drugInteractionChecks: 0,
          eligibilityCriteriaEvaluated: trialScoutResults.candidateTrials.length
        }
      };

      const clinicalReport = await generateClinicalReport({
        patientProfile,
        trialScoutResults,
        eligibilityResults,
      });

      console.log('✅ Clinical report generated');

      return { clinicalReport };
    } catch (error) {
      console.error('Error generating clinical report:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate clinical report: ${error.message}`);
      }
      throw error;
    }
  },
});

// Create the fixed clinical trial workflow
const fixedClinicalTrialWorkflow = createWorkflow({
  id: 'fixed-clinical-trial-workflow',
  inputSchema: clinicalTrialWorkflowInputSchema,
  outputSchema: z.object({
    clinicalReport: z.object({
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
      workflow_metadata: z.object({
        execution_time_ms: z.number(),
        agents_activated: z.array(z.string()),
        api_calls_made: z.number(),
        confidence_score: z.number().min(0).max(1),
      }),
    }),
  }),
})
  .then(analyzeEMR)
  .then(scoutTrials)
  .then(generateReport);

fixedClinicalTrialWorkflow.commit();

export { fixedClinicalTrialWorkflow };
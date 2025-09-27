import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { emrAgent } from '../agents/emr-agent';
import { trialScoutAgent } from '../agents/trial-scout-agent';
import { eligibilityScreenerAgent } from '../agents/eligibility-screener-agent';
import { summarizationAgent } from '../agents/summarization-agent';

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
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('emrAgent');
    if (!agent) {
      throw new Error('EMR agent not found');
    }

    const prompt = `Please analyze the following patient EMR data and extract structured information:

Patient Data: ${inputData.patientData}
Demographics: ${JSON.stringify(inputData.demographics || {}, null, 2)}

Please use the emrAnalysisTool to parse this data into a structured patient profile.`;

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let resultText = '';
    for await (const chunk of response.textStream) {
      resultText += chunk;
    }

    // Parse the result (in a real implementation, this would be structured)
    const patientProfile = {
      diagnosis: 'Type 2 Diabetes Mellitus', // Mock data for development
      diagnosisCode: 'E11',
      age: inputData.demographics?.age || 55,
      medications: ['metformin', 'insulin'],
      labValues: {
        hba1c: 8.2,
        egfr: 75,
        creatinine: 1.1,
        glucose: 180,
        bloodPressure: {
          systolic: 140,
          diastolic: 90,
        },
      },
      comorbidities: ['hypertension', 'obesity'],
      location: inputData.demographics?.location || 'New York, NY',
      insurance: 'Medicare',
      recentHospitalization: false,
      smokingHistory: 'Former smoker',
      performanceStatus: 'ECOG 0',
      biomarkers: [],
      priorTreatments: [],
    };

    return { patientProfile };
  },
});

// Step 2: Scout Clinical Trials
const scoutTrials = createStep({
  id: 'scout-trials',
  description: 'Search for relevant clinical trials and supporting literature',
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
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('trialScoutAgent');
    if (!agent) {
      throw new Error('Trial Scout agent not found');
    }

    const prompt = `Please search for clinical trials relevant to this patient profile:

Patient Profile: ${JSON.stringify(inputData.patientProfile, null, 2)}
Search Preferences: ${JSON.stringify(inputData.searchPreferences || {}, null, 2)}

Please use the clinicalTrialsApiTool and pubmedApiTool to find relevant trials and supporting literature.`;

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let resultText = '';
    for await (const chunk of response.textStream) {
      resultText += chunk;
    }

    // Mock trial scout results for development
    const trialScoutResults = {
      patientProfile: inputData.patientProfile,
      candidateTrials: [
        {
          nctId: 'NCT00000001',
          title: 'Efficacy of New Diabetes Medication',
          status: 'RECRUITING',
          phase: 'Phase 2',
          studyType: 'Interventional',
          condition: 'Type 2 Diabetes Mellitus',
          intervention: 'New Diabetes Drug',
          eligibilityCriteria: {
            inclusionCriteria: ['Adults 18-75 years', 'HbA1c 7.0-10.5%', 'On stable metformin'],
            exclusionCriteria: ['Pregnancy', 'Severe renal impairment', 'Active malignancy'],
            minimumAge: '18',
            maximumAge: '75',
            gender: 'All',
          },
          locations: [
            {
              facility: 'Medical Center',
              city: 'New York',
              state: 'NY',
              country: 'United States',
              status: 'Recruiting',
              contacts: [],
            },
          ],
          contacts: {
            centralContact: 'Dr. Smith',
            overallOfficial: 'Dr. Johnson',
          },
          urls: {
            clinicalTrialsGov: 'https://clinicaltrials.gov/study/NCT00000001',
          },
          lastUpdate: '2024-01-01',
          enrollmentCount: 100,
          startDate: '2024-01-01',
          completionDate: '2025-12-31',
          literatureSupport: [
            {
              pmid: '12345678',
              title: 'New Diabetes Treatment Approaches',
              authors: ['Dr. Smith', 'Dr. Johnson'],
              journal: 'Diabetes Research Journal',
              publicationDate: '2024-01-01',
              url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
              relevanceScore: 0.9,
            },
          ],
          matchReasons: ['Condition match', 'Age eligible', 'Location available'],
        },
      ],
      searchMetadata: {
        searchTerms: ['Type 2 Diabetes Mellitus', 'E11', 'hypertension', 'obesity'],
        totalTrialsFound: 1,
        literatureQueries: ['New Diabetes Drug Type 2 Diabetes Mellitus'],
        executionTimeMs: 1500,
        apiCalls: {
          clinicalTrials: 1,
          pubmed: 1,
        },
      },
    };

    return { trialScoutResults };
  },
});

// Step 3: Screen Eligibility
const screenEligibility = createStep({
  id: 'screen-eligibility',
  description: 'Assess patient eligibility for identified clinical trials',
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
  }),
  outputSchema: z.object({
    eligibilityResults: z.object({
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
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('eligibilityScreenerAgent');
    if (!agent) {
      throw new Error('Eligibility Screener agent not found');
    }

    const prompt = `Please assess the eligibility of this patient for the following clinical trials:

Patient Profile: ${JSON.stringify(inputData.patientProfile, null, 2)}
Candidate Trials: ${JSON.stringify(inputData.candidateTrials, null, 2)}

Please use the vectorQueryTool and openFdaDrugSafetyTool to assess eligibility and check for drug interactions.`;

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let resultText = '';
    for await (const chunk of response.textStream) {
      resultText += chunk;
    }

    // Mock eligibility results for development
    const eligibilityResults = {
      patientProfile: inputData.patientProfile,
      eligibilityAssessments: [
        {
          nctId: 'NCT00000001',
          title: 'Efficacy of New Diabetes Medication',
          eligibilityStatus: 'ELIGIBLE' as const,
          matchScore: 0.85,
          inclusionMatches: ['Age eligible (55 years)', 'HbA1c within range (8.2%)', 'On metformin'],
          exclusionConflicts: [],
          ageEligibility: {
            eligible: true,
            reason: 'Patient age 55 falls within trial range 18-75',
            patientAge: 55,
            trialMinAge: '18',
            trialMaxAge: '75',
          },
          drugInteractions: [],
          locationEligibility: {
            eligible: true,
            reason: 'Patient location New York, NY matches trial locations',
            availableLocations: ['New York, NY'],
          },
          biomarkerEligibility: {
            eligible: true,
            reason: 'No specific biomarkers required',
            requiredBiomarkers: [],
            patientBiomarkers: [],
          },
          reasoning: 'Patient meets all inclusion criteria and has no exclusion conflicts',
          recommendations: ['Patient appears eligible for this trial', 'Contact trial coordinator for enrollment'],
          safetyFlags: [],
        },
      ],
      summary: {
        totalTrialsAssessed: 1,
        eligibleTrials: 1,
        potentiallyEligibleTrials: 0,
        ineligibleTrials: 0,
        requiresReviewTrials: 0,
        averageMatchScore: 0.85,
        topRecommendations: ['NCT00000001'],
        safetyConcerns: [],
      },
      metadata: {
        executionTimeMs: 800,
        drugInteractionChecks: 1,
        eligibilityCriteriaEvaluated: 1,
      },
    };

    return { eligibilityResults };
  },
});

// Step 4: Generate Clinical Report
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
    eligibilityResults: z.object({
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
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('summarizationAgent');
    if (!agent) {
      throw new Error('Summarization agent not found');
    }

    const prompt = `Please generate a comprehensive clinical report based on the following analysis:

Patient Profile: ${JSON.stringify(inputData.patientProfile, null, 2)}
Trial Scout Results: ${JSON.stringify(inputData.trialScoutResults, null, 2)}
Eligibility Results: ${JSON.stringify(inputData.eligibilityResults, null, 2)}

Please use the reportGeneratorTool to create a structured clinical report with recommendations.`;

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let resultText = '';
    for await (const chunk of response.textStream) {
      resultText += chunk;
    }

    // Mock clinical report for development
    const clinicalReport = {
      patient_summary: `Patient Profile Summary:
- Age: ${inputData.patientProfile.age} years
- Primary Diagnosis: ${inputData.patientProfile.diagnosis}${inputData.patientProfile.diagnosisCode ? ` (${inputData.patientProfile.diagnosisCode})` : ''}
- Current Medications: ${inputData.patientProfile.medications.join(', ') || 'None'}
- Key Lab Values: HbA1c: ${inputData.patientProfile.labValues.hba1c}, eGFR: ${inputData.patientProfile.labValues.egfr}
- Comorbidities: ${inputData.patientProfile.comorbidities.join(', ') || 'None'}
- Location: ${inputData.patientProfile.location || 'Not specified'}`,
      eligible_trials: [
        {
          nct_id: 'NCT00000001',
          title: 'Efficacy of New Diabetes Medication',
          match_score: 0.85,
          eligibility_reasoning: 'Patient meets all inclusion criteria and has no exclusion conflicts',
          literature_support: ['New Diabetes Treatment Approaches (Diabetes Research Journal, 2024-01-01)'],
          contact_information: {
            central_contact: 'Dr. Smith',
            overall_official: 'Dr. Johnson',
            locations: ['New York, NY'],
          },
          next_steps: ['Contact trial coordinator for enrollment', 'Schedule screening visit'],
        },
      ],
      ineligible_trials: [],
      recommendations: `Based on the comprehensive analysis, 1 clinical trial was identified as eligible for this patient.

Top Recommendations:
1. Efficacy of New Diabetes Medication (NCT: NCT00000001) - Match Score: 85.0%

The patient appears to be a good candidate for clinical trial participation. Key factors supporting eligibility include:
- Age-appropriate for identified trials
- Diagnosis matches trial inclusion criteria
- No major exclusion criteria conflicts identified
- Available trial locations accessible to patient

Next Steps:
1. Review detailed eligibility assessments for each trial
2. Contact trial coordinators for enrollment information
3. Schedule additional screening if required
4. Consider patient preferences and logistics`,
      literature_support: ['New Diabetes Treatment Approaches (Diabetes Research Journal, 2024-01-01)'],
      safety_flags: [],
      workflow_metadata: {
        execution_time_ms: 2300,
        agents_activated: ['EMR_Analysis_Agent', 'Trial_Scout_Agent', 'Eligibility_Screener_Agent', 'Summarization_Agent'],
        api_calls_made: 3,
        confidence_score: 0.85,
      },
    };

    return { clinicalReport };
  },
});

// Create the clinical trial workflow
const clinicalTrialWorkflow = createWorkflow({
  id: 'clinical-trial-workflow',
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
  .then(screenEligibility)
  .then(generateReport);

clinicalTrialWorkflow.commit();

export { clinicalTrialWorkflow };
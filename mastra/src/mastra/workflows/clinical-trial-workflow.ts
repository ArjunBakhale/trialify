import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { trialScoutAgent } from '../agents/trial-scout-agent';
import { eligibilityScreenerAgent } from '../agents/eligibility-screener-agent';
import { analyzePatientEMR } from '../tools/emr-analysis-tool';
import { generateClinicalReport } from '../tools/summarization-tool';

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
    const patientProfile = await analyzePatientEMR(
      inputData.patientData,
      inputData.demographics
    );

    return {
      patientProfile,
      searchPreferences: inputData.searchPreferences,
    };
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

    // Parse the agent response to extract trial data
    // The agent should return structured data that we can parse
    let trialScoutResults;
    try {
      // Try to parse JSON response from agent
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        trialScoutResults = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, create a basic structure from the text response
        trialScoutResults = {
          patientProfile: inputData.patientProfile,
          candidateTrials: [],
          searchMetadata: {
            searchTerms: [inputData.patientProfile.diagnosis],
            totalTrialsFound: 0,
            literatureQueries: [],
            executionTimeMs: 1500,
            apiCalls: {
              clinicalTrials: 0,
              pubmed: 0,
            },
          },
        };
        console.log("⚠️ Agent response could not be parsed as JSON, using empty results");
      }
    } catch (error) {
      console.error("❌ Failed to parse agent response:", error);
      // Fallback to empty results
      trialScoutResults = {
        patientProfile: inputData.patientProfile,
        candidateTrials: [],
        searchMetadata: {
          searchTerms: [inputData.patientProfile.diagnosis],
          totalTrialsFound: 0,
          literatureQueries: [],
          executionTimeMs: 1500,
          apiCalls: {
            clinicalTrials: 0,
            pubmed: 0,
          },
        },
      };
    }

    return { 
      patientProfile: inputData.patientProfile,
      trialScoutResults 
    };
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
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('eligibilityScreenerAgent');
    if (!agent) {
      throw new Error('Eligibility Screener agent not found');
    }

    const prompt = `Please assess the eligibility of this patient for the following clinical trials:

Patient Profile: ${JSON.stringify(inputData.patientProfile, null, 2)}
Candidate Trials: ${JSON.stringify(inputData.trialScoutResults.candidateTrials, null, 2)}

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

    // Parse the agent response to extract eligibility data
    let eligibilityResults;
    try {
      // Try to parse JSON response from agent
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        eligibilityResults = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, create a basic structure from the text response
        eligibilityResults = {
          patientProfile: inputData.patientProfile,
          eligibilityAssessments: [],
          summary: {
            totalTrialsAssessed: inputData.trialScoutResults.candidateTrials.length,
            eligibleTrials: 0,
            potentiallyEligibleTrials: 0,
            ineligibleTrials: 0,
            requiresReviewTrials: 0,
            averageMatchScore: 0,
            topRecommendations: [],
            safetyConcerns: [],
          },
          metadata: {
            executionTimeMs: 800,
            drugInteractionChecks: 0,
            eligibilityCriteriaEvaluated: 0,
          },
        };
        console.log("⚠️ Agent response could not be parsed as JSON, using empty results");
      }
    } catch (error) {
      console.error("❌ Failed to parse agent response:", error);
      // Fallback to empty results
      eligibilityResults = {
        patientProfile: inputData.patientProfile,
        eligibilityAssessments: [],
        summary: {
          totalTrialsAssessed: inputData.trialScoutResults.candidateTrials.length,
          eligibleTrials: 0,
          potentiallyEligibleTrials: 0,
          ineligibleTrials: 0,
          requiresReviewTrials: 0,
          averageMatchScore: 0,
          topRecommendations: [],
          safetyConcerns: [],
        },
        metadata: {
          executionTimeMs: 800,
          drugInteractionChecks: 0,
          eligibilityCriteriaEvaluated: 0,
        },
      };
    }

    return { 
      patientProfile: inputData.patientProfile,
      trialScoutResults: inputData.trialScoutResults,
      eligibilityResults 
    };
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
  execute: async ({ inputData }) => {
    const { patientProfile, trialScoutResults, eligibilityResults } = inputData;

    if (!patientProfile) {
      throw new Error('Patient profile is required to generate the clinical report');
    }

    if (!trialScoutResults) {
      throw new Error('Trial scout results are required to generate the clinical report');
    }

    if (!eligibilityResults) {
      throw new Error('Eligibility results are required to generate the clinical report');
    }

    try {
      const clinicalReport = await generateClinicalReport({
        patientProfile,
        trialScoutResults,
        eligibilityResults,
      });

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
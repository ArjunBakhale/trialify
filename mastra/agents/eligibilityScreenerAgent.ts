import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { openFdaDrugSafetyTool } from "../tools/openFdaApi";
import { StructuredPatientProfileSchema, type StructuredPatientProfile } from "./emrAnalysisAgent";
import { TrialWithLiterature } from "./trialScoutAgent";

/**
 * Eligibility_Screener_Agent
 * 
 * Purpose: Perform RAG-powered semantic matching against trial eligibility criteria
 * Input: Patient profile + trial list
 * Output: Eligibility assessment with match scores and reasoning
 * RAG Integration: Vector store of trial inclusion/exclusion criteria
 * 
 * Design Principles:
 * - RAG-powered semantic matching for eligibility screening
 * - Agent Separation of Concerns: Owns eligibility assessment step
 * - Evidence-Driven Recommendations: Uses drug interaction checks
 * - Patient-Centric Accuracy: Maintains traceability of eligibility decisions
 */

// -----------------------------
// Input/Output Schemas
// -----------------------------
const EligibilityScreenerInputSchema = z.object({
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
  })),
});

const EligibilityAssessmentSchema = z.object({
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
});

const EligibilityScreenerResponseSchema = z.object({
  patientProfile: StructuredPatientProfileSchema,
  eligibilityAssessments: z.array(EligibilityAssessmentSchema),
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
});

export type EligibilityScreenerInput = z.infer<typeof EligibilityScreenerInputSchema>;
export type EligibilityScreenerResponse = z.infer<typeof EligibilityScreenerResponseSchema>;
export type EligibilityAssessment = z.infer<typeof EligibilityAssessmentSchema>;

// -----------------------------
// Eligibility Knowledge Base (RAG Data)
// -----------------------------
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

// -----------------------------
// Vector Query Tool for RAG
// -----------------------------
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
  execute: async (ctx: any) => {
    const { query, patientProfile, maxResults = 5 } = ctx.context as {
      query: string;
      patientProfile: StructuredPatientProfile;
      maxResults?: number;
    };
    
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

// -----------------------------
// Eligibility Screener Agent
// -----------------------------
export const eligibilityScreenerAgent = new Agent({
  name: "Eligibility_Screener_Agent",
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

Output requirements:
- Categorize trials as ELIGIBLE, POTENTIALLY_ELIGIBLE, INELIGIBLE, or REQUIRES_REVIEW
- Provide match scores (0-1) with detailed reasoning
- Include specific inclusion matches and exclusion conflicts
- Flag safety concerns and provide recommendations
- Include comprehensive metadata for downstream processing
`,
  model: openai('gpt-4o-mini'),
  tools: { vectorQueryTool, openFdaDrugSafetyTool },
});

/**
 * Utility function to run eligibility screening with error handling
 */
export async function screenEligibility(
  patientProfile: StructuredPatientProfile,
  candidateTrials: TrialWithLiterature[]
): Promise<EligibilityScreenerResponse> {
  try {
    console.log("🔍 Starting eligibility screening...");
    
    // For now, implement a basic eligibility screening logic
    // In production, this would use the agent with proper tool calling
    const eligibilityAssessments: EligibilityAssessment[] = [];
    
    for (const trial of candidateTrials) {
      // Basic eligibility assessment
      const ageEligibility = {
        ...parseAgeEligibility(
          patientProfile.age,
          trial.eligibilityCriteria.minimumAge,
          trial.eligibilityCriteria.maximumAge
        ),
        patientAge: patientProfile.age,
        trialMinAge: trial.eligibilityCriteria.minimumAge,
        trialMaxAge: trial.eligibilityCriteria.maximumAge,
      };
      
      const locationEligibility = checkLocationEligibility(
        patientProfile.location,
        trial.locations
      );
      
      // Simple matching logic
      const inclusionMatches: string[] = [];
      const exclusionConflicts: string[] = [];
      
      // Check medications
      const requiredMeds = trial.eligibilityCriteria.inclusionCriteria
        .filter(criteria => criteria.toLowerCase().includes('medication') || criteria.toLowerCase().includes('treatment'))
        .some(criteria => 
          patientProfile.medications.some(med => 
            criteria.toLowerCase().includes(med.toLowerCase())
          )
        );
      
      if (requiredMeds) {
        inclusionMatches.push("Required medications present");
      }
      
      // Check comorbidities
      const hasExclusions = trial.eligibilityCriteria.exclusionCriteria
        .some(criteria => 
          patientProfile.comorbidities.some(comorbidity => 
            criteria.toLowerCase().includes(comorbidity.toLowerCase())
          )
        );
      
      if (hasExclusions) {
        exclusionConflicts.push("Patient has excluded comorbidities");
      }
      
      // Calculate match score
      let matchScore = 0;
      if (ageEligibility.eligible) matchScore += 0.3;
      if (locationEligibility.eligible) matchScore += 0.2;
      if (requiredMeds) matchScore += 0.3;
      if (!hasExclusions) matchScore += 0.2;
      
      // Determine eligibility status
      let eligibilityStatus: "ELIGIBLE" | "POTENTIALLY_ELIGIBLE" | "INELIGIBLE" | "REQUIRES_REVIEW" = "REQUIRES_REVIEW";
      if (matchScore >= 0.8) {
        eligibilityStatus = "ELIGIBLE";
      } else if (matchScore >= 0.6) {
        eligibilityStatus = "POTENTIALLY_ELIGIBLE";
      } else if (matchScore < 0.4) {
        eligibilityStatus = "INELIGIBLE";
      }
      
      eligibilityAssessments.push({
        nctId: trial.nctId,
        title: trial.title,
        eligibilityStatus,
        matchScore,
        inclusionMatches,
        exclusionConflicts,
        ageEligibility,
        drugInteractions: [], // TODO: Implement drug interaction checking
        locationEligibility,
        biomarkerEligibility: {
          eligible: true, // TODO: Implement biomarker checking
          reason: "Biomarker checking not implemented",
          requiredBiomarkers: [],
          patientBiomarkers: patientProfile.biomarkers,
        },
        reasoning: `Match score: ${(matchScore * 100).toFixed(1)}% based on age, location, medications, and comorbidities`,
        recommendations: eligibilityStatus === "ELIGIBLE" ? 
          ["Patient appears eligible for this trial"] : 
          ["Further review recommended"],
        safetyFlags: hasExclusions ? ["Potential exclusion criteria match"] : [],
      });
    }
    
    const result: EligibilityScreenerResponse = {
      patientProfile,
      eligibilityAssessments,
      summary: {
        totalTrialsAssessed: candidateTrials.length,
        eligibleTrials: eligibilityAssessments.filter(a => a.eligibilityStatus === "ELIGIBLE").length,
        potentiallyEligibleTrials: eligibilityAssessments.filter(a => a.eligibilityStatus === "POTENTIALLY_ELIGIBLE").length,
        ineligibleTrials: eligibilityAssessments.filter(a => a.eligibilityStatus === "INELIGIBLE").length,
        requiresReviewTrials: eligibilityAssessments.filter(a => a.eligibilityStatus === "REQUIRES_REVIEW").length,
        averageMatchScore: eligibilityAssessments.reduce((sum, a) => sum + a.matchScore, 0) / eligibilityAssessments.length,
        topRecommendations: eligibilityAssessments
          .filter(a => a.eligibilityStatus === "ELIGIBLE")
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 3)
          .map(a => a.nctId),
        safetyConcerns: eligibilityAssessments
          .filter(a => a.safetyFlags.length > 0)
          .map(a => `${a.nctId}: ${a.safetyFlags.join(", ")}`),
      },
      metadata: {
        executionTimeMs: Date.now() - Date.now(), // TODO: Implement proper timing
        drugInteractionChecks: 0, // TODO: Implement drug interaction checking
        eligibilityCriteriaEvaluated: candidateTrials.length,
      },
    };

    console.log(`✅ Eligibility screening completed - assessed ${result.eligibilityAssessments.length} trials`);
    return result;
  } catch (error) {
    console.error("❌ Eligibility screening failed:", error);
    throw error;
  }
}

/**
 * Helper function to parse age eligibility from trial criteria
 */
export function parseAgeEligibility(
  patientAge: number,
  minAge?: string,
  maxAge?: string
): { eligible: boolean; reason: string } {
  if (!minAge && !maxAge) {
    return { eligible: true, reason: "No age restrictions specified" };
  }
  
  const parseAge = (ageStr: string): number => {
    const match = ageStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };
  
  const trialMinAge = minAge ? parseAge(minAge) : 0;
  const trialMaxAge = maxAge ? parseAge(maxAge) : 999;
  
  if (patientAge >= trialMinAge && patientAge <= trialMaxAge) {
    return { 
      eligible: true, 
      reason: `Patient age ${patientAge} falls within trial range ${trialMinAge}-${trialMaxAge}` 
    };
  } else {
    return { 
      eligible: false, 
      reason: `Patient age ${patientAge} outside trial range ${trialMinAge}-${trialMaxAge}` 
    };
  }
}

/**
 * Helper function to check location eligibility
 */
export function checkLocationEligibility(
  patientLocation: string | undefined,
  trialLocations: Array<{ city?: string; state?: string; country?: string }>
): { eligible: boolean; reason: string; availableLocations: string[] } {
  if (!patientLocation) {
    return { 
      eligible: true, 
      reason: "No patient location specified", 
      availableLocations: trialLocations.map(loc => `${loc.city}, ${loc.state}`).filter(Boolean)
    };
  }
  
  const availableLocations = trialLocations.map(loc => `${loc.city}, ${loc.state}`).filter(Boolean);
  const patientState = patientLocation.split(',').pop()?.trim().toLowerCase();
  
  const hasLocationMatch = trialLocations.some(loc => 
    loc.state?.toLowerCase() === patientState ||
    loc.city?.toLowerCase() === patientLocation.toLowerCase()
  );
  
  return {
    eligible: hasLocationMatch,
    reason: hasLocationMatch 
      ? `Patient location ${patientLocation} matches trial locations`
      : `Patient location ${patientLocation} not in trial locations`,
    availableLocations,
  };
}
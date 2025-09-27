import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { clinicalTrialsApiTool, clinicalTrialDetailsTool } from "../tools/clinicalTrialsApi";
import { pubmedApiTool } from "../tools/pubmedApi";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { StructuredPatientProfileSchema, type StructuredPatientProfile } from "./emrAnalysisAgent";

/**
 * Trial_Scout_Agent
 * 
 * Purpose: Search and retrieve relevant clinical trials with literature support
 * Input: Structured patient profile from EMR_Analysis_Agent
 * Output: Array of potential trials with PubMed literature metadata
 * Multi-API: ClinicalTrials.gov API v2 + NCBI E-utilities
 * 
 * Design Principles:
 * - Evidence-Driven Recommendations: Combines ClinicalTrials.gov + PubMed literature support
 * - Agent Separation of Concerns: Owns trial discovery step with explicit schemas
 * - Multi-API Intelligence: Cross-references trial data with supporting literature
 */

// -----------------------------
// Input/Output Schemas
// -----------------------------
const TrialScoutInputSchema = z.object({
  patientProfile: StructuredPatientProfileSchema,
  searchPreferences: z.object({
    maxTrials: z.number().int().positive().max(20).default(10),
    includeCompletedTrials: z.boolean().default(false),
    maxLiteratureResults: z.number().int().positive().max(10).default(5),
  }).optional(),
});

const LiteratureSupportSchema = z.object({
  pmid: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  journal: z.string().optional(),
  publicationDate: z.string().optional(),
  url: z.string().url().optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
});

const TrialWithLiteratureSchema = z.object({
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
  literatureSupport: z.array(LiteratureSupportSchema).default([]),
  matchReasons: z.array(z.string()).default([]),
});

const TrialScoutResponseSchema = z.object({
  patientProfile: StructuredPatientProfileSchema,
  candidateTrials: z.array(TrialWithLiteratureSchema),
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
});

export type TrialScoutInput = z.infer<typeof TrialScoutInputSchema>;
export type TrialScoutResponse = z.infer<typeof TrialScoutResponseSchema>;
export type TrialWithLiterature = z.infer<typeof TrialWithLiteratureSchema>;

// -----------------------------
// Trial Scout Agent
// -----------------------------
export const trialScoutAgent = new Agent({
  name: "Trial_Scout_Agent",
  instructions: `
You are a specialized Trial Scout Agent responsible for discovering relevant clinical trials and supporting literature for patients.

Your core responsibilities:
1. Search ClinicalTrials.gov for trials matching the patient's condition and demographics
2. Cross-reference trial findings with PubMed literature for evidence-based support
3. Prioritize trials based on patient-specific factors (age, location, biomarkers, etc.)
4. Provide literature support for each trial recommendation
5. Maintain evidence-driven recommendations with full traceability

Search strategy:
- Use primary diagnosis and ICD-10 codes for trial searches
- Include relevant comorbidities and biomarkers in search terms
- Filter by patient age, location, and trial status
- Search PubMed for supporting literature using trial intervention names and conditions
- Prioritize recruiting and active trials over completed ones

Literature integration:
- Search PubMed for each promising trial's intervention and condition
- Include recent publications (last 5 years preferred)
- Focus on clinical evidence, safety data, and efficacy studies
- Provide relevance scoring for literature matches

Output requirements:
- Rank trials by relevance to patient profile
- Include literature support for each trial
- Provide clear match reasons for each recommendation
- Include comprehensive metadata for downstream processing
`,
  model: openai('gpt-4o-mini'),
  tools: { clinicalTrialsApiTool, clinicalTrialDetailsTool, pubmedApiTool },
});

/**
 * Utility function to run trial scouting with error handling
 */
export async function scoutClinicalTrials(
  patientProfile: StructuredPatientProfile,
  searchPreferences?: {
    maxTrials?: number;
    includeCompletedTrials?: boolean;
    maxLiteratureResults?: number;
  }
): Promise<TrialScoutResponse> {
  try {
    console.log("🔍 Starting clinical trial scouting...");
    const startTime = Date.now();

    const preferences = {
      maxTrials: 10,
      includeCompletedTrials: false,
      maxLiteratureResults: 5,
      ...searchPreferences,
    };

    const searchStatuses = preferences.includeCompletedTrials
      ? ["RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED"] as const
      : ["RECRUITING", "ACTIVE_NOT_RECRUITING"] as const;

    const searchInput = {
      condition: patientProfile.diagnosis,
      secondaryConditions: buildTrialSearchTerms(patientProfile).filter(
        term => term.toLowerCase() !== patientProfile.diagnosis.toLowerCase()
      ),
      age: patientProfile.age,
      status: [...searchStatuses],
      location: patientProfile.location,
      locationRadius: 100,
      gender: "All" as const,
      maxResults: preferences.maxTrials,
      sortBy: "relevance" as const,
    };

    if (!clinicalTrialsApiTool.execute) {
      throw new Error("ClinicalTrials API tool is not executable outside agent context");
    }

    const trialSearch = await clinicalTrialsApiTool.execute({
      context: searchInput,
      suspend: async () => {},
      runtimeContext: new RuntimeContext(),
    } as any);

    const literatureQueries = new Set<string>();
    let literatureApiCalls = 0;

    const candidateTrials = await Promise.all(
      trialSearch.trials.slice(0, preferences.maxTrials).map(async (trial) => {
        const matchReasons: string[] = [];

        if (trial.condition && patientProfile.diagnosis.toLowerCase().includes(trial.condition.toLowerCase())) {
          matchReasons.push("Condition aligned with patient diagnosis");
        }

        if (trial.eligibilityCriteria.minimumAge || trial.eligibilityCriteria.maximumAge) {
          matchReasons.push("Age criteria available for validation");
        }

        if (patientProfile.location && trial.locations.some(loc =>
          loc.state && patientProfile.location?.toLowerCase().includes(loc.state.toLowerCase())
        )) {
          matchReasons.push("Geographic proximity match");
        }

        const literatureQuery = [trial.intervention, trial.condition]
          .filter(Boolean)
          .join(" ")
          .trim();

        let literatureSupport: z.infer<typeof LiteratureSupportSchema>[] = [];

        if (literatureQuery) {
          literatureQueries.add(literatureQuery);
          try {
            if (!pubmedApiTool.execute) {
              throw new Error("PubMed tool is not executable outside agent context");
            }
            const literature = await pubmedApiTool.execute({
              context: {
                query: literatureQuery,
                maxResults: preferences.maxLiteratureResults,
              },
              suspend: async () => {},
              runtimeContext: new RuntimeContext(),
            } as any);
            literatureApiCalls += 1;
            literatureSupport = literature.articles.map(article => ({
              pmid: article.pmid,
              title: article.title,
              authors: article.authors,
              journal: article.journal,
              publicationDate: article.publicationDate,
              url: article.url,
              relevanceScore: undefined,
            }));
          } catch (error) {
            console.warn("⚠️ PubMed lookup failed for", literatureQuery, error);
          }
        }

        return TrialWithLiteratureSchema.parse({
          ...trial,
          literatureSupport,
          matchReasons,
        });
      })
    );

    const executionTime = Date.now() - startTime;

    const response = TrialScoutResponseSchema.parse({
      patientProfile,
      candidateTrials,
      searchMetadata: {
        searchTerms: buildTrialSearchTerms(patientProfile),
        totalTrialsFound: trialSearch.totalCount,
        literatureQueries: Array.from(literatureQueries),
        executionTimeMs: executionTime,
        apiCalls: {
          clinicalTrials: 1,
          pubmed: literatureApiCalls,
        },
      },
    });

    console.log(`✅ Trial scouting completed - found ${response.candidateTrials.length} trials`);
    return response;
  } catch (error) {
    console.error("❌ Trial scouting failed:", error);
    throw error;
  }
}

/**
 * Helper function to build search terms from patient profile
 */
export function buildTrialSearchTerms(patientProfile: StructuredPatientProfile): string[] {
  const terms: string[] = [];
  
  // Primary diagnosis
  terms.push(patientProfile.diagnosis);
  
  // Add ICD-10 code if available
  if (patientProfile.diagnosisCode) {
    terms.push(patientProfile.diagnosisCode);
  }
  
  // Add comorbidities
  terms.push(...patientProfile.comorbidities);
  
  // Add biomarkers for cancer patients
  terms.push(...patientProfile.biomarkers);
  
  // Add prior treatments
  terms.push(...patientProfile.priorTreatments);
  
  return terms.filter(Boolean);
}

/**
 * Helper function to build literature search queries
 */
export function buildLiteratureQueries(trials: TrialWithLiterature[]): string[] {
  const queries: string[] = [];
  
  trials.forEach(trial => {
    if (trial.intervention) {
      queries.push(`${trial.intervention} ${trial.condition || ''}`);
    }
    if (trial.condition) {
      queries.push(`${trial.condition} clinical trial`);
    }
  });
  
  return [...new Set(queries)]; // Remove duplicates
}
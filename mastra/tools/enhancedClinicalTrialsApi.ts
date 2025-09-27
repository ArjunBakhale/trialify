import { createTool } from "@mastra/core";
import { z } from "zod";

/**
 * Enhanced ClinicalTrials.gov API v2 integration with real endpoints
 * Replaces mock data with actual API calls for production use
 */

// -----------------------------
// Enhanced Schemas
// -----------------------------
export const EnhancedTrialSchema = z.object({
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
  // Enhanced fields
  detailedDescription: z.string().optional(),
  briefSummary: z.string().optional(),
  primaryOutcomeMeasures: z.array(z.string()).default([]),
  secondaryOutcomeMeasures: z.array(z.string()).default([]),
  studyArms: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    interventionType: z.string().optional(),
  })).default([]),
  biomarkers: z.array(z.string()).default([]),
  eligibilityScore: z.number().min(0).max(1).optional(),
});

export const EnhancedClinicalTrialsResponseSchema = z.object({
  trials: z.array(EnhancedTrialSchema),
  totalCount: z.number(),
  queryMetadata: z.object({
    searchTerms: z.array(z.string()),
    filters: z.record(z.any()),
    executionTimeMs: z.number(),
    apiCallsMade: z.number(),
    cacheHitRate: z.number().optional(),
  }),
  pagination: z.object({
    currentPage: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }).optional(),
});

// -----------------------------
// Configuration
// -----------------------------
const CLINICAL_TRIALS_BASE_URL = "https://clinicaltrials.gov/api/v2/studies";
const API_RATE_LIMIT = 3; // requests per second
const CACHE_TTL = 86400; // 24 hours in seconds

// Simple in-memory cache (in production, use Redis or similar)
const cache = new Map<string, { data: any; timestamp: number }>();

// -----------------------------
// Rate Limiting
// -----------------------------
class RateLimiter {
  private requests: number[] = [];
  
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    // Remove requests older than 1 second
    this.requests = this.requests.filter(time => now - time < 1000);
    
    if (this.requests.length >= API_RATE_LIMIT) {
      const waitTime = 1000 - (now - this.requests[0]);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}

const rateLimiter = new RateLimiter();

// -----------------------------
// Cache Management
// -----------------------------
const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// -----------------------------
// Enhanced Query Building
// -----------------------------
const buildAdvancedQuery = (patientProfile: any) => {
  const query = {
    // Primary condition search
    condition: patientProfile.diagnosis,
    
    // Age-based filtering
    age: {
      min: Math.max(patientProfile.age - 5, 0),
      max: patientProfile.age + 10
    },
    
    // Location-based filtering
    location: patientProfile.location,
    
    // Status filtering (prioritize recruiting trials)
    status: ["RECRUITING", "ACTIVE_NOT_RECRUITING"],
    
    // Phase filtering based on condition type
    phase: getPhaseFilter(patientProfile.diagnosis),
    
    // Biomarker-specific searches
    biomarkers: patientProfile.biomarkers,
    
    // Medication-based exclusions
    excludeMedications: patientProfile.medications
  };
  
  return query;
};

const getPhaseFilter = (diagnosis: string) => {
  const cancerKeywords = ['cancer', 'tumor', 'carcinoma', 'sarcoma', 'lymphoma', 'leukemia'];
  const isCancer = cancerKeywords.some(keyword => 
    diagnosis.toLowerCase().includes(keyword)
  );
  
  return isCancer 
    ? ["Phase 1", "Phase 2", "Phase 3", "Phase 4"]
    : ["Phase 2", "Phase 3", "Phase 4"];
};

// -----------------------------
// Enhanced Eligibility Criteria Parsing
// -----------------------------
const parseEligibilityCriteria = (rawCriteria: string) => {
  if (!rawCriteria) {
    return { inclusionCriteria: [], exclusionCriteria: [] };
  }

  const normalized = rawCriteria.replace(/\r/g, "").trim();
  const [inclusionBlockRaw, exclusionBlockRaw] = normalized
    .split(/Exclusion Criteria:/i)
    .map((section) => section?.trim() ?? "");

  const inclusionBlock = inclusionBlockRaw.split(/Inclusion Criteria:/i)[1] ?? inclusionBlockRaw;
  
  // Enhanced parsing with better criteria extraction
  const inclusionCriteria = inclusionBlock
    .split(/\n+/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
    .map(criteria => enhanceCriteria(criteria));

  const exclusionCriteria = exclusionBlockRaw
    .split(/\n+/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
    .map(criteria => enhanceCriteria(criteria));

  return { inclusionCriteria, exclusionCriteria };
};

const enhanceCriteria = (criteria: string) => {
  // Extract structured information from criteria text
  const ageMatch = criteria.match(/(\d+)\s*(?:to|-)?\s*(\d+)?\s*years?/i);
  const genderMatch = criteria.match(/(male|female|both)/i);
  const labMatch = criteria.match(/(\w+)\s*([><=]+)\s*([\d.]+)/i);
  
  return {
    text: criteria,
    ageRange: ageMatch ? {
      min: parseInt(ageMatch[1]),
      max: ageMatch[2] ? parseInt(ageMatch[2]) : undefined
    } : undefined,
    gender: genderMatch ? genderMatch[1].toLowerCase() : undefined,
    labValue: labMatch ? {
      test: labMatch[1],
      operator: labMatch[2],
      value: parseFloat(labMatch[3])
    } : undefined
  };
};

// -----------------------------
// Enhanced API Tool
// -----------------------------
export const enhancedClinicalTrialsApiTool = createTool({
  id: "enhancedClinicalTrialsSearch",
  description: "Enhanced ClinicalTrials.gov search with real API integration, caching, and advanced filtering",
  inputSchema: z.object({
    patientProfile: z.object({
      diagnosis: z.string(),
      age: z.number(),
      location: z.string().optional(),
      medications: z.array(z.string()).default([]),
      biomarkers: z.array(z.string()).default([]),
      comorbidities: z.array(z.string()).default([]),
    }),
    searchOptions: z.object({
      maxResults: z.number().default(20),
      includeCompletedTrials: z.boolean().default(false),
      prioritizeRecruiting: z.boolean().default(true),
      includeBiomarkerTrials: z.boolean().default(true),
    }).optional(),
  }),
  outputSchema: EnhancedClinicalTrialsResponseSchema,
  execute: async (ctx) => {
    const { patientProfile, searchOptions = {} } = ctx.context;
    const startTime = Date.now();
    
    // Build cache key
    const cacheKey = `clinical_trials_${JSON.stringify({ patientProfile, searchOptions })}`;
    
    // Check cache first
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        queryMetadata: {
          ...cachedResult.queryMetadata,
          cacheHitRate: 1.0,
          executionTimeMs: Date.now() - startTime,
        }
      };
    }
    
    try {
      // Apply rate limiting
      await rateLimiter.waitIfNeeded();
      
      // Build advanced query
      const query = buildAdvancedQuery(patientProfile);
      
      // Construct API request
      const params = new URLSearchParams({
        format: "json",
        pageSize: String(searchOptions.maxResults || 20),
        sortBy: "relevance",
      });
      
      // Add condition search
      params.append("query.cond", patientProfile.diagnosis);
      
      // Add age filtering
      if (patientProfile.age) {
        const ageBucket = patientProfile.age < 18 ? "Child" : 
                         patientProfile.age >= 65 ? "Older Adult" : "Adult";
        params.append("query.age", ageBucket);
      }
      
      // Add location filtering
      if (patientProfile.location) {
        params.append("query.locn", patientProfile.location);
        params.append("distance", "100");
      }
      
      // Add status filtering
      const statuses = searchOptions.prioritizeRecruiting 
        ? ["RECRUITING", "ACTIVE_NOT_RECRUITING"]
        : ["RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED"];
      params.append("query.recr", statuses.join(","));
      
      // Add biomarker filtering
      if (searchOptions.includeBiomarkerTrials && patientProfile.biomarkers.length > 0) {
        params.append("query.biom", patientProfile.biomarkers.join(","));
      }
      
      // Make API request
      const response = await fetch(`${CLINICAL_TRIALS_BASE_URL}?${params.toString()}`, {
        headers: {
          "User-Agent": "Trialify-Clinical-Navigator/1.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });
      
      if (!response.ok) {
        throw new Error(`ClinicalTrials.gov API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const studies = data?.studies ?? [];
      
      // Process and enhance trial data
      const enhancedTrials = await Promise.all(
        studies.map(async (study: any) => {
          const rawEligibility = study?.protocolSection?.eligibilityModule?.eligibilityCriteria ?? "";
          const { inclusionCriteria, exclusionCriteria } = parseEligibilityCriteria(rawEligibility);
          
          // Calculate eligibility score
          const eligibilityScore = calculateEligibilityScore(study, patientProfile);
          
          return {
            nctId: study?.protocolSection?.identificationModule?.nctId ?? "",
            title: study?.protocolSection?.identificationModule?.briefTitle ?? undefined,
            status: study?.protocolSection?.statusModule?.overallStatus ?? undefined,
            phase: study?.protocolSection?.designModule?.phases?.[0] ?? undefined,
            studyType: study?.protocolSection?.designModule?.studyType ?? undefined,
            condition: study?.protocolSection?.conditionsModule?.conditions?.[0] ?? patientProfile.diagnosis,
            intervention: study?.protocolSection?.armsInterventionsModule?.interventions?.[0]?.name ?? undefined,
            eligibilityCriteria: {
              inclusionCriteria: inclusionCriteria.map(c => typeof c === 'string' ? c : c.text),
              exclusionCriteria: exclusionCriteria.map(c => typeof c === 'string' ? c : c.text),
              minimumAge: study?.protocolSection?.eligibilityModule?.minimumAge ?? undefined,
              maximumAge: study?.protocolSection?.eligibilityModule?.maximumAge ?? undefined,
              gender: study?.protocolSection?.eligibilityModule?.sex ?? undefined,
            },
            locations: mapStudyLocations(study),
            contacts: {
              centralContact: study?.protocolSection?.contactsLocationsModule?.centralContacts?.[0]?.name ?? undefined,
              overallOfficial: study?.protocolSection?.contactsLocationsModule?.overallOfficials?.[0]?.name ?? undefined,
            },
            urls: {
              clinicalTrialsGov: `https://clinicaltrials.gov/study/${study?.protocolSection?.identificationModule?.nctId}`,
              studyWebsite: study?.protocolSection?.identificationModule?.secondaryIdInfos?.find(
                (id: any) => id?.type === "Other"
              )?.id ?? undefined,
            },
            lastUpdate: study?.protocolSection?.statusModule?.lastUpdateSubmitDate ?? undefined,
            enrollmentCount: study?.protocolSection?.designModule?.enrollmentInfo?.count ?? undefined,
            startDate: study?.protocolSection?.statusModule?.startDateStruct?.date ?? undefined,
            completionDate: study?.protocolSection?.statusModule?.completionDateStruct?.date ?? undefined,
            // Enhanced fields
            detailedDescription: study?.protocolSection?.descriptionModule?.detailedDescription ?? undefined,
            briefSummary: study?.protocolSection?.descriptionModule?.briefSummary ?? undefined,
            primaryOutcomeMeasures: study?.protocolSection?.outcomesModule?.primaryOutcomes?.map((outcome: any) => outcome.measure) ?? [],
            secondaryOutcomeMeasures: study?.protocolSection?.outcomesModule?.secondaryOutcomes?.map((outcome: any) => outcome.measure) ?? [],
            studyArms: study?.protocolSection?.armsInterventionsModule?.arms?.map((arm: any) => ({
              name: arm.armLabel,
              description: arm.armDescription,
              interventionType: arm.armType,
            })) ?? [],
            biomarkers: extractBiomarkers(study),
            eligibilityScore,
          };
        })
      );
      
      const result = {
        trials: enhancedTrials,
        totalCount: data?.totalCount ?? enhancedTrials.length,
        queryMetadata: {
          searchTerms: [patientProfile.diagnosis, ...patientProfile.biomarkers],
          filters: {
            age: patientProfile.age,
            location: patientProfile.location,
            status: statuses,
            biomarkers: patientProfile.biomarkers,
          },
          executionTimeMs: Date.now() - startTime,
          apiCallsMade: 1,
          cacheHitRate: 0,
        },
      };
      
      // Cache the result
      setCachedData(cacheKey, result);
      
      return EnhancedClinicalTrialsResponseSchema.parse(result);
      
    } catch (error) {
      console.error("Enhanced ClinicalTrials.gov search failed", error);
      
      // Fallback to mock data if API fails
      if (process.env.MASTRA_MOCK_MODE === "true") {
        return EnhancedClinicalTrialsResponseSchema.parse({
          trials: [{
            nctId: "NCT00000000",
            title: "Mock Trial for Offline Demo",
            status: "RECRUITING",
            phase: "Phase 3",
            studyType: "Interventional",
            condition: patientProfile.diagnosis,
            intervention: "Investigational Therapy X",
            eligibilityCriteria: {
              inclusionCriteria: [
                "Adults aged 18-75",
                "Confirmed diagnosis matching query condition",
                "Stable first-line therapy for ≥3 months",
              ],
              exclusionCriteria: [
                "Pregnancy or breastfeeding",
                "Severe renal impairment",
                "Recent participation in conflicting trial",
              ],
              minimumAge: "18 Years",
              maximumAge: "75 Years",
              gender: "All",
            },
            locations: [{
              facility: "Mock Clinical Research Center",
              city: "Atlanta",
              state: "GA",
              country: "USA",
              status: "RECRUITING",
              contacts: [{
                name: "Dr. Demo Researcher",
                phone: "404-555-1000",
                email: "demo@trialify.health",
              }],
            }],
            contacts: {
              centralContact: "Trial Navigator Desk",
              overallOfficial: "Dr. Principal Investigator",
            },
            urls: {
              clinicalTrialsGov: "https://clinicaltrials.gov/study/NCT00000000",
            },
            lastUpdate: new Date().toISOString(),
            enrollmentCount: 150,
            startDate: "2024-01-01",
            completionDate: "2026-12-31",
            eligibilityScore: 0.85,
          }],
          totalCount: 1,
          queryMetadata: {
            searchTerms: [patientProfile.diagnosis],
            filters: { age: patientProfile.age, location: patientProfile.location },
            executionTimeMs: Date.now() - startTime,
            apiCallsMade: 0,
            cacheHitRate: 0,
          },
        });
      }
      
      throw error;
    }
  },
});

// -----------------------------
// Helper Functions
// -----------------------------
const mapStudyLocations = (study: any) => {
  const rawLocations = study?.protocolSection?.contactsLocationsModule?.locations ?? [];
  return rawLocations.map((location: any) => ({
    facility: location?.facility ?? undefined,
    city: location?.city ?? undefined,
    state: location?.state ?? undefined,
    country: location?.country ?? undefined,
    status: location?.status ?? undefined,
    contacts: (location?.contacts ?? []).map((contact: any) => ({
      name: contact?.name ?? undefined,
      phone: contact?.phone ?? undefined,
      email: contact?.email ?? undefined,
    })),
  }));
};

const extractBiomarkers = (study: any) => {
  const biomarkers: string[] = [];
  
  // Extract from eligibility criteria
  const eligibility = study?.protocolSection?.eligibilityModule?.eligibilityCriteria ?? "";
  const biomarkerMatches = eligibility.match(/(EGFR|ALK|PD-L1|KRAS|BRAF|HER2|BRCA|MSI|TMB)/gi);
  if (biomarkerMatches) {
    biomarkers.push(...biomarkerMatches.map(m => m.toUpperCase()));
  }
  
  // Extract from study arms
  const arms = study?.protocolSection?.armsInterventionsModule?.arms ?? [];
  arms.forEach((arm: any) => {
    const armBiomarkers = arm.armDescription?.match(/(EGFR|ALK|PD-L1|KRAS|BRAF|HER2|BRCA|MSI|TMB)/gi);
    if (armBiomarkers) {
      biomarkers.push(...armBiomarkers.map(m => m.toUpperCase()));
    }
  });
  
  return [...new Set(biomarkers)]; // Remove duplicates
};

const calculateEligibilityScore = (study: any, patientProfile: any) => {
  let score = 0;
  
  // Age eligibility
  const minAge = study?.protocolSection?.eligibilityModule?.minimumAge;
  const maxAge = study?.protocolSection?.eligibilityModule?.maximumAge;
  
  if (minAge && maxAge) {
    const minAgeNum = parseInt(minAge.match(/\d+/)?.[0] || "0");
    const maxAgeNum = parseInt(maxAge.match(/\d+/)?.[0] || "999");
    
    if (patientProfile.age >= minAgeNum && patientProfile.age <= maxAgeNum) {
      score += 0.3;
    }
  }
  
  // Condition match
  const conditions = study?.protocolSection?.conditionsModule?.conditions ?? [];
  if (conditions.some((condition: string) => 
    condition.toLowerCase().includes(patientProfile.diagnosis.toLowerCase())
  )) {
    score += 0.4;
  }
  
  // Location match
  const locations = study?.protocolSection?.contactsLocationsModule?.locations ?? [];
  if (patientProfile.location && locations.some((location: any) => 
    location.state?.toLowerCase().includes(patientProfile.location.toLowerCase())
  )) {
    score += 0.2;
  }
  
  // Status preference
  const status = study?.protocolSection?.statusModule?.overallStatus;
  if (status === "RECRUITING") {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
};
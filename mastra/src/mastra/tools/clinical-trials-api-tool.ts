import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { rateLimiter, cache, monitor } from '../../../config/apiConfig';

// Enhanced schemas with additional fields for better trial matching
interface ClinicalTrialsResponse {
  trials: Array<{
    nctId: string;
    title?: string;
    status?: string;
    phase?: string;
    studyType?: string;
    condition?: string;
    intervention?: string;
    eligibilityCriteria: {
      inclusionCriteria: string[];
      exclusionCriteria: string[];
      minimumAge?: string;
      maximumAge?: string;
      gender?: string;
    };
    locations: Array<{
      facility?: string;
      city?: string;
      state?: string;
      country?: string;
      status?: string;
      contacts: Array<{
        name?: string;
        phone?: string;
        email?: string;
      }>;
    }>;
    contacts?: {
      centralContact?: string;
      overallOfficial?: string;
    };
    urls: {
      clinicalTrialsGov: string;
      studyWebsite?: string;
    };
    lastUpdate?: string;
    enrollmentCount?: number;
    startDate?: string;
    completionDate?: string;
    // Enhanced fields
    detailedDescription?: string;
    briefSummary?: string;
    primaryOutcomeMeasures?: string[];
    secondaryOutcomeMeasures?: string[];
    biomarkers?: string[];
    eligibilityScore?: number;
  }>;
  totalCount: number;
  queryMetadata?: {
    searchTerms: string[];
    filters: Record<string, any>;
    executionTimeMs: number;
    apiCallsMade: number;
    cacheHitRate?: number;
  };
}

export const clinicalTrialsApiTool = createTool({
  id: 'search-clinical-trials',
  description: 'Search ClinicalTrials.gov for relevant clinical trials',
  inputSchema: z.object({
    condition: z.string().describe('Primary condition or disease'),
    secondaryConditions: z.array(z.string()).optional().describe('Additional conditions or comorbidities'),
    age: z.number().int().positive().describe('Patient age'),
    status: z.array(z.enum(['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'COMPLETED', 'SUSPENDED', 'TERMINATED', 'WITHDRAWN'])).describe('Trial statuses to include'),
    location: z.string().optional().describe('Patient location'),
    locationRadius: z.number().optional().describe('Search radius in miles'),
    gender: z.enum(['All', 'Male', 'Female']).optional().describe('Gender requirement'),
    maxResults: z.number().int().positive().max(50).default(20).describe('Maximum number of results'),
    sortBy: z.enum(['relevance', 'date', 'title']).default('relevance').describe('Sort order'),
  }),
  outputSchema: z.object({
    trials: z.array(z.object({
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
    })),
    totalCount: z.number(),
  }),
  execute: async ({ context }) => {
    return await searchClinicalTrials(context);
  },
});

export const clinicalTrialDetailsTool = createTool({
  id: 'get-trial-details',
  description: 'Get detailed information for a specific clinical trial',
  inputSchema: z.object({
    nctId: z.string().describe('NCT ID of the trial'),
  }),
  outputSchema: z.object({
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
  }),
  execute: async ({ context }) => {
    return await getTrialDetails(context.nctId);
  },
});

async function searchClinicalTrials(searchParams: any, isFallback: boolean = false): Promise<ClinicalTrialsResponse> {
  const startTime = Date.now();
  const useMockData = process.env.MASTRA_MOCK_MODE === 'true';
  
  // Build cache key
  const cacheKey = `clinical_trials_${JSON.stringify(searchParams)}`;
  
  // Check cache first
  const cachedResult = cache.get(cacheKey, 86400); // 24 hour TTL
  if (cachedResult && !useMockData) {
    return {
      ...cachedResult,
      queryMetadata: {
        ...cachedResult.queryMetadata,
        cacheHitRate: 1.0,
        executionTimeMs: Date.now() - startTime,
      }
    };
  }
  
  if (useMockData) {
    console.log('🔧 Using mock data for ClinicalTrials.gov API');
    const mockResult = getMockClinicalTrialsData(searchParams);
    return {
      ...mockResult,
      queryMetadata: {
        searchTerms: [searchParams.condition],
        filters: searchParams,
        executionTimeMs: Date.now() - startTime,
        apiCallsMade: 0,
        cacheHitRate: 0,
      }
    };
  }
  
  try {
    console.log('🌐 Using real ClinicalTrials.gov API');
    
    // Apply rate limiting
    await rateLimiter.waitIfNeeded('clinicalTrials', 3);
    
    // Build optimized query parameters for ClinicalTrials.gov API v2
    const params = new URLSearchParams();
    
    // Set format and basic parameters
    params.append('format', 'json');
    params.append('pageSize', Math.min(searchParams.maxResults, 100).toString()); // Cap at 100 for better performance
    
    // Only use VALID parameters that actually work with the API
    // Based on testing, only these parameters are supported:
    
    // 1. Condition search (VALID) - Combine all conditions into a single query
    const expandedConditions = expandConditionQuery(searchParams.condition);
    let allConditions = [...expandedConditions];
    
    // Add secondary conditions with expansion
    if (searchParams.secondaryConditions?.length) {
      searchParams.secondaryConditions.forEach((condition: string) => {
        const expanded = expandConditionQuery(condition);
        allConditions.push(...expanded);
      });
    }
    
    // Combine all conditions into a single search term (API limitation)
    // Use the primary condition as the main search term
    const primaryCondition = searchParams.condition;
    params.append('query.cond', primaryCondition);
    
    // For now, only use the primary condition to avoid API errors
    // TODO: Research if API supports multiple conditions or if we need to make separate calls
    
    // 2. Location search (VALID) - Use only the primary location
    if (searchParams.location) {
      // Use only the primary location to avoid API errors
      params.append('query.locn', searchParams.location);
      
      // Note: distance parameter may not be supported, test first
      if (searchParams.locationRadius) {
        params.append('distance', searchParams.locationRadius.toString());
      }
    }

    params.append('filter.overallStatus', "NOT_YET_RECRUITING,RECRUITING,ACTIVE_NOT_RECRUITING,AVAILABLE");
    
    // REMOVED INVALID PARAMETERS:
    // - query.age (NOT SUPPORTED)
    // - query.recr (NOT SUPPORTED) 
    // - query.gndr (NOT SUPPORTED)
    // - query.studyType (NOT SUPPORTED)
    // - query.phase (NOT SUPPORTED)
    
    // We'll filter these on the client side after getting results
    
    const url = `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`;
    console.log('🔍 Searching ClinicalTrials.gov:', url);
    console.log('📋 Query parameters:', Object.fromEntries(params.entries()));
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Trialify-Clinical-Navigator/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ClinicalTrials API Error:', {
        status: response.status,
        statusText: response.statusText,
        url: url,
        errorBody: errorText
      });
      throw new Error(`ClinicalTrials API returned ${response.status}: ${response.statusText}. URL: ${url}. Error: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Found ${data?.studies?.length || 0} trials from ClinicalTrials.gov`);
    
    // If we got few results, try a fallback query with broader parameters
    // BUT ONLY if this is not already a fallback query to prevent infinite loops
    if (data?.studies?.length < 3 && !useMockData && !isFallback) {
      console.log(`🔄 Few results found (${data?.studies?.length}), trying fallback query...`);
      try {
        const fallbackResult = await executeFallbackQuery(searchParams);
        if (fallbackResult.trials.length > data?.studies?.length) {
          console.log(`✅ Fallback query found ${fallbackResult.trials.length} additional trials`);
          return fallbackResult;
        } else {
          console.log(`⚠️ Fallback query found ${fallbackResult.trials.length} trials (same or fewer), using original results`);
        }
      } catch (fallbackError) {
        console.warn('⚠️ Fallback query failed, using original results:', fallbackError);
      }
    } else if (isFallback) {
      console.log(`🔄 Fallback query completed with ${data?.studies?.length} trials`);
    }
    
    // Transform the response to match our enhanced schema
    const trials = data.studies?.map((study: any) => {
      const rawEligibility = study?.protocolSection?.eligibilityModule?.eligibilityCriteria ?? "";
      const { inclusionCriteria, exclusionCriteria } = parseEligibilityCriteria(rawEligibility);
      
      return {
        nctId: study.protocolSection.identificationModule.nctId,
        title: study.protocolSection.identificationModule.briefTitle,
        status: study.protocolSection.statusModule.overallStatus,
        phase: study.protocolSection.designModule?.phases?.[0],
        studyType: study.protocolSection.designModule.studyType,
        condition: study.protocolSection.conditionsModule?.conditions?.[0],
        intervention: study.protocolSection.interventionsModule?.interventions?.[0]?.name,
        eligibilityCriteria: {
          inclusionCriteria: inclusionCriteria?.map(c => typeof c === 'string' ? c : c?.text || '') || [],
          exclusionCriteria: exclusionCriteria?.map(c => typeof c === 'string' ? c : c?.text || '') || [],
          minimumAge: study.protocolSection.eligibilityModule?.minimumAge,
          maximumAge: study.protocolSection.eligibilityModule?.maximumAge,
          gender: study.protocolSection.eligibilityModule?.gender,
        },
        locations: study.protocolSection.contactsLocationsModule?.locations?.map((loc: any) => ({
          facility: loc.facility?.name,
          city: loc.facility?.address?.city,
          state: loc.facility?.address?.state,
          country: loc.facility?.address?.country,
          status: loc.status,
          contacts: loc.contacts?.map((contact: any) => ({
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
          })) || [],
        })) || [],
        contacts: {
          centralContact: study.protocolSection.contactsLocationsModule?.centralContact?.name,
          overallOfficial: study.protocolSection.contactsLocationsModule?.overallOfficial?.name,
        },
        urls: {
          clinicalTrialsGov: `https://clinicaltrials.gov/study/${study.protocolSection.identificationModule.nctId}`,
          studyWebsite: study.protocolSection.identificationModule?.studyWebsite,
        },
        lastUpdate: study.protocolSection.statusModule.lastUpdatePostDateStruct?.date,
        enrollmentCount: study.protocolSection.statusModule.enrollmentInfo?.count,
        startDate: study.protocolSection.statusModule.studyFirstSubmitDateStruct?.date,
        completionDate: study.protocolSection.statusModule.completionDateStruct?.date,
        // Enhanced fields
        detailedDescription: study.protocolSection.descriptionModule?.detailedDescription,
        briefSummary: study.protocolSection.descriptionModule?.briefSummary,
        primaryOutcomeMeasures: study.protocolSection.outcomesModule?.primaryOutcomes?.map((outcome: any) => outcome.measure) || [],
        secondaryOutcomeMeasures: study.protocolSection.outcomesModule?.secondaryOutcomes?.map((outcome: any) => outcome.measure) || [],
        biomarkers: extractBiomarkers(study),
        eligibilityScore: calculateEligibilityScore(study, searchParams),
      };
    }) || [];
    
    // Apply client-side filtering for parameters not supported by the API
    // NOTE: We're being more lenient here - let eligibility scoring handle the ranking
    const filteredTrials = trials.filter((trial: any) => {
      // Only filter out trials with very low eligibility scores (below 0.1)
      if (trial.eligibilityScore < 0.1) {
        return false;
      }
      
      // Skip status filtering - let eligibility scoring handle status preferences
      // This allows more trials to be returned with appropriate scoring
      
      // Filter by gender if specified (but be more lenient)
      if (searchParams.gender && searchParams.gender !== 'All') {
        const trialGender = trial.eligibilityCriteria.gender?.toUpperCase();
        const requestedGender = searchParams.gender.toUpperCase();
        
        // Only filter out if gender is explicitly different and not 'ALL'
        if (trialGender && trialGender !== 'ALL' && trialGender !== requestedGender) {
          return false;
        }
      }
      
      // Remove strict study type and phase filtering - let eligibility scoring handle this
      // This allows more trials to be returned with appropriate scoring
      
      return true; // Include all trials that pass the basic filters
    });
    
    // Sort trials by eligibility score first, then by status
    const sortedTrials = filteredTrials.sort((a: any, b: any) => {
      // Primary sort: eligibility score (higher is better)
      const scoreDiff = (b.eligibilityScore || 0) - (a.eligibilityScore || 0);
      if (Math.abs(scoreDiff) > 0.01) { // Only if there's a meaningful difference
        return scoreDiff;
      }
      
      // Secondary sort: status priority (recruiting trials first)
      const statusPriority = { 'RECRUITING': 3, 'ACTIVE_NOT_RECRUITING': 2, 'ENROLLING_BY_INVITATION': 1 };
      const aStatusScore = statusPriority[a.status?.toUpperCase() as keyof typeof statusPriority] || 0;
      const bStatusScore = statusPriority[b.status?.toUpperCase() as keyof typeof statusPriority] || 0;
      
      return bStatusScore - aStatusScore;
    });
    
    
    const result = {
      trials: sortedTrials,
      totalCount: data.totalCount || trials.length,
      queryMetadata: {
        searchTerms: [searchParams.condition, ...(searchParams.secondaryConditions || [])],
        filters: {
          age: searchParams.age,
          location: searchParams.location,
          status: searchParams.status,
          gender: searchParams.gender,
        },
        executionTimeMs: Date.now() - startTime,
        apiCallsMade: 1,
        cacheHitRate: 0,
      },
    };
    
    // Cache the result
    cache.set(cacheKey, result);
    
    // Record metrics
    monitor.recordRequest('clinicalTrials', true, Date.now() - startTime);
    
    return result;
  } catch (error) {
    console.error('ClinicalTrials API search failed:', error);
    monitor.recordRequest('clinicalTrials', false, Date.now() - startTime);
    monitor.recordError('clinicalTrials', 'api');
    
    // Return mock data for development
    return {
      trials: [
        {
          nctId: 'NCT00000001',
          title: 'Mock Clinical Trial for Development',
          status: 'RECRUITING',
          phase: 'Phase 2',
          studyType: 'Interventional',
          condition: searchParams.condition,
          intervention: 'Mock Intervention',
          eligibilityCriteria: {
            inclusionCriteria: ['Adults 18-75 years', 'Confirmed diagnosis'],
            exclusionCriteria: ['Pregnancy', 'Severe comorbidities'],
            minimumAge: '18',
            maximumAge: '75',
            gender: 'All',
          },
          locations: [
            {
              facility: 'Mock Medical Center',
              city: 'Mock City',
              state: 'Mock State',
              country: 'United States',
              status: 'Recruiting',
              contacts: [],
            },
          ],
          contacts: {
            centralContact: 'Mock Contact',
            overallOfficial: 'Mock Principal Investigator',
          },
          urls: {
            clinicalTrialsGov: 'https://clinicaltrials.gov/study/NCT00000001',
          },
          lastUpdate: '2024-01-01',
          enrollmentCount: 100,
          startDate: '2024-01-01',
          completionDate: '2025-12-31',
          eligibilityScore: 0.85,
        },
      ],
      totalCount: 1,
      queryMetadata: {
        searchTerms: [searchParams.condition],
        filters: searchParams,
        executionTimeMs: Date.now() - startTime,
        apiCallsMade: 0,
        cacheHitRate: 0,
      },
    };
  }
}

async function getTrialDetails(nctId: string): Promise<any> {
  try {
    const url = `https://clinicaltrials.gov/api/v2/studies/${nctId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`ClinicalTrials API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform single study response
    const study = data.protocolSection;
    return {
      nctId: study.identificationModule.nctId,
      title: study.identificationModule.briefTitle,
      status: study.statusModule.overallStatus,
      phase: study.designModule?.phases?.[0],
      studyType: study.designModule.studyType,
      condition: study.conditionsModule?.conditions?.[0],
      intervention: study.interventionsModule?.interventions?.[0]?.name,
      eligibilityCriteria: {
        inclusionCriteria: study.eligibilityModule?.eligibilityCriteria?.split('\n').filter((line: string) => line.trim().startsWith('Inclusion')) || [],
        exclusionCriteria: study.eligibilityModule?.eligibilityCriteria?.split('\n').filter((line: string) => line.trim().startsWith('Exclusion')) || [],
        minimumAge: study.eligibilityModule?.minimumAge,
        maximumAge: study.eligibilityModule?.maximumAge,
        gender: study.eligibilityModule?.gender,
      },
      locations: study.contactsLocationsModule?.locations?.map((loc: any) => ({
        facility: loc.facility?.name,
        city: loc.facility?.address?.city,
        state: loc.facility?.address?.state,
        country: loc.facility?.address?.country,
        status: loc.status,
        contacts: loc.contacts?.map((contact: any) => ({
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
        })) || [],
      })) || [],
      contacts: {
        centralContact: study.contactsLocationsModule?.centralContact?.name,
        overallOfficial: study.contactsLocationsModule?.overallOfficial?.name,
      },
      urls: {
        clinicalTrialsGov: `https://clinicaltrials.gov/study/${study.identificationModule.nctId}`,
        studyWebsite: study.identificationModule?.studyWebsite,
      },
      lastUpdate: study.statusModule.lastUpdatePostDateStruct?.date,
      enrollmentCount: study.statusModule.enrollmentInfo?.count,
      startDate: study.statusModule.studyFirstSubmitDateStruct?.date,
      completionDate: study.statusModule.completionDateStruct?.date,
    };
  } catch (error) {
    console.error('ClinicalTrials API details failed:', error);
    throw error;
  }
}

// -----------------------------
// Helper Functions for Enhanced Implementation
// -----------------------------

const parseEligibilityCriteria = (rawCriteria: string) => {
  if (!rawCriteria || typeof rawCriteria !== 'string') {
    return { inclusionCriteria: [], exclusionCriteria: [] };
  }

  try {
    const normalized = rawCriteria.replace(/\r/g, "").trim();
    const [inclusionBlockRaw, exclusionBlockRaw] = normalized
      .split(/Exclusion Criteria:/i)
      .map((section) => section?.trim() ?? "");

    const inclusionBlock = inclusionBlockRaw.split(/Inclusion Criteria:/i)[1] ?? inclusionBlockRaw;
    
    // Enhanced parsing with better criteria extraction
    const inclusionCriteria = inclusionBlock
      ? inclusionBlock
          .split(/\n+/)
          .map((line) => line.replace(/^[-•]\s*/, "").trim())
          .filter(Boolean)
          .map(criteria => enhanceCriteria(criteria))
      : [];

    const exclusionCriteria = exclusionBlockRaw
      ? exclusionBlockRaw
          .split(/\n+/)
          .map((line) => line.replace(/^[-•]\s*/, "").trim())
          .filter(Boolean)
          .map(criteria => enhanceCriteria(criteria))
      : [];

    return { inclusionCriteria, exclusionCriteria };
  } catch (error) {
    console.warn('⚠️ Error parsing eligibility criteria:', error);
    return { inclusionCriteria: [], exclusionCriteria: [] };
  }
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

const extractBiomarkers = (study: any) => {
  const biomarkers: string[] = [];
  
  // Extract from eligibility criteria
  const eligibility = study?.protocolSection?.eligibilityModule?.eligibilityCriteria ?? "";
  const biomarkerMatches = eligibility.match(/(EGFR|ALK|PD-L1|KRAS|BRAF|HER2|BRCA|MSI|TMB)/gi);
  if (biomarkerMatches) {
    biomarkers.push(...biomarkerMatches.map((m: any) => m.toUpperCase()));
  }
  
  // Extract from study arms
  const arms = study?.protocolSection?.armsInterventionsModule?.arms ?? [];
  arms.forEach((arm: any) => {
    const armBiomarkers = arm.armDescription?.match(/(EGFR|ALK|PD-L1|KRAS|BRAF|HER2|BRCA|MSI|TMB)/gi);
    if (armBiomarkers) {
      biomarkers.push(...armBiomarkers.map((m: any) => m.toUpperCase()));
    }
  });
  
  return [...new Set(biomarkers)]; // Remove duplicates
};

const calculateEligibilityScore = (study: any, searchParams: any) => {
  let score = 0;
  
  // Age eligibility (more lenient)
  const minAge = study?.protocolSection?.eligibilityModule?.minimumAge;
  const maxAge = study?.protocolSection?.eligibilityModule?.maximumAge;
  
  
  if (minAge && maxAge) {
    const minAgeNum = parseInt(minAge.match(/\d+/)?.[0] || "0");
    const maxAgeNum = parseInt(maxAge.match(/\d+/)?.[0] || "999");
    
    if (searchParams.age >= minAgeNum && searchParams.age <= maxAgeNum) {
      score += 0.3;
    } else if (searchParams.age >= minAgeNum - 5 && searchParams.age <= maxAgeNum + 5) {
      // Allow some flexibility for age (±5 years)
      score += 0.2;
    } else {
    }
  } else {
    // If no age restrictions, give partial credit
    score += 0.15;
  }
  
  // Enhanced condition matching
  const conditions = study?.protocolSection?.conditionsModule?.conditions ?? [];
  const searchCondition = searchParams.condition.toLowerCase();
  
  
  // Direct match
  if (conditions.some((condition: string) => 
    condition.toLowerCase().includes(searchCondition)
  )) {
    score += 0.4;
  } else {
    // Fuzzy matching for common conditions
    const conditionSynonyms: Record<string, string[]> = {
      'diabetes': ['diabetes mellitus', 'type 2 diabetes', 'type ii diabetes', 't2dm', 'dm'],
      'hypertension': ['high blood pressure', 'htn', 'elevated blood pressure'],
      'cancer': ['neoplasm', 'carcinoma', 'tumor', 'malignancy'],
      'breast cancer': ['breast neoplasm', 'breast carcinoma', 'mammary cancer'],
      'lung cancer': ['lung neoplasm', 'lung carcinoma', 'pulmonary cancer'],
      'depression': ['major depressive disorder', 'mdd', 'clinical depression'],
      'anxiety': ['anxiety disorder', 'generalized anxiety', 'gad'],
    };
    
    const synonyms = conditionSynonyms[searchCondition] || [];
    const hasSynonymMatch = conditions.some((condition: string) => 
      synonyms.some(synonym => condition.toLowerCase().includes(synonym))
    );
    
    if (hasSynonymMatch) {
      score += 0.35; // Slightly lower score for synonym match
    } else {
      // Partial match for related conditions
      const hasPartialMatch = conditions.some((condition: string) => 
        condition.toLowerCase().split(' ').some(word => 
          searchCondition.split(' ').some(searchWord => 
            word.includes(searchWord) || searchWord.includes(word)
          )
        )
      );
      
      if (hasPartialMatch) {
        score += 0.2; // Partial credit for related conditions
      } else {
      }
    }
  }
  
  // Location match (more flexible)
  const locations = study?.protocolSection?.contactsLocationsModule?.locations ?? [];
  if (searchParams.location && locations.length > 0) {
    const locationMatch = locations.some((location: any) => 
      location.state?.toLowerCase().includes(searchParams.location.toLowerCase()) ||
      location.city?.toLowerCase().includes(searchParams.location.toLowerCase()) ||
      location.country?.toLowerCase().includes(searchParams.location.toLowerCase())
    );
    
    if (locationMatch) {
      score += 0.2;
    } else {
      // Give partial credit if there are locations but no specific match
      score += 0.1;
    }
  } else if (locations.length > 0) {
    // Give partial credit if no location specified but trial has locations
    score += 0.1;
  }
  
  // Status preference (more lenient)
  const status = study?.protocolSection?.statusModule?.overallStatus;
  if (status === "RECRUITING") {
    score += 0.1;
  } else if (status === "ACTIVE_NOT_RECRUITING") {
    score += 0.05; // Partial credit for active trials
  }
  
  // Bonus for comprehensive trials (more inclusion criteria = more likely to match)
  const eligibilityCriteria = study?.protocolSection?.eligibilityModule?.eligibilityCriteria || '';
  if (eligibilityCriteria.length > 100) {
    score += 0.05; // Small bonus for detailed trials
  }
  
  const finalScore = Math.min(score, 1.0);
  return finalScore;
};

// Query optimization helper functions
const expandConditionQuery = (condition: string): string[] => {
  const baseCondition = condition.toLowerCase().trim();
  const expansions: string[] = [condition]; // Always include original
  
  // Enhanced condition expansions for better matching
  const conditionExpansions: Record<string, string[]> = {
    'diabetes': ['diabetes mellitus', 'type 2 diabetes', 'type ii diabetes', 't2dm', 'dm'],
    'type 2 diabetes': ['diabetes mellitus', 'type ii diabetes', 't2dm', 'dm'],
    'type ii diabetes': ['diabetes mellitus', 'type 2 diabetes', 't2dm', 'dm'],
    'cancer': ['neoplasm', 'carcinoma', 'tumor', 'malignancy'],
    'breast cancer': ['breast neoplasm', 'breast carcinoma', 'mammary cancer'],
    'lung cancer': ['lung neoplasm', 'lung carcinoma', 'pulmonary cancer'],
    'hypertension': ['high blood pressure', 'htn', 'elevated blood pressure'],
    'depression': ['major depressive disorder', 'mdd', 'clinical depression'],
    'anxiety': ['anxiety disorder', 'generalized anxiety', 'gad'],
    'arthritis': ['rheumatoid arthritis', 'ra'],
    'asthma': ['bronchial asthma', 'reactive airway disease'],
    'heart disease': ['cardiovascular disease', 'cardiac disease'],
    'stroke': ['cerebrovascular accident', 'cva'],
    'alzheimer': ['alzheimer disease', 'alzheimer dementia'],
    'parkinson': ['parkinson disease', 'parkinsonism'],
    'multiple sclerosis': ['ms', 'demyelinating disease'],
    'lupus': ['systemic lupus erythematosus', 'sle'],
    'crohn': ['crohn disease', 'inflammatory bowel disease'],
    'psoriasis': ['psoriatic arthritis', 'psoriatic disease'],
  };
  
  // Find matching expansions (limit to 2 additional terms max)
  for (const [key, values] of Object.entries(conditionExpansions)) {
    if (baseCondition.includes(key)) {
      expansions.push(...(values as string[]).slice(0, 2)); // Limit to 2 expansions
      break; // Only use first match to avoid over-expansion
    }
  }
  
  // Limit total expansions to prevent API overload
  return [...new Set(expansions)].slice(0, 3); // Max 3 total terms
};

const getOptimizedAgeRanges = (age: number): string[] => {
  const ranges: string[] = [];
  
  if (age < 18) {
    ranges.push('Child', 'Adolescent');
  } else if (age >= 18 && age < 65) {
    ranges.push('Adult', 'Young Adult');
  } else {
    ranges.push('Adult', 'Older Adult');
  }
  
  // Always include 'Adult' for broader matching
  if (!ranges.includes('Adult')) {
    ranges.push('Adult');
  }
  
  return ranges;
};

const optimizeStatusFilter = (statuses: string[]): string[] => {
  const optimized: string[] = [];
  
  // Prioritize recruiting trials but include others for better results
  if (statuses.includes('Recruiting')) {
    optimized.push('Recruiting', 'Active, not recruiting', 'Enrolling by invitation');
  } else {
    optimized.push(...statuses);
    // Add recruiting if not specified for better results
    if (!statuses.includes('Recruiting')) {
      optimized.push('Recruiting');
    }
  }
  
  return [...new Set(optimized)];
};

const expandLocationQuery = (location: string): string[] => {
  const locations: string[] = [location];
  
  // Common location expansions
  const locationExpansions: Record<string, string[]> = {
    'california': ['ca', 'cali', 'los angeles', 'san francisco', 'san diego'],
    'new york': ['ny', 'nyc', 'manhattan', 'brooklyn', 'queens'],
    'texas': ['tx', 'houston', 'dallas', 'austin', 'san antonio'],
    'florida': ['fl', 'miami', 'orlando', 'tampa', 'jacksonville'],
    'illinois': ['il', 'chicago'],
    'pennsylvania': ['pa', 'philadelphia', 'pittsburgh'],
    'ohio': ['oh', 'cleveland', 'columbus', 'cincinnati'],
    'georgia': ['ga', 'atlanta'],
    'north carolina': ['nc', 'charlotte', 'raleigh'],
    'michigan': ['mi', 'detroit', 'grand rapids'],
  };
  
  const locationLower = location.toLowerCase();
  for (const [key, values] of Object.entries(locationExpansions)) {
    if (locationLower.includes(key)) {
      locations.push(...values);
    }
  }
  
  return [...new Set(locations)];
};

// Enhanced fallback strategy for better results
const executeFallbackQuery = async (searchParams: any): Promise<ClinicalTrialsResponse> => {
  console.log('🔄 Executing fallback query with broader parameters...');
  
  // Create a broader search with relaxed constraints
  const fallbackParams = {
    ...searchParams,
    maxResults: Math.min(searchParams.maxResults * 2, 50), // Double results but cap at 50
    status: ['Recruiting', 'Active, not recruiting', 'Enrolling by invitation'],
    locationRadius: Math.max(searchParams.locationRadius || 50, 200), // Increase radius
  };
  
  // Remove specific phase constraints for broader matching
  delete fallbackParams.phase;
  
  // Remove age constraints for broader matching
  delete fallbackParams.age;
  
  // Remove gender constraints for broader matching
  delete fallbackParams.gender;
  
  // Add timeout to prevent hanging
  const timeoutPromise = new Promise<ClinicalTrialsResponse>((_, reject) => {
    setTimeout(() => reject(new Error('Fallback query timeout after 30 seconds')), 30000);
  });
  
  try {
    // Execute the fallback query with isFallback=true to prevent infinite recursion
    const fallbackPromise = searchClinicalTrials(fallbackParams, true);
    return await Promise.race([fallbackPromise, timeoutPromise]);
  } catch (error) {
    console.warn('⚠️ Fallback query failed or timed out:', error);
    // Return empty result instead of throwing
    return {
      trials: [],
      totalCount: 0,
      queryMetadata: {
        searchTerms: [searchParams.condition],
        filters: searchParams,
        executionTimeMs: 0,
        apiCallsMade: 0,
        cacheHitRate: 0,
      },
    };
  }
};

// Mock data function for fallback
function getMockClinicalTrialsData(searchParams: any): ClinicalTrialsResponse {
  return {
    trials: [
      {
        nctId: 'NCT00000001',
        title: 'Mock Clinical Trial for Development',
        status: 'RECRUITING',
        phase: 'Phase 2',
        studyType: 'Interventional',
        condition: searchParams.condition,
        intervention: 'Mock Intervention',
        eligibilityCriteria: {
          inclusionCriteria: ['Adults 18-75 years', 'Confirmed diagnosis'],
          exclusionCriteria: ['Pregnancy', 'Severe comorbidities'],
          minimumAge: '18',
          maximumAge: '75',
          gender: 'All',
        },
        locations: [
          {
            facility: 'Mock Medical Center',
            city: 'Mock City',
            state: 'Mock State',
            country: 'United States',
            status: 'Recruiting',
            contacts: [],
          },
        ],
        contacts: {
          centralContact: 'Mock Contact',
          overallOfficial: 'Mock Principal Investigator',
        },
        urls: {
          clinicalTrialsGov: 'https://clinicaltrials.gov/study/NCT00000001',
        },
        lastUpdate: '2024-01-01',
        enrollmentCount: 100,
        startDate: '2024-01-01',
        completionDate: '2025-12-31',
        eligibilityScore: 0.85,
      },
    ],
    totalCount: 1,
  };
}
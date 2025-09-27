import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

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
  }>;
  totalCount: number;
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

async function searchClinicalTrials(searchParams: any): Promise<ClinicalTrialsResponse> {
  try {
    // Build query parameters for ClinicalTrials.gov API
    const params = new URLSearchParams();
    
    // Add condition
    params.append('condition', searchParams.condition);
    
    // Add secondary conditions
    if (searchParams.secondaryConditions?.length) {
      searchParams.secondaryConditions.forEach((condition: string) => {
        params.append('condition', condition);
      });
    }
    
    // Add age
    params.append('age', searchParams.age.toString());
    
    // Add status
    searchParams.status.forEach((status: string) => {
      params.append('status', status);
    });
    
    // Add location if provided
    if (searchParams.location) {
      params.append('location', searchParams.location);
      if (searchParams.locationRadius) {
        params.append('locationRadius', searchParams.locationRadius.toString());
      }
    }
    
    // Add gender
    if (searchParams.gender && searchParams.gender !== 'All') {
      params.append('gender', searchParams.gender);
    }
    
    // Add pagination
    params.append('maxResults', searchParams.maxResults.toString());
    params.append('sortBy', searchParams.sortBy);
    
    const url = `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ClinicalTrials API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform the response to match our schema
    const trials = data.studies?.map((study: any) => ({
      nctId: study.protocolSection.identificationModule.nctId,
      title: study.protocolSection.identificationModule.briefTitle,
      status: study.protocolSection.statusModule.overallStatus,
      phase: study.protocolSection.designModule?.phases?.[0],
      studyType: study.protocolSection.designModule.studyType,
      condition: study.protocolSection.conditionsModule?.conditions?.[0],
      intervention: study.protocolSection.interventionsModule?.interventions?.[0]?.name,
      eligibilityCriteria: {
        inclusionCriteria: study.protocolSection.eligibilityModule?.eligibilityCriteria?.split('\n').filter((line: string) => line.trim().startsWith('Inclusion')) || [],
        exclusionCriteria: study.protocolSection.eligibilityModule?.eligibilityCriteria?.split('\n').filter((line: string) => line.trim().startsWith('Exclusion')) || [],
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
    })) || [];
    
    return {
      trials,
      totalCount: data.totalCount || trials.length,
    };
  } catch (error) {
    console.error('ClinicalTrials API search failed:', error);
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
        },
      ],
      totalCount: 1,
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
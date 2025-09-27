import { createTool } from "@mastra/core";
import { z } from "zod";

/**
 * ClinicalTrials.gov API v2 integration.
 * Implements evidence-driven trial discovery aligned with the design principles.
 */

// -----------------------------
// Shared Zod Schemas
// -----------------------------
export const TrialLocationSchema = z.object({
  facility: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  status: z.string().optional(),
  contacts: z.array(
    z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    })
  ).default([]),
});

export const TrialSchema = z.object({
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
  locations: z.array(TrialLocationSchema),
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
});

export const ClinicalTrialsResponseSchema = z.object({
  trials: z.array(TrialSchema),
  totalCount: z.number(),
  queryMetadata: z.object({
    searchTerms: z.string(),
    filters: z.record(z.any()),
    executionTimeMs: z.number(),
  }),
});

const TrialDetailsResponseSchema = z.object({
  trials: z.array(z.any()),
  fetchedCount: z.number(),
  requestedCount: z.number(),
});

const buildQueryTerms = (primary: string, secondary: string[] = []) => {
  const terms = [primary.trim(), ...secondary.map((term) => term.trim())].filter(Boolean);
  return terms.length > 0 ? terms.join(" OR ") : primary;
};

const mapEligibilityCriteria = (raw: string) => {
  if (!raw) {
    return { inclusionCriteria: [], exclusionCriteria: [] };
  }

  const normalised = raw.replace(/\r/g, "").trim();
  const [inclusionBlockRaw, exclusionBlockRaw] = normalised
    .split(/Exclusion Criteria:/i)
    .map((section) => section?.trim() ?? "");

  const inclusionBlock = inclusionBlockRaw.split(/Inclusion Criteria:/i)[1] ?? inclusionBlockRaw;
  const inclusionCriteria = inclusionBlock
    .split(/\n+/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  const exclusionCriteria = exclusionBlockRaw
    .split(/\n+/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  return { inclusionCriteria, exclusionCriteria };
};

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

// -----------------------------
// ClinicalTrials.gov Search Tool
// -----------------------------
export const clinicalTrialsApiTool = createTool({
  id: "clinicalTrialsSearch",
  description:
    "Search ClinicalTrials.gov for relevant trials with condition, status, and proximity filters.",
  inputSchema: z.object({
    condition: z.string().min(1, "Condition is required"),
    secondaryConditions: z.array(z.string()).optional(),
    age: z.number().int().positive().optional(),
    gender: z.enum(["All", "Male", "Female"]).default("All"),
    status: z
      .array(
        z.enum([
          "RECRUITING",
          "ACTIVE_NOT_RECRUITING",
          "ENROLLING_BY_INVITATION",
          "COMPLETED",
          "SUSPENDED",
          "TERMINATED",
          "WITHDRAWN",
        ])
      )
      .default(["RECRUITING", "ACTIVE_NOT_RECRUITING"]),
    location: z.string().optional(),
    locationRadius: z.number().default(100),
    phase: z.array(z.string()).optional(),
    interventionType: z.array(z.string()).optional(),
    maxResults: z.number().default(20),
    sortBy: z.enum(["relevance", "lastUpdate", "enrollmentCount", "startDate"]).default("relevance"),
  }),
  outputSchema: ClinicalTrialsResponseSchema,
  execute: async (ctx) => {
    const {
      context: {
        condition,
        secondaryConditions = [],
        age,
        gender = "All",
        status,
        location,
        locationRadius = 100,
        phase,
        interventionType,
        maxResults = 20,
        sortBy = "relevance",
      },
    } = ctx;

    const startTime = Date.now();
    const baseUrl = "https://clinicaltrials.gov/api/v2/studies";

    const params = new URLSearchParams({
      format: "json",
      pageSize: String(maxResults),
      sortBy,
    });

    params.append("query.cond", buildQueryTerms(condition, secondaryConditions));

    if (status?.length) {
      params.append("query.recr", status.join(","));
    }

    if (age !== undefined) {
      const bucket = age < 18 ? "Child" : age >= 65 ? "Older Adult" : "Adult";
      params.append("query.age", bucket);
    }

    if (gender !== "All") {
      params.append("query.gndr", gender);
    }

    if (location) {
      params.append("query.locn", location);
      params.append("distance", String(locationRadius));
    }

    if (phase?.length) {
      params.append("query.phase", phase.join(","));
    }

    if (interventionType?.length) {
      params.append("query.intr", interventionType.join(","));
    }

    try {
      const response = await fetch(`${baseUrl}?${params.toString()}`, {
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

      const trials = studies.map((study: any) => {
        const rawEligibility = study?.protocolSection?.eligibilityModule?.eligibilityCriteria ?? "";
        const { inclusionCriteria, exclusionCriteria } = mapEligibilityCriteria(rawEligibility);

        return {
          nctId: study?.protocolSection?.identificationModule?.nctId ?? "",
          title: study?.protocolSection?.identificationModule?.briefTitle ?? undefined,
          status: study?.protocolSection?.statusModule?.overallStatus ?? undefined,
          phase: study?.protocolSection?.designModule?.phases?.[0] ?? undefined,
          studyType: study?.protocolSection?.designModule?.studyType ?? undefined,
          condition: study?.protocolSection?.conditionsModule?.conditions?.[0] ?? condition,
          intervention: study?.protocolSection?.armsInterventionsModule?.interventions?.[0]?.name ?? undefined,
          eligibilityCriteria: {
            inclusionCriteria,
            exclusionCriteria,
            minimumAge: study?.protocolSection?.eligibilityModule?.minimumAge ?? undefined,
            maximumAge: study?.protocolSection?.eligibilityModule?.maximumAge ?? undefined,
            gender: study?.protocolSection?.eligibilityModule?.sex ?? undefined,
          },
          locations: mapStudyLocations(study),
          contacts: {
            centralContact:
              study?.protocolSection?.contactsLocationsModule?.centralContacts?.[0]?.name ?? undefined,
            overallOfficial:
              study?.protocolSection?.contactsLocationsModule?.overallOfficials?.[0]?.name ?? undefined,
          },
          urls: {
            clinicalTrialsGov: `https://clinicaltrials.gov/study/${study?.protocolSection?.identificationModule?.nctId}`,
            studyWebsite:
              study?.protocolSection?.identificationModule?.secondaryIdInfos?.find(
                (id: any) => id?.type === "Other"
              )?.id ?? undefined,
          },
          lastUpdate: study?.protocolSection?.statusModule?.lastUpdateSubmitDate ?? undefined,
          enrollmentCount: study?.protocolSection?.designModule?.enrollmentInfo?.count ?? undefined,
          startDate: study?.protocolSection?.statusModule?.startDateStruct?.date ?? undefined,
          completionDate: study?.protocolSection?.statusModule?.completionDateStruct?.date ?? undefined,
        };
      });

      return ClinicalTrialsResponseSchema.parse({
        trials,
        totalCount: data?.totalCount ?? trials.length,
        queryMetadata: {
          searchTerms: buildQueryTerms(condition, secondaryConditions),
          filters: {
            status,
            location,
            age,
            phase,
            interventionType,
          },
          executionTimeMs: Date.now() - startTime,
        },
      });
    } catch (error) {
      if (process.env.MASTRA_MOCK_MODE === "true") {
        return ClinicalTrialsResponseSchema.parse({
          trials: [
            {
              nctId: "NCT00000000",
              title: "Mock Trial for Offline Demo",
              status: "RECRUITING",
              phase: "Phase 3",
              studyType: "Interventional",
              condition,
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
              locations: [
                {
                  facility: "Mock Clinical Research Center",
                  city: "Atlanta",
                  state: "GA",
                  country: "USA",
                  status: "RECRUITING",
                  contacts: [
                    {
                      name: "Dr. Demo Researcher",
                      phone: "404-555-1000",
                      email: "demo@trialify.health",
                    },
                  ],
                },
              ],
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
            },
          ],
          totalCount: 1,
          queryMetadata: {
            searchTerms: buildQueryTerms(condition, secondaryConditions),
            filters: {
              status,
              location,
              age,
              phase,
              interventionType,
            },
            executionTimeMs: Date.now() - startTime,
          },
        });
      }

      console.error("ClinicalTrials.gov search failed", error);
      throw error;
    }
  },
});

// -----------------------------
// ClinicalTrials.gov Detail Tool
// -----------------------------
export const clinicalTrialDetailsTool = createTool({
  id: "clinicalTrialDetails",
  description: "Retrieve detailed information for specific ClinicalTrials.gov NCT IDs.",
  inputSchema: z.object({
    nctIds: z.array(z.string().min(1)).min(1, "Provide at least one NCT ID"),
    includeResults: z.boolean().default(false),
  }),
  outputSchema: TrialDetailsResponseSchema,
  execute: async (ctx) => {
    const {
      context: { nctIds, includeResults = false },
    } = ctx;

    const baseUrl = "https://clinicaltrials.gov/api/v2/studies";
    const params = new URLSearchParams({
      format: "json",
      pageSize: String(nctIds.length),
      query: nctIds.map((id) => `NCT_ID:${id}`).join(" OR "),
    });

    if (includeResults) {
      params.append(
        "fields",
        "NCTId,BriefTitle,DetailedDescription,Condition,InterventionName,Phase,StudyType,OverallStatus,StartDate,CompletionDate,EnrollmentCount,EligibilityCriteria,Location,ResultsFirstSubmitDate,HasResults"
      );
    }

    try {
      const response = await fetch(`${baseUrl}?${params.toString()}`, {
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
      const trials = data?.studies ?? [];

      return TrialDetailsResponseSchema.parse({
        trials,
        fetchedCount: trials.length,
        requestedCount: nctIds.length,
      });
    } catch (error) {
      if (process.env.MASTRA_MOCK_MODE === "true") {
        return TrialDetailsResponseSchema.parse({
          trials: [
            {
              nctId: nctIds[0],
              mock: true,
              description: "Offline mock trial details payload",
            },
          ],
          fetchedCount: 1,
          requestedCount: nctIds.length,
        });
      }

      console.error("ClinicalTrials.gov detail lookup failed", error);
      throw error;
    }
  },
});

import { createTool } from "@mastra/core";
import { z } from "zod";

/**
 * ICD-10-CM lookup tool wrapping the NLM ClinicalTables API.
 */

const ICD10ResultSchema = z.object({
  code: z.string(),
  description: z.string(),
  score: z.number().optional(),
});

const ICD10LookupResponseSchema = z.object({
  query: z.string(),
  results: z.array(ICD10ResultSchema),
  fetchedAt: z.string(),
});

export type ICD10LookupResponse = z.infer<typeof ICD10LookupResponseSchema>;

export const icd10LookupTool = createTool({
  id: "icd10DiagnosisLookup",
  description: "Convert free-text diagnoses into ICD-10-CM codes using the NLM ClinicalTables API.",
  inputSchema: z.object({
    diagnosisText: z.string().min(2, "Provide at least two characters"),
    maxResults: z.number().int().positive().max(20).default(10),
  }),
  outputSchema: ICD10LookupResponseSchema,
  execute: async (ctx) => {
    const {
      context: { diagnosisText, maxResults = 10 },
    } = ctx;

    const params = new URLSearchParams({
      sf: "code,name",
      terms: diagnosisText,
      maxList: String(maxResults),
    });

    const endpoint = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search";

    try {
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        headers: { "User-Agent": "Trialify-Clinical-Navigator/1.0" },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`ICD-10 lookup failed: ${response.status}`);
      }

      const payload = await response.json();
      const resultsRaw: any[] = Array.isArray(payload?.[3]) ? payload[3] : [];

      const results = resultsRaw.map((entry) => ({
        code: entry?.[0] ?? "",
        description: entry?.[1] ?? "",
        score: typeof entry?.[2] === "number" ? entry[2] : undefined,
      }));

      return ICD10LookupResponseSchema.parse({
        query: diagnosisText,
        results,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (process.env.MASTRA_MOCK_MODE === "true") {
        return ICD10LookupResponseSchema.parse({
          query: diagnosisText,
          results: [
            { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
            { code: "I10", description: "Essential (primary) hypertension" },
          ],
          fetchedAt: new Date().toISOString(),
        });
      }

      console.error("ICD-10 lookup failure", error);
      throw error;
    }
  },
});

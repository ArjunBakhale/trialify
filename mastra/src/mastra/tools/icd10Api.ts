import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const ICD10_API_URL = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search";

export const icd10LookupTool = createTool({
  id: "icd10-diagnosis-lookup",
  description: "Convert diagnosis text to ICD-10 codes via the NLM Clinical Tables API",
  inputSchema: z.object({
    diagnosis_text: z.string().min(3, "Diagnosis text must be at least 3 characters"),
    maxResults: z.number().int().positive().max(25).default(5),
  }),
  outputSchema: z.object({
    diagnosis: z.string(),
    matches: z.array(
      z.object({
        code: z.string(),
        description: z.string(),
        score: z.number().optional(),
      })
    ),
    selectedCode: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const searchParams = new URLSearchParams({
      terms: context.diagnosis_text,
      maxList: String(context.maxResults ?? 5),
      sf: "code,name",
    });

    try {
      const response = await fetch(`${ICD10_API_URL}?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(`ICD-10 API returned ${response.status}`);
      }

      const data = (await response.json()) as [unknown, string[], string[][]];
      const matches = data?.[2] ?? [];

      const formattedMatches = matches.map((match) => ({
        code: match?.[0] ?? "UNKNOWN",
        description: match?.[1] ?? "No description provided",
      }));

      return {
        diagnosis: context.diagnosis_text,
        matches: formattedMatches,
        selectedCode: formattedMatches[0]?.code,
      };
    } catch (error) {
      console.error("ICD-10 lookup failed", error);
      return {
        diagnosis: context.diagnosis_text,
        matches: [],
        selectedCode: undefined,
      };
    }
  },
});

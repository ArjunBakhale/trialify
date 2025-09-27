import { createTool } from "@mastra/core";
import { z } from "zod";

/**
 * OpenFDA drug interaction and safety signal lookup.
 */

const DrugSafetySignalSchema = z.object({
  drugName: z.string(),
  brandNames: z.array(z.string()).default([]),
  genericNames: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  adverseReactions: z.array(z.string()).default([]),
  drugInteractions: z.array(z.string()).default([]),
  boxedWarning: z.array(z.string()).optional(),
});

const OpenFDAResponseSchema = z.object({
  query: z.array(z.string()),
  signals: z.array(DrugSafetySignalSchema),
  fetchedAt: z.string(),
});

export type DrugSafetySignal = z.infer<typeof DrugSafetySignalSchema>;
export type OpenFDAResponse = z.infer<typeof OpenFDAResponseSchema>;

const OPEN_FDA_ENDPOINT = "https://api.fda.gov/drug/label.json";

const normaliseDrugName = (name: string) => name.trim().toUpperCase();

const extractArrayField = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
};

const buildSearchParam = (drug: string) =>
  `openfda.brand_name:"${drug}"+OR+openfda.generic_name:"${drug}"+OR+openfda.substance_name:"${drug}"`;

export const openFdaDrugSafetyTool = createTool({
  id: "openFdaDrugSafety",
  description: "Retrieve drug interaction, warning, and safety information from the OpenFDA API.",
  inputSchema: z.object({
    drugNames: z.array(z.string().min(1)).min(1, "Provide at least one drug name"),
    includeBoxedWarning: z.boolean().default(true),
    limitPerDrug: z.number().int().positive().max(3).default(1),
  }),
  outputSchema: OpenFDAResponseSchema,
  execute: async (ctx) => {
    const {
      context: { drugNames, includeBoxedWarning = true, limitPerDrug = 1 },
    } = ctx;

    const queries = drugNames.map(normaliseDrugName);

    try {
      const results = await Promise.all(
        queries.map(async (drugName) => {
          const params = new URLSearchParams({
            search: buildSearchParam(drugName),
            limit: String(limitPerDrug),
          });

          const response = await fetch(`${OPEN_FDA_ENDPOINT}?${params.toString()}`, {
            headers: { "User-Agent": "Trialify-Clinical-Navigator/1.0" },
            signal: AbortSignal.timeout(8000),
          });

          if (!response.ok) {
            throw new Error(`OpenFDA lookup failed for ${drugName}: ${response.status}`);
          }

          const data = await response.json();
          const firstResult = data?.results?.[0];

          if (!firstResult) {
            return {
              drugName,
              brandNames: [],
              genericNames: [],
              warnings: [],
              adverseReactions: [],
              drugInteractions: [],
              boxedWarning: includeBoxedWarning ? [] : undefined,
            } satisfies DrugSafetySignal;
          }

          return {
            drugName,
            brandNames: extractArrayField(firstResult?.openfda?.brand_name),
            genericNames: extractArrayField(firstResult?.openfda?.generic_name),
            warnings: extractArrayField(firstResult?.warnings),
            adverseReactions: extractArrayField(firstResult?.adverse_reactions),
            drugInteractions: extractArrayField(firstResult?.drug_interactions),
            boxedWarning: includeBoxedWarning ? extractArrayField(firstResult?.boxed_warning) : undefined,
          } satisfies DrugSafetySignal;
        })
      );

      return OpenFDAResponseSchema.parse({
        query: drugNames,
        signals: results,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (process.env.MASTRA_MOCK_MODE === "true") {
        return OpenFDAResponseSchema.parse({
          query: drugNames,
          signals: drugNames.map((name) => ({
            drugName: normaliseDrugName(name),
            brandNames: [name.toUpperCase()],
            genericNames: [],
            warnings: ["Mock warning: monitor patient glucose weekly."],
            adverseReactions: ["Mock adverse reaction: dizziness"],
            drugInteractions: ["Mock interaction: avoid combining with strong CYP3A4 inhibitors"],
            boxedWarning: includeBoxedWarning
              ? ["Mock boxed warning: not for use in patients with severe hepatic impairment"]
              : undefined,
          })),
          fetchedAt: new Date().toISOString(),
        });
      }

      console.error("OpenFDA lookup failure", error);
      throw error;
    }
  },
});

import { createTool } from "@mastra/core";
import { z } from "zod";

/**
 * PubMed / NCBI E-Utilities integration for supportive literature retrieval.
 */

const PubMedArticleSchema = z.object({
  pmid: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  journal: z.string().optional(),
  publicationDate: z.string().optional(),
  url: z.string().url().optional(),
});

const PubMedSearchResponseSchema = z.object({
  query: z.string(),
  articles: z.array(PubMedArticleSchema),
  fetchedAt: z.string(),
});

export type PubMedArticle = z.infer<typeof PubMedArticleSchema>;
export type PubMedSearchResponse = z.infer<typeof PubMedSearchResponseSchema>;

const buildArticleUrl = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

const searchEndpoint = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const summaryEndpoint = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

export const pubmedApiTool = createTool({
  id: "pubmedSearch",
  description: "Search PubMed for supporting literature related to clinical trials.",
  inputSchema: z.object({
    query: z.string().min(3, "Provide at least 3 characters"),
    maxResults: z.number().int().positive().max(25).default(5),
    apiKey: z.string().optional(),
  }),
  outputSchema: PubMedSearchResponseSchema,
  execute: async (ctx) => {
    const {
      context: { query, maxResults = 5, apiKey },
    } = ctx;

    const params = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmax: String(maxResults),
      retmode: "json",
      sort: "relevance",
    });

    if (apiKey ?? process.env.NCBI_API_KEY) {
      params.append("api_key", apiKey ?? process.env.NCBI_API_KEY ?? "");
    }

    try {
      const searchResponse = await fetch(`${searchEndpoint}?${params.toString()}`, {
        headers: { "User-Agent": "Trialify-Clinical-Navigator/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!searchResponse.ok) {
        throw new Error(`PubMed search failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const idList: string[] = searchData?.esearchresult?.idlist ?? [];

      if (idList.length === 0) {
        return PubMedSearchResponseSchema.parse({
          query,
          articles: [],
          fetchedAt: new Date().toISOString(),
        });
      }

      const summaryParams = new URLSearchParams({
        db: "pubmed",
        id: idList.join(","),
        retmode: "json",
      });

      if (apiKey ?? process.env.NCBI_API_KEY) {
        summaryParams.append("api_key", apiKey ?? process.env.NCBI_API_KEY ?? "");
      }

      const summaryResponse = await fetch(`${summaryEndpoint}?${summaryParams.toString()}`, {
        headers: { "User-Agent": "Trialify-Clinical-Navigator/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!summaryResponse.ok) {
        throw new Error(`PubMed summary failed: ${summaryResponse.status}`);
      }

      const summaryData = await summaryResponse.json();
      const summaries = summaryData?.result ?? {};

      const articles: PubMedArticle[] = idList
        .map((pmid) => summaries?.[pmid])
        .filter((summary: any) => !!summary)
        .map((summary: any) => ({
          pmid: summary?.uid ?? "",
          title: summary?.title ?? "Untitled Article",
          authors: (summary?.authors ?? []).map((author: any) => author?.name).filter(Boolean),
          journal: summary?.fulljournalname ?? undefined,
          publicationDate: summary?.pubdate ?? undefined,
          url: buildArticleUrl(summary?.uid ?? ""),
        }));

      return PubMedSearchResponseSchema.parse({
        query,
        articles,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (process.env.MASTRA_MOCK_MODE === "true") {
        return PubMedSearchResponseSchema.parse({
          query,
          articles: [
            {
              pmid: "00000000",
              title: "Mock PubMed Article for Offline Demo",
              authors: ["Demo Author, MD"],
              journal: "Demo Journal of Clinical Evidence",
              publicationDate: "2024",
              url: buildArticleUrl("00000000"),
            },
          ],
          fetchedAt: new Date().toISOString(),
        });
      }

      console.error("PubMed API failure", error);
      throw error;
    }
  },
});

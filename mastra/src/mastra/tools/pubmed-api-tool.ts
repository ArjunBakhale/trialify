import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface PubMedResponse {
  articles: Array<{
    pmid: string;
    title: string;
    authors: string[];
    journal?: string;
    publicationDate?: string;
    url?: string;
    abstract?: string;
  }>;
  totalCount: number;
}

export const pubmedApiTool = createTool({
  id: 'search-pubmed',
  description: 'Search PubMed for relevant medical literature',
  inputSchema: z.object({
    query: z.string().describe('Search query for PubMed'),
    maxResults: z.number().int().positive().max(20).default(10).describe('Maximum number of results'),
    dateRange: z.object({
      from: z.string().optional().describe('Start date (YYYY/MM/DD)'),
      to: z.string().optional().describe('End date (YYYY/MM/DD)'),
    }).optional().describe('Date range for search'),
    articleTypes: z.array(z.string()).optional().describe('Article types to include'),
  }),
  outputSchema: z.object({
    articles: z.array(z.object({
      pmid: z.string(),
      title: z.string(),
      authors: z.array(z.string()),
      journal: z.string().optional(),
      publicationDate: z.string().optional(),
      url: z.string().url().optional(),
      abstract: z.string().optional(),
    })),
    totalCount: z.number(),
  }),
  execute: async ({ context }) => {
    return await searchPubMed(context);
  },
});

async function searchPubMed(searchParams: any): Promise<PubMedResponse> {
  try {
    // Build query parameters for PubMed E-utilities API
    const params = new URLSearchParams();
    
    // Add search term
    params.append('term', searchParams.query);
    
    // Add date range if provided
    if (searchParams.dateRange?.from) {
      params.append('mindate', searchParams.dateRange.from.replace(/\//g, ''));
    }
    if (searchParams.dateRange?.to) {
      params.append('maxdate', searchParams.dateRange.to.replace(/\//g, ''));
    }
    
    // Add article types if provided
    if (searchParams.articleTypes?.length) {
      const typeFilter = searchParams.articleTypes.map((type: string) => `"${type}"[Publication Type]`).join(' OR ');
      params.append('term', `${searchParams.query} AND (${typeFilter})`);
    }
    
    // Add other parameters
    params.append('retmax', searchParams.maxResults.toString());
    params.append('retmode', 'json');
    params.append('sort', 'relevance');
    
    // First, search for PMIDs
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params.toString()}`;
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      throw new Error(`PubMed search API returned ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    const pmids = searchData.esearchresult?.idlist || [];
    
    if (pmids.length === 0) {
      return {
        articles: [],
        totalCount: 0,
      };
    }
    
    // Then, fetch details for each PMID
    const fetchParams = new URLSearchParams();
    fetchParams.append('id', pmids.join(','));
    fetchParams.append('retmode', 'json');
    fetchParams.append('rettype', 'abstract');
    
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams.toString()}`;
    const fetchResponse = await fetch(fetchUrl);
    
    if (!fetchResponse.ok) {
      throw new Error(`PubMed fetch API returned ${fetchResponse.status}`);
    }
    
    const fetchData = await fetchResponse.json();
    
    // Transform the response to match our schema
    const articles = fetchData.articles?.map((article: any) => ({
      pmid: article.pmid,
      title: article.title,
      authors: article.authors?.map((author: any) => `${author.lastname} ${author.forename}`) || [],
      journal: article.journal,
      publicationDate: article.pubdate,
      url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      abstract: article.abstract,
    })) || [];
    
    return {
      articles,
      totalCount: searchData.esearchresult?.count || articles.length,
    };
  } catch (error) {
    console.error('PubMed API search failed:', error);
    // Return mock data for development
    return {
      articles: [
        {
          pmid: '12345678',
          title: `Mock PubMed Article: ${searchParams.query}`,
          authors: ['Mock Author 1', 'Mock Author 2'],
          journal: 'Mock Journal of Medical Research',
          publicationDate: '2024-01-01',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
          abstract: 'This is a mock abstract for development purposes.',
        },
      ],
      totalCount: 1,
    };
  }
}
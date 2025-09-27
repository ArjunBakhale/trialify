import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { rateLimiter, cache, monitor } from '../../../config/apiConfig';

/**
 * Enhanced PubMed API tool with real NCBI E-utilities integration
 * Provides comprehensive literature search and article processing capabilities
 */

// -----------------------------
// Enhanced Schemas
// -----------------------------
export const EnhancedArticleSchema = z.object({
  pmid: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  journal: z.string(),
  publicationDate: z.string(),
  abstract: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  relevanceScore: z.number().min(0).max(1),
  url: z.string().url(),
  fullTextAvailable: z.boolean().default(false),
  meshTerms: z.array(z.string()).default([]),
  doi: z.string().optional(),
  citationCount: z.number().optional(),
  impactFactor: z.number().optional(),
});

export const EnhancedPubMedResponseSchema = z.object({
  articles: z.array(EnhancedArticleSchema),
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
const PUBMED_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const API_RATE_LIMIT = 3; // requests per second
const CACHE_TTL = 43200; // 12 hours in seconds
const MAX_QUERIES_PER_SEARCH = 3; // Maximum number of queries per search
const MAX_BIOMARKER_QUERIES = 2; // Maximum biomarker-specific queries
const MAX_PMIDS_PER_QUERY = 5; // Maximum PMIDs to fetch per individual query
const MAX_TOTAL_PMIDS = 8; // Maximum total PMIDs to process across all queries
const MAX_ARTICLES_TO_PROCESS = 6; // Maximum articles to fully process and return

// -----------------------------
// Enhanced Query Building
// -----------------------------
const buildAdvancedPubMedQuery = (searchContext: any) => {
  const queries = [];
  
  // Primary search terms - limit to most important queries
  if (searchContext.condition) {
    queries.push(`${searchContext.condition}[Title/Abstract]`);
  }
  
  // Combine condition and intervention (most important query)
  if (searchContext.condition && searchContext.intervention) {
    queries.push(`${searchContext.condition} AND ${searchContext.intervention}[Title/Abstract]`);
  }
  
  // Add clinical trial specific search (high priority)
  if (searchContext.condition) {
    queries.push(`${searchContext.condition} clinical trial[Title/Abstract]`);
  }
  
  // Limit biomarker searches to first N biomarkers only
  if (searchContext.biomarkers?.length > 0) {
    const limitedBiomarkers = searchContext.biomarkers.slice(0, MAX_BIOMARKER_QUERIES);
    limitedBiomarkers.forEach((biomarker: string) => {
      if (searchContext.condition && queries.length < MAX_QUERIES_PER_SEARCH) {
        queries.push(`${biomarker} ${searchContext.condition} prognosis[Title/Abstract]`);
      }
    });
  }
  
  // Add recent publications filter (last 2 years) - only if we have space
  if (queries.length < MAX_QUERIES_PER_SEARCH && searchContext.condition) {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    queries.push(`${searchContext.condition} ${lastYear}:${currentYear}[dp]`);
  }
  
  // Ensure we never exceed the maximum queries total
  return queries.slice(0, MAX_QUERIES_PER_SEARCH);
};

// -----------------------------
// Enhanced Article Processing
// -----------------------------
const processArticle = async (pmid: string, context: any) => {
  try {
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay between requests
    
    // Get article details
    const articleResponse = await fetch(
      `${PUBMED_BASE_URL}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml&rettype=abstract`
    );
    
    if (!articleResponse.ok) {
      if (articleResponse.status === 429) {
        console.warn(`⚠️ Rate limited for PMID ${pmid}, waiting 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Retry once
        const retryResponse = await fetch(
          `${PUBMED_BASE_URL}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml&rettype=abstract`
        );
        if (!retryResponse.ok) {
          throw new Error(`PubMed API returned ${retryResponse.status} after retry`);
        }
        const articleXml = await retryResponse.text();
        const article = parseArticleXML(articleXml);
        const relevanceScore = calculateRelevanceScore(article, context);
        const fullTextAvailable = await checkFullTextAvailability(pmid);
        
        return {
          pmid,
          title: article.title,
          authors: article.authors,
          journal: article.journal,
          publicationDate: article.publicationDate,
          abstract: article.abstract,
          keywords: [], // Keywords not extracted from XML
          relevanceScore,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          fullTextAvailable,
          meshTerms: article.meshTerms || [],
          doi: article.doi,
        };
      }
      throw new Error(`PubMed API returned ${articleResponse.status}`);
    }
    
    const articleXml = await articleResponse.text();
    const article = parseArticleXML(articleXml);
    
    // Calculate relevance score
    const relevanceScore = calculateRelevanceScore(article, context);
    
    // Check for full text availability
    const fullTextAvailable = await checkFullTextAvailability(pmid);
    
    return {
      pmid,
      title: article.title,
      authors: article.authors,
      journal: article.journal,
      publicationDate: article.publicationDate,
      abstract: article.abstract,
          keywords: [], // Keywords not extracted from XML
      relevanceScore,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      fullTextAvailable,
      meshTerms: article.meshTerms,
      doi: article.doi,
    };
  } catch (error) {
    console.error(`Error processing article ${pmid}:`, error);
    return null;
  }
};

const parseArticleXML = (xml: string) => {
  // Simple XML parsing for PubMed response
  // In production, use a proper XML parser like xml2js
  const titleMatch = xml.match(/<ArticleTitle[^>]*>([^<]+)<\/ArticleTitle>/);
  const abstractMatch = xml.match(/<AbstractText[^>]*>([^<]+)<\/AbstractText>/);
  const journalMatch = xml.match(/<Title[^>]*>([^<]+)<\/Title>/);
  const dateMatch = xml.match(/<PubDate[^>]*>.*?<Year>(\d{4})<\/Year>.*?<\/PubDate>/s);
  
  // Extract authors
  const authorMatches = xml.match(/<Author[^>]*>.*?<LastName>([^<]+)<\/LastName>.*?<ForeName>([^<]+)<\/ForeName>.*?<\/Author>/gs);
  const authors = authorMatches ? authorMatches.map(match => {
    const lastNameMatch = match.match(/<LastName>([^<]+)<\/LastName>/);
    const foreNameMatch = match.match(/<ForeName>([^<]+)<\/ForeName>/);
    return `${foreNameMatch?.[1] || ''} ${lastNameMatch?.[1] || ''}`.trim();
  }) : [];
  
  // Extract MeSH terms
  const meshMatches = xml.match(/<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g);
  const meshTerms = meshMatches ? meshMatches.map(match => 
    match.replace(/<\/?DescriptorName[^>]*>/g, '')
  ) : [];
  
  // Extract DOI
  const doiMatch = xml.match(/<ELocationID[^>]*EIdType="doi"[^>]*>([^<]+)<\/ELocationID>/);
  
  return {
    title: titleMatch?.[1] || 'No title available',
    abstract: abstractMatch?.[1] || '',
    journal: journalMatch?.[1] || 'Unknown journal',
    publicationDate: dateMatch?.[1] || new Date().getFullYear().toString(),
    authors,
    meshTerms,
    doi: doiMatch?.[1] || undefined,
  };
};

const calculateRelevanceScore = (article: any, context: any) => {
  let score = 0;
  
  // Title relevance
  if (article.title.toLowerCase().includes(context.condition?.toLowerCase() || '')) {
    score += 0.3;
  }
  
  // Abstract relevance
  if (article.abstract?.toLowerCase().includes(context.intervention?.toLowerCase() || '')) {
    score += 0.4;
  }
  
  // Recency bonus
  const pubDate = new Date(article.publicationDate);
  const yearsAgo = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (yearsAgo < 2) score += 0.2;
  if (yearsAgo < 1) score += 0.1;
  
  // MeSH terms relevance
  const relevantMeshTerms = ['Clinical Trial', 'Randomized Controlled Trial', 'Meta-Analysis'];
  const hasRelevantMesh = article.meshTerms?.some((term: string) => 
    relevantMeshTerms.some(relevant => term.toLowerCase().includes(relevant.toLowerCase()))
  );
  if (hasRelevantMesh) score += 0.1;
  
  return Math.min(score, 1.0);
};

const checkFullTextAvailability = async (pmid: string): Promise<boolean> => {
  try {
    // Check PMC for full text availability
    const pmcResponse = await fetch(
      `${PUBMED_BASE_URL}/elink.fcgi?dbfrom=pubmed&id=${pmid}&db=pmc&retmode=json`
    );
    
    if (pmcResponse.ok) {
      const pmcData = await pmcResponse.json();
      return pmcData?.linksets?.[0]?.linksetdbs?.[0]?.links?.length > 0;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking full text availability for ${pmid}:`, error);
    return false;
  }
};

// -----------------------------
// Enhanced PubMed API Tool
// -----------------------------
export const enhancedPubMedApiTool = createTool({
  id: "enhancedPubMedSearch",
  description: "Enhanced PubMed search with real NCBI E-utilities integration, relevance scoring, and comprehensive article processing",
  inputSchema: z.object({
    searchContext: z.object({
      condition: z.string().optional(),
      intervention: z.string().optional(),
      biomarkers: z.array(z.string()).default([]),
      age: z.number().optional(),
      gender: z.string().optional(),
    }),
    searchOptions: z.object({
      maxResults: z.number().default(10),
      includeAbstracts: z.boolean().default(true),
      includeFullText: z.boolean().default(false),
      minRelevanceScore: z.number().min(0).max(1).default(0.3),
      publicationDateRange: z.object({
        startYear: z.number().optional(),
        endYear: z.number().optional(),
      }).optional(),
    }).optional(),
  }),
  outputSchema: EnhancedPubMedResponseSchema,
  execute: async (ctx) => {
    const { searchContext, searchOptions = {} } = ctx.context;
    const startTime = Date.now();
    
    // Add timeout protection to prevent hanging queries
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('PubMed search timeout after 60 seconds')), 60000);
    });
    
    const searchPromise = (async () => {
    
    // Build cache key
    const cacheKey = `pubmed_${JSON.stringify({ searchContext, searchOptions })}`;
    
    // Check cache first
    const cachedResult = cache.get(cacheKey, CACHE_TTL);
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
      console.log('🌐 Using real PubMed API');
      
      // Apply rate limiting
      await rateLimiter.waitIfNeeded('pubmed', API_RATE_LIMIT);
      
      // Build advanced queries
      const queries = buildAdvancedPubMedQuery(searchContext);
      
      // Execute searches sequentially to avoid rate limiting
      const searchResults = [];
      console.log(`🔍 Executing ${queries.length} PubMed queries (max: ${MAX_QUERIES_PER_SEARCH})`);
      for (const query of queries.slice(0, MAX_QUERIES_PER_SEARCH)) {
        try {
          await rateLimiter.waitIfNeeded('pubmed', API_RATE_LIMIT);
          
          const searchResponse = await fetch(
            `${PUBMED_BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${MAX_PMIDS_PER_QUERY}&retmode=json`,
            {
              headers: { 'User-Agent': 'Trialify-PubMed-Client/1.0' },
              signal: AbortSignal.timeout(10000),
            }
          );
          
          if (!searchResponse.ok) {
            if (searchResponse.status === 429) {
              console.warn(`⚠️ Rate limited for query "${query}", waiting 3 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
              continue; // Skip this query and continue with others
            }
            throw new Error(`PubMed search API returned ${searchResponse.status}`);
          }
          
          const result = await searchResponse.json();
          searchResults.push(result);
          
          // Add delay between queries
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.warn(`⚠️ Failed to execute query "${query}":`, error instanceof Error ? error.message : String(error));
          // Continue with other queries instead of failing completely
        }
      }
      
      // Combine and deduplicate PMIDs
      const allPmids = new Set<string>();
      searchResults.forEach(result => {
        result.esearchresult?.idlist?.forEach((pmid: string) => allPmids.add(pmid));
      });
      
      const uniquePmids = Array.from(allPmids).slice(0, MAX_TOTAL_PMIDS);
      console.log(`📋 Processing ${uniquePmids.length} unique PMIDs (max: ${MAX_TOTAL_PMIDS})`);
      
      // Process articles sequentially to avoid rate limiting
      const articles = [];
      for (const pmid of uniquePmids) {
        try {
          const article = await processArticle(pmid, searchContext);
          if (article) {
            articles.push(article);
          }
          
          // Stop processing if we've reached the maximum articles to return
          if (articles.length >= MAX_ARTICLES_TO_PROCESS) {
            console.log(`🛑 Reached maximum articles limit (${MAX_ARTICLES_TO_PROCESS}), stopping processing`);
            break;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to process article ${pmid}:`, error instanceof Error ? error.message : String(error));
          // Continue processing other articles instead of failing completely
        }
      }
      
      // Filter by relevance score
      const filteredArticles = articles.filter(article => 
        article.relevanceScore >= ((searchOptions as any)?.minRelevanceScore || 0.3)
      );
      
      // Sort by relevance score and limit final results
      filteredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);
      const finalArticles = filteredArticles.slice(0, MAX_ARTICLES_TO_PROCESS);
      
      console.log(`📊 Final results: ${finalArticles.length} articles (filtered from ${filteredArticles.length}, max: ${MAX_ARTICLES_TO_PROCESS})`);
      
      const result = {
        articles: finalArticles,
        totalCount: finalArticles.length,
        queryMetadata: {
          searchTerms: queries,
          filters: {
            condition: searchContext.condition,
            intervention: searchContext.intervention,
            biomarkers: searchContext.biomarkers,
            maxResults: (searchOptions as any)?.maxResults,
            minRelevanceScore: (searchOptions as any)?.minRelevanceScore,
          },
          executionTimeMs: Date.now() - startTime,
          apiCallsMade: searchResults.length + articles.length,
          cacheHitRate: 0,
        },
      };
      
      // Cache the result
      cache.set(cacheKey, result);
      
      // Record metrics
      monitor.recordRequest('pubmed', true, Date.now() - startTime);
      
      return EnhancedPubMedResponseSchema.parse(result);
      
    } catch (error) {
      console.error('Enhanced PubMed search failed:', error);
      monitor.recordRequest('pubmed', false, Date.now() - startTime);
      monitor.recordError('pubmed', 'api');
      
      // Return empty result instead of mock data for better error handling
      return EnhancedPubMedResponseSchema.parse({
        articles: [],
        totalCount: 0,
        queryMetadata: {
          searchTerms: [searchContext.condition || 'unknown'],
          filters: searchContext,
          executionTimeMs: Date.now() - startTime,
          apiCallsMade: 0,
          cacheHitRate: 0,
        },
      });
    }
    })(); // Close the searchPromise
    
    try {
      return await Promise.race([searchPromise, timeoutPromise]);
    } catch (error) {
      console.error('PubMed search timeout or failed:', error);
      monitor.recordRequest('pubmed', false, Date.now() - startTime);
      monitor.recordError('pubmed', 'api');
      
      // Return empty result for timeout or other errors
      return EnhancedPubMedResponseSchema.parse({
        articles: [],
        totalCount: 0,
        queryMetadata: {
          searchTerms: [searchContext.condition || 'unknown'],
          filters: searchContext,
          executionTimeMs: Date.now() - startTime,
          apiCallsMade: 0,
          cacheHitRate: 0,
        },
      });
    }
  },
});

// -----------------------------
// Additional PubMed Tools
// -----------------------------
export const pubmedArticleDetailsTool = createTool({
  id: "getPubMedArticleDetails",
  description: "Get detailed information for a specific PubMed article",
  inputSchema: z.object({
    pmid: z.string().describe('PubMed ID of the article'),
  }),
  outputSchema: EnhancedArticleSchema,
  execute: async (ctx) => {
    const { pmid } = ctx.context;
    const startTime = Date.now();
    
    try {
      await rateLimiter.waitIfNeeded('pubmed', API_RATE_LIMIT);
      
      const article = await processArticle(pmid, {});
      
      if (!article) {
        throw new Error(`Article ${pmid} not found`);
      }
      
      monitor.recordRequest('pubmed', true, Date.now() - startTime);
      return EnhancedArticleSchema.parse(article);
      
    } catch (error) {
      console.error(`Error getting article details for ${pmid}:`, error);
      monitor.recordRequest('pubmed', false, Date.now() - startTime);
      monitor.recordError('pubmed', 'api');
      throw error;
    }
  },
});

export const pubmedRelatedArticlesTool = createTool({
  id: "getRelatedPubMedArticles",
  description: "Get related articles for a specific PubMed article",
  inputSchema: z.object({
    pmid: z.string().describe('PubMed ID of the article'),
    maxResults: z.number().default(5).describe('Maximum number of related articles'),
  }),
  outputSchema: z.object({
    relatedArticles: z.array(EnhancedArticleSchema),
    totalCount: z.number(),
  }),
  execute: async (ctx) => {
    const { pmid, maxResults = 5 } = ctx.context;
    const startTime = Date.now();
    
    try {
      await rateLimiter.waitIfNeeded('pubmed', API_RATE_LIMIT);
      
      // Get related articles using PubMed's related articles feature
      const relatedResponse = await fetch(
        `${PUBMED_BASE_URL}/elink.fcgi?dbfrom=pubmed&id=${pmid}&db=pubmed&retmode=json&cmd=neighbor`
      );
      
      if (!relatedResponse.ok) {
        throw new Error(`PubMed related articles API returned ${relatedResponse.status}`);
      }
      
      const relatedData = await relatedResponse.json();
      const limitedMaxResults = Math.min(maxResults, MAX_ARTICLES_TO_PROCESS);
      const relatedPmids = relatedData?.linksets?.[0]?.linksetdbs?.[0]?.links?.slice(0, limitedMaxResults) || [];
      
      console.log(`🔗 Processing ${relatedPmids.length} related PMIDs (max: ${limitedMaxResults})`);
      
      // Process related articles sequentially to avoid rate limiting
      const relatedArticles = [];
      for (const relatedPmid of relatedPmids) {
        try {
          const article = await processArticle(relatedPmid, {});
          if (article) {
            relatedArticles.push(article);
          }
          
          // Stop if we've reached the limit
          if (relatedArticles.length >= limitedMaxResults) {
            break;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to process related article ${relatedPmid}:`, error instanceof Error ? error.message : String(error));
          // Continue processing other articles
        }
      }
      
      monitor.recordRequest('pubmed', true, Date.now() - startTime);
      
      return {
        relatedArticles: relatedArticles.map(article => EnhancedArticleSchema.parse(article)),
        totalCount: relatedArticles.length,
      };
      
    } catch (error) {
      console.error(`Error getting related articles for ${pmid}:`, error);
      monitor.recordRequest('pubmed', false, Date.now() - startTime);
      monitor.recordError('pubmed', 'api');
      throw error;
    }
  },
});
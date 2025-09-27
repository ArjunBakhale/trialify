/**
 * API Configuration for Mastra Clinical Trial Navigator
 * Manages the transition from mock data to real API integrations
 */

export interface APIConfig {
  // API Endpoints
  clinicalTrials: {
    baseUrl: string;
    rateLimit: number; // requests per second
    timeout: number; // milliseconds
    cacheTtl: number; // seconds
  };
  
  pubmed: {
    baseUrl: string;
    rateLimit: number;
    timeout: number;
    cacheTtl: number;
  };
  
  icd10: {
    baseUrl: string;
    rateLimit: number;
    timeout: number;
    cacheTtl: number;
  };
  
  openFda: {
    baseUrl: string;
    rateLimit: number;
    timeout: number;
    cacheTtl: number;
  };
  
  // Feature Flags
  features: {
    useRealAPIs: boolean;
    enableCaching: boolean;
    enableRateLimiting: boolean;
    enableMonitoring: boolean;
    enableRAG: boolean;
    enableHumanInTheLoop: boolean;
  };
  
  // API Keys
  apiKeys: {
    clinicalTrials?: string;
    ncbi?: string;
    openFda?: string;
    openai?: string;
  };
}

// Default configuration
export const defaultAPIConfig: APIConfig = {
  clinicalTrials: {
    baseUrl: "https://clinicaltrials.gov/api/v2/studies",
    rateLimit: 3,
    timeout: 15000,
    cacheTtl: 86400, // 24 hours
  },
  
  pubmed: {
    baseUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
    rateLimit: 3,
    timeout: 10000,
    cacheTtl: 43200, // 12 hours
  },
  
  icd10: {
    baseUrl: "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search",
    rateLimit: 5,
    timeout: 8000,
    cacheTtl: 604800, // 7 days
  },
  
  openFda: {
    baseUrl: "https://api.fda.gov/drug/label.json",
    rateLimit: 5,
    timeout: 8000,
    cacheTtl: 86400, // 24 hours
  },
  
  features: {
    useRealAPIs: process.env.MASTRA_MOCK_MODE !== 'true',
    enableCaching: true,
    enableRateLimiting: true,
    enableMonitoring: true,
    enableRAG: true,
    enableHumanInTheLoop: true,
  },
  
  apiKeys: {
    clinicalTrials: process.env.CLINICAL_TRIALS_API_KEY,
    ncbi: process.env.NCBI_API_KEY,
    openFda: process.env.OPENFDA_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  },
};

// Environment-specific configurations
export const getAPIConfig = (): APIConfig => {
  const config = { ...defaultAPIConfig };
  
  // Override with environment variables
  if (process.env.NODE_ENV === 'development') {
    config.features.useRealAPIs = false; // Use mock data in development
    config.features.enableMonitoring = false;
  }
  
  if (process.env.NODE_ENV === 'production') {
    config.features.useRealAPIs = true; // Use real APIs in production
    config.features.enableMonitoring = true;
  }
  
  // Override with explicit environment variables
  if (process.env.MASTRA_MOCK_MODE === 'true') {
    config.features.useRealAPIs = false;
  }
  
  if (process.env.MASTRA_USE_REAL_APIS === 'true') {
    config.features.useRealAPIs = true;
  }
  
  return config;
};

// API Health Check
export const checkAPIHealth = async (config: APIConfig): Promise<{
  clinicalTrials: boolean;
  pubmed: boolean;
  icd10: boolean;
  openFda: boolean;
}> => {
  const healthChecks = {
    clinicalTrials: false,
    pubmed: false,
    icd10: false,
    openFda: false,
  };
  
  if (!config.features.useRealAPIs) {
    return healthChecks; // All APIs are "healthy" in mock mode
  }
  
  try {
    // Check ClinicalTrials.gov API
    const clinicalTrialsResponse = await fetch(
      `${config.clinicalTrials.baseUrl}?format=json&pageSize=1`,
      { 
        signal: AbortSignal.timeout(config.clinicalTrials.timeout),
        headers: { "User-Agent": "Trialify-Health-Check/1.0" }
      }
    );
    healthChecks.clinicalTrials = clinicalTrialsResponse.ok;
  } catch (error) {
    console.warn("ClinicalTrials.gov API health check failed:", error);
  }
  
  try {
    // Check PubMed API
    const pubmedResponse = await fetch(
      `${config.pubmed.baseUrl}/esearch.fcgi?db=pubmed&term=test&retmax=1&retmode=json`,
      { 
        signal: AbortSignal.timeout(config.pubmed.timeout),
        headers: { "User-Agent": "Trialify-Health-Check/1.0" }
      }
    );
    healthChecks.pubmed = pubmedResponse.ok;
  } catch (error) {
    console.warn("PubMed API health check failed:", error);
  }
  
  try {
    // Check ICD-10 API
    const icd10Response = await fetch(
      `${config.icd10.baseUrl}?sf=code,name&terms=diabetes&maxList=1`,
      { 
        signal: AbortSignal.timeout(config.icd10.timeout),
        headers: { "User-Agent": "Trialify-Health-Check/1.0" }
      }
    );
    healthChecks.icd10 = icd10Response.ok;
  } catch (error) {
    console.warn("ICD-10 API health check failed:", error);
  }
  
  try {
    // Check OpenFDA API
    const openFdaResponse = await fetch(
      `${config.openFda.baseUrl}?limit=1`,
      { 
        signal: AbortSignal.timeout(config.openFda.timeout),
        headers: { "User-Agent": "Trialify-Health-Check/1.0" }
      }
    );
    healthChecks.openFda = openFdaResponse.ok;
  } catch (error) {
    console.warn("OpenFDA API health check failed:", error);
  }
  
  return healthChecks;
};

// Rate Limiter Implementation
export class APIRateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  async waitIfNeeded(apiName: string, rateLimit: number): Promise<void> {
    const now = Date.now();
    const apiRequests = this.requests.get(apiName) || [];
    
    // Remove requests older than 1 second
    const recentRequests = apiRequests.filter(time => now - time < 1000);
    
    if (recentRequests.length >= rateLimit) {
      const waitTime = 1000 - (now - recentRequests[0]);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    recentRequests.push(now);
    this.requests.set(apiName, recentRequests);
  }
}

// Cache Implementation
export class APICache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  
  get(key: string, ttl: number): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl * 1000) {
      return cached.data;
    }
    return null;
  }
  
  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

// Monitoring and Metrics
export interface APIMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
  };
  responseTime: {
    average: number;
    min: number;
    max: number;
  };
  errors: {
    timeout: number;
    network: number;
    api: number;
    other: number;
  };
}

export class APIMonitor {
  private metrics: Map<string, APIMetrics> = new Map();
  
  recordRequest(apiName: string, success: boolean, responseTime: number, cached: boolean = false): void {
    const current = this.metrics.get(apiName) || {
      requests: { total: 0, successful: 0, failed: 0, cached: 0 },
      responseTime: { average: 0, min: Infinity, max: 0 },
      errors: { timeout: 0, network: 0, api: 0, other: 0 },
    };
    
    current.requests.total++;
    if (success) {
      current.requests.successful++;
    } else {
      current.requests.failed++;
    }
    if (cached) {
      current.requests.cached++;
    }
    
    // Update response time metrics
    current.responseTime.min = Math.min(current.responseTime.min, responseTime);
    current.responseTime.max = Math.max(current.responseTime.max, responseTime);
    current.responseTime.average = 
      (current.responseTime.average * (current.requests.total - 1) + responseTime) / current.requests.total;
    
    this.metrics.set(apiName, current);
  }
  
  recordError(apiName: string, errorType: 'timeout' | 'network' | 'api' | 'other'): void {
    const current = this.metrics.get(apiName) || {
      requests: { total: 0, successful: 0, failed: 0, cached: 0 },
      responseTime: { average: 0, min: Infinity, max: 0 },
      errors: { timeout: 0, network: 0, api: 0, other: 0 },
    };
    
    current.errors[errorType]++;
    this.metrics.set(apiName, current);
  }
  
  getMetrics(apiName?: string): Map<string, APIMetrics> | APIMetrics | undefined {
    if (apiName) {
      return this.metrics.get(apiName);
    }
    return this.metrics;
  }
  
  reset(): void {
    this.metrics.clear();
  }
}

// Global instances
export const rateLimiter = new APIRateLimiter();
export const cache = new APICache();
export const monitor = new APIMonitor();
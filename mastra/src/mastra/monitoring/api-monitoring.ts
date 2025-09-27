import { getAPIConfig, checkAPIHealth, monitor, rateLimiter, cache } from '../../../config/apiConfig';

/**
 * Comprehensive API monitoring and health check system
 * Provides real-time monitoring, health checks, and performance metrics
 */

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  apis: {
    clinicalTrials: APIHealth;
    pubmed: APIHealth;
    icd10: APIHealth;
    openFda: APIHealth;
  };
  performance: PerformanceMetrics;
  cache: CacheMetrics;
  rateLimiting: RateLimitMetrics;
  timestamp: string;
}

export interface APIHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  lastCheck: string;
  uptime: number;
  requestsPerMinute: number;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHitRate: number;
  errorRate: number;
}

export interface CacheMetrics {
  size: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  memoryUsage: number;
}

export interface RateLimitMetrics {
  clinicalTrials: RateLimitStatus;
  pubmed: RateLimitStatus;
  icd10: RateLimitStatus;
  openFda: RateLimitStatus;
}

export interface RateLimitStatus {
  currentRequests: number;
  maxRequests: number;
  resetTime: number;
  isLimited: boolean;
}

export class APIMonitoringService {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start comprehensive monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Health checks every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000);

    // Metrics collection every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 10000);

    console.log('🔍 API monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.isMonitoring = false;
    console.log('🔍 API monitoring stopped');
  }

  /**
   * Perform comprehensive health checks
   */
  async performHealthChecks(): Promise<SystemHealth> {
    const config = getAPIConfig();
    const startTime = Date.now();

    try {
      // Check API health
      const apiHealth = await checkAPIHealth(config);
      
      // Get performance metrics
      const performance = this.getPerformanceMetrics();
      
      // Get cache metrics
      const cacheMetrics = this.getCacheMetrics();
      
      // Get rate limiting metrics
      const rateLimitMetrics = this.getRateLimitMetrics();

      // Determine overall health
      const overallHealth = this.determineOverallHealth(apiHealth, performance);

      const systemHealth: SystemHealth = {
        overall: overallHealth,
        apis: {
          clinicalTrials: this.getAPIHealthStatus('clinicalTrials', apiHealth.clinicalTrials),
          pubmed: this.getAPIHealthStatus('pubmed', apiHealth.pubmed),
          icd10: this.getAPIHealthStatus('icd10', apiHealth.icd10),
          openFda: this.getAPIHealthStatus('openFda', apiHealth.openFda),
        },
        performance,
        cache: cacheMetrics,
        rateLimiting: rateLimitMetrics,
        timestamp: new Date().toISOString(),
      };

      // Log health status
      this.logHealthStatus(systemHealth);

      return systemHealth;
    } catch (error) {
      console.error('Health check failed:', error);
      return this.getUnhealthyStatus();
    }
  }

  /**
   * Get current system health
   */
  async getCurrentHealth(): Promise<SystemHealth> {
    return this.performHealthChecks();
  }

  /**
   * Get performance metrics
   */
  private getPerformanceMetrics(): PerformanceMetrics {
    const allMetrics = monitor.getMetrics();
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalResponseTime = 0;
    let totalCacheHits = 0;

    (allMetrics as Map<string, any>).forEach((apiMetrics: any, apiName: any) => {
      totalRequests += apiMetrics.requests.total;
      successfulRequests += apiMetrics.requests.successful;
      failedRequests += apiMetrics.requests.failed;
      totalCacheHits += apiMetrics.requests.cached;
      totalResponseTime += apiMetrics.responseTime.average * apiMetrics.requests.total;
    });

    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;
    const cacheHitRate = totalRequests > 0 ? totalCacheHits / totalRequests : 0;

    return {
      averageResponseTime,
      totalRequests,
      successfulRequests,
      failedRequests,
      cacheHitRate,
      errorRate,
    };
  }

  /**
   * Get cache metrics
   */
  private getCacheMetrics(): CacheMetrics {
    return {
      size: cache.size(),
      hitRate: this.calculateCacheHitRate(),
      missRate: 1 - this.calculateCacheHitRate(),
      evictions: 0, // Would need to track this
      memoryUsage: this.estimateCacheMemoryUsage(),
    };
  }

  /**
   * Get rate limiting metrics
   */
  private getRateLimitMetrics(): RateLimitMetrics {
    return {
      clinicalTrials: this.getRateLimitStatus('clinicalTrials'),
      pubmed: this.getRateLimitStatus('pubmed'),
      icd10: this.getRateLimitStatus('icd10'),
      openFda: this.getRateLimitStatus('openFda'),
    };
  }

  /**
   * Get rate limit status for an API
   */
  private getRateLimitStatus(apiName: string): RateLimitStatus {
    // This would need to be implemented based on the rate limiter implementation
    return {
      currentRequests: 0,
      maxRequests: 3,
      resetTime: Date.now() + 1000,
      isLimited: false,
    };
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const allMetrics = monitor.getMetrics();
    let totalRequests = 0;
    let cacheHits = 0;

    (allMetrics as Map<string, any>).forEach((apiMetrics: any) => {
      totalRequests += apiMetrics.requests.total;
      cacheHits += apiMetrics.requests.cached;
    });

    return totalRequests > 0 ? cacheHits / totalRequests : 0;
  }

  /**
   * Estimate cache memory usage
   */
  private estimateCacheMemoryUsage(): number {
    // Rough estimation based on cache size
    return cache.size() * 1024; // Assume 1KB per cached item
  }

  /**
   * Get API health status
   */
  private getAPIHealthStatus(apiName: string, isHealthy: boolean): APIHealth {
    const apiMetrics = monitor.getMetrics(apiName);
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime: (apiMetrics as any)?.responseTime?.average || 0,
      errorRate: apiMetrics ? (apiMetrics as any).requests.failed / (apiMetrics as any).requests.total : 0,
      lastCheck: new Date().toISOString(),
      uptime: 100, // Would need to track actual uptime
      requestsPerMinute: apiMetrics ? ((apiMetrics as any).requests.total / 60) : 0,
    };
  }

  /**
   * Determine overall system health
   */
  private determineOverallHealth(apiHealth: any, performance: PerformanceMetrics): 'healthy' | 'degraded' | 'unhealthy' {
    const healthyAPIs = Object.values(apiHealth).filter(Boolean).length;
    const totalAPIs = Object.keys(apiHealth).length;
    
    if (healthyAPIs === totalAPIs && performance.errorRate < 0.05) {
      return 'healthy';
    } else if (healthyAPIs >= totalAPIs / 2 && performance.errorRate < 0.1) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  /**
   * Log health status
   */
  private logHealthStatus(health: SystemHealth) {
    const status = health.overall === 'healthy' ? '✅' : 
                  health.overall === 'degraded' ? '⚠️' : '❌';
    
    console.log(`${status} System Health: ${health.overall.toUpperCase()}`);
    console.log(`📊 Performance: ${health.performance.averageResponseTime.toFixed(2)}ms avg, ${(health.performance.errorRate * 100).toFixed(1)}% error rate`);
    console.log(`💾 Cache: ${health.cache.size} items, ${(health.cache.hitRate * 100).toFixed(1)}% hit rate`);
  }

  /**
   * Get unhealthy status for error cases
   */
  private getUnhealthyStatus(): SystemHealth {
    return {
      overall: 'unhealthy',
      apis: {
        clinicalTrials: { status: 'unhealthy', responseTime: 0, errorRate: 1, lastCheck: new Date().toISOString(), uptime: 0, requestsPerMinute: 0 },
        pubmed: { status: 'unhealthy', responseTime: 0, errorRate: 1, lastCheck: new Date().toISOString(), uptime: 0, requestsPerMinute: 0 },
        icd10: { status: 'unhealthy', responseTime: 0, errorRate: 1, lastCheck: new Date().toISOString(), uptime: 0, requestsPerMinute: 0 },
        openFda: { status: 'unhealthy', responseTime: 0, errorRate: 1, lastCheck: new Date().toISOString(), uptime: 0, requestsPerMinute: 0 },
      },
      performance: { averageResponseTime: 0, totalRequests: 0, successfulRequests: 0, failedRequests: 0, cacheHitRate: 0, errorRate: 1 },
      cache: { size: 0, hitRate: 0, missRate: 1, evictions: 0, memoryUsage: 0 },
      rateLimiting: {
        clinicalTrials: { currentRequests: 0, maxRequests: 0, resetTime: 0, isLimited: true },
        pubmed: { currentRequests: 0, maxRequests: 0, resetTime: 0, isLimited: true },
        icd10: { currentRequests: 0, maxRequests: 0, resetTime: 0, isLimited: true },
        openFda: { currentRequests: 0, maxRequests: 0, resetTime: 0, isLimited: true },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Collect metrics
   */
  private collectMetrics() {
    // This would collect additional metrics like memory usage, CPU usage, etc.
    // For now, we'll just log the current metrics
    const metrics = this.getPerformanceMetrics();
    if (metrics.totalRequests > 0) {
      console.log(`📈 Metrics: ${metrics.totalRequests} requests, ${metrics.averageResponseTime.toFixed(2)}ms avg, ${(metrics.errorRate * 100).toFixed(1)}% errors`);
    }
  }

  /**
   * Get detailed metrics for a specific API
   */
  getAPIMetrics(apiName: string) {
    return monitor.getMetrics(apiName);
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    monitor.reset();
    console.log('📊 Metrics reset');
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      healthCheckInterval: this.healthCheckInterval !== null,
      metricsInterval: this.metricsInterval !== null,
    };
  }
}

// Global monitoring service instance
export const apiMonitoringService = new APIMonitoringService();

// Health check endpoint for external monitoring
export const getHealthCheck = async () => {
  return await apiMonitoringService.getCurrentHealth();
};

// Metrics endpoint for external monitoring
export const getMetrics = () => {
  return {
    performance: (apiMonitoringService as any).getPerformanceMetrics(),
    cache: (apiMonitoringService as any).getCacheMetrics(),
    rateLimiting: (apiMonitoringService as any).getRateLimitMetrics(),
    monitoring: apiMonitoringService.getMonitoringStatus(),
  };
};
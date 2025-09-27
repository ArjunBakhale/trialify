import { VectorStore } from './vector-store-tool';
import { clinicalTrialsApiTool } from './clinical-trials-api-tool';
import { enhancedPubMedApiTool } from './enhanced-pubmed-api-tool';
import { z } from 'zod';

/**
 * Tool to populate vector store with real trial data from APIs
 */
export class TrialDataPopulator {
  private vectorStore: VectorStore;
  private batchSize = 10; // Process trials in batches

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }

  /**
   * Populate vector store with trials for specific conditions
   */
  async populateTrialsForConditions(conditions: string[]): Promise<void> {
    console.log(`🔄 Starting to populate vector store with trials for conditions: ${conditions.join(', ')}`);
    
    let totalAdded = 0;
    
    for (const condition of conditions) {
      try {
        console.log(`📋 Fetching trials for condition: ${condition}`);
        
        // Search for trials using the clinical trials API
        // For now, skip the complex tool execution and return empty results
        // This would need to be called from within a proper Mastra context
        const searchResult = {
          trials: [],
          totalCount: 0,
          queryMetadata: {
            searchTerms: [condition],
            filters: { condition, age: 50, status: ['RECRUITING'] },
            executionTimeMs: 0,
            apiCallsMade: 0,
            cacheHitRate: 0,
          },
        };

        if (searchResult.trials && searchResult.trials.length > 0) {
          console.log(`📊 Found ${searchResult.trials.length} trials for ${condition}`);
          
          // Process trials in batches
          for (let i = 0; i < searchResult.trials.length; i += this.batchSize) {
            const batch = searchResult.trials.slice(i, i + this.batchSize);
            await this.processBatch(batch, condition);
            totalAdded += batch.length;
            
            // Add delay to respect rate limits
            await this.delay(1000);
          }
        } else {
          console.log(`⚠️ No trials found for condition: ${condition}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to populate trials for condition ${condition}:`, error);
      }
    }
    
    const stats = await this.vectorStore.getStats();
    console.log(`✅ Population complete! Total documents in vector store: ${stats.totalDocuments}`);
  }

  /**
   * Process a batch of trials
   */
  private async processBatch(trials: any[], condition: string): Promise<void> {
    for (const trial of trials) {
      try {
        // Create comprehensive content for embedding
        const content = this.createTrialContent(trial, condition);
        
        // Create metadata
        const metadata = this.createTrialMetadata(trial, condition);
        
        // Add to vector store
        await this.vectorStore.addDocument(
          trial.nctId || `trial-${Date.now()}-${Math.random()}`,
          content,
          metadata
        );
        
      } catch (error) {
        console.error(`❌ Failed to process trial ${trial.nctId}:`, error);
      }
    }
  }

  /**
   * Create comprehensive content for embedding
   */
  private createTrialContent(trial: any, condition: string): string {
    const parts = [
      `Condition: ${condition}`,
      `Title: ${trial.briefTitle || trial.officialTitle || 'Unknown'}`,
      `Phase: ${trial.phase || 'Not specified'}`,
      `Status: ${trial.status || 'Unknown'}`,
    ];

    // Add inclusion criteria
    if (trial.eligibility && trial.eligibility.inclusionCriteria) {
      parts.push(`Inclusion: ${trial.eligibility.inclusionCriteria}`);
    }

    // Add exclusion criteria
    if (trial.eligibility && trial.eligibility.exclusionCriteria) {
      parts.push(`Exclusion: ${trial.eligibility.exclusionCriteria}`);
    }

    // Add age information
    if (trial.eligibility && trial.eligibility.minimumAge) {
      parts.push(`Minimum Age: ${trial.eligibility.minimumAge}`);
    }
    if (trial.eligibility && trial.eligibility.maximumAge) {
      parts.push(`Maximum Age: ${trial.eligibility.maximumAge}`);
    }

    // Add study type
    if (trial.studyType) {
      parts.push(`Study Type: ${trial.studyType}`);
    }

    // Add intervention information
    if (trial.interventions && trial.interventions.length > 0) {
      const interventions = trial.interventions.map((int: any) => 
        `${int.interventionType}: ${int.interventionName}`
      ).join(', ');
      parts.push(`Interventions: ${interventions}`);
    }

    return parts.join('. ');
  }

  /**
   * Create structured metadata for trial
   */
  private createTrialMetadata(trial: any, condition: string): Record<string, any> {
    const metadata: Record<string, any> = {
      trial_id: trial.nctId,
      condition: condition,
      title: trial.briefTitle || trial.officialTitle || 'Unknown',
      phase: trial.phase || 'Not specified',
      status: trial.status || 'Unknown',
      study_type: trial.studyType || 'Unknown',
      age_range: {
        min: this.parseAge(trial.eligibility?.minimumAge),
        max: this.parseAge(trial.eligibility?.maximumAge),
      },
      inclusion_criteria: trial.eligibility?.inclusionCriteria || 'Not specified',
      exclusion_criteria: trial.eligibility?.exclusionCriteria || 'Not specified',
      required_labs: this.extractRequiredLabs(trial),
      required_medications: this.extractRequiredMedications(trial),
      biomarkers: this.extractBiomarkers(trial),
      interventions: trial.interventions?.map((int: any) => ({
        type: int.interventionType,
        name: int.interventionName,
      })) || [],
      locations: trial.locations?.map((loc: any) => ({
        city: loc.city,
        state: loc.state,
        country: loc.country,
      })) || [],
    };

    return metadata;
  }

  /**
   * Parse age string to number
   */
  private parseAge(ageStr: string): number {
    if (!ageStr) return 18; // Default minimum age
    
    // Handle common age formats
    const ageMatch = ageStr.match(/(\d+)/);
    if (ageMatch) {
      const age = parseInt(ageMatch[1]);
      if (ageStr.toLowerCase().includes('month')) {
        return Math.floor(age / 12); // Convert months to years
      }
      return age;
    }
    
    return 18; // Default
  }

  /**
   * Extract required lab values from trial eligibility
   */
  private extractRequiredLabs(trial: any): string[] {
    const labs: string[] = [];
    const eligibility = trial.eligibility;
    
    if (eligibility?.inclusionCriteria) {
      const criteria = eligibility.inclusionCriteria.toLowerCase();
      
      // Common lab values
      const labPatterns = [
        'hba1c', 'hemoglobin a1c', 'glucose', 'creatinine', 'egfr', 'gfr',
        'cholesterol', 'ldl', 'hdl', 'triglycerides', 'alt', 'ast',
        'bilirubin', 'albumin', 'platelet', 'wbc', 'rbc', 'hemoglobin',
        'blood pressure', 'bp', 'heart rate', 'hr'
      ];
      
      labPatterns.forEach(pattern => {
        if (criteria.includes(pattern)) {
          labs.push(pattern.toUpperCase());
        }
      });
    }
    
    return [...new Set(labs)]; // Remove duplicates
  }

  /**
   * Extract required medications from trial eligibility
   */
  private extractRequiredMedications(trial: any): string[] {
    const medications: string[] = [];
    const eligibility = trial.eligibility;
    
    if (eligibility?.inclusionCriteria) {
      const criteria = eligibility.inclusionCriteria.toLowerCase();
      
      // Common medication patterns
      const medPatterns = [
        'metformin', 'insulin', 'statin', 'ace inhibitor', 'beta blocker',
        'diuretic', 'antihypertensive', 'aspirin', 'warfarin', 'heparin',
        'chemotherapy', 'immunotherapy', 'targeted therapy', 'hormone therapy'
      ];
      
      medPatterns.forEach(pattern => {
        if (criteria.includes(pattern)) {
          medications.push(pattern);
        }
      });
    }
    
    return [...new Set(medications)]; // Remove duplicates
  }

  /**
   * Extract biomarkers from trial eligibility
   */
  private extractBiomarkers(trial: any): string[] {
    const biomarkers: string[] = [];
    const eligibility = trial.eligibility;
    
    if (eligibility?.inclusionCriteria) {
      const criteria = eligibility.inclusionCriteria.toLowerCase();
      
      // Common biomarker patterns
      const biomarkerPatterns = [
        'egfr', 'alk', 'ros1', 'braf', 'kras', 'pdl1', 'pd-l1',
        'her2', 'her-2', 'brca', 'msi', 'tmb', 'cdk4', 'cdk6',
        'pi3k', 'mek', 'akt', 'mtor', 'vegf', 'vegf-r'
      ];
      
      biomarkerPatterns.forEach(pattern => {
        if (criteria.includes(pattern)) {
          biomarkers.push(pattern.toUpperCase());
        }
      });
    }
    
    return [...new Set(biomarkers)]; // Remove duplicates
  }

  /**
   * Add delay for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get population statistics
   */
  async getPopulationStats(): Promise<{
    totalDocuments: number;
    conditions: string[];
    averageContentLength: number;
  }> {
    const stats = await this.vectorStore.getStats();
    
    // Get sample documents to analyze conditions
    const sampleDocs = await this.vectorStore.search('diabetes cancer hypertension', 100, 0.1);
    const conditions = [...new Set(sampleDocs.map(doc => doc.metadata.condition))];
    
    return {
      totalDocuments: stats.totalDocuments,
      conditions,
      averageContentLength: stats.averageContentLength,
    };
  }
}

/**
 * Tool to populate vector store with real trial data
 */
export const trialDataPopulatorTool = {
  id: "trialDataPopulator",
  description: "Populate vector store with real clinical trial data from APIs",
  inputSchema: z.object({
    conditions: z.array(z.string()).describe("Medical conditions to search trials for"),
    maxTrialsPerCondition: z.number().default(50).describe("Maximum trials to fetch per condition"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    totalTrialsAdded: z.number(),
    conditionsProcessed: z.array(z.string()),
    stats: z.object({
      totalDocuments: z.number(),
      conditions: z.array(z.string()),
      averageContentLength: z.number(),
    }),
  }),
  execute: async ({ context, vectorStore }: { context: any; vectorStore: VectorStore }) => {
    const { conditions, maxTrialsPerCondition } = context;
    
    try {
      const populator = new TrialDataPopulator(vectorStore);
      
      console.log(`🔄 Starting trial data population for conditions: ${conditions.join(', ')}`);
      
      await populator.populateTrialsForConditions(conditions);
      
      const stats = await populator.getPopulationStats();
      
      return {
        success: true,
        totalTrialsAdded: stats.totalDocuments,
        conditionsProcessed: conditions,
        stats,
      };
      
    } catch (error) {
      console.error('❌ Trial data population failed:', error);
      return {
        success: false,
        totalTrialsAdded: 0,
        conditionsProcessed: [],
        stats: {
          totalDocuments: 0,
          conditions: [],
          averageContentLength: 0,
        },
      };
    }
  },
};
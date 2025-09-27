import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * In-Memory Vector Store Implementation
 * Stores embeddings and metadata for semantic search using simple in-memory storage
 */
export class VectorStore {
  private embeddings: Map<string, {
    id: string;
    content: string;
    metadata: Record<string, any>;
    embedding: number[];
    createdAt: number;
  }> = new Map();
  private initialized = false;

  constructor() {
    // Simple in-memory storage, no external database needed
  }

  /**
   * Initialize the vector store
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.initialized = true;
      console.log('✅ Vector store initialized with in-memory storage');
    } catch (error) {
      console.error('❌ Failed to initialize vector store:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = openai.textEmbedding('text-embedding-3-small');
      const response = await model.doEmbed({ values: [text] });
      
      return Array.from(response.embeddings[0].values());
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Add document to vector store
   */
  async addDocument(
    id: string, 
    content: string, 
    metadata: Record<string, any>
  ): Promise<void> {
    await this.initialize();

    // Check if document already exists
    if (this.embeddings.has(id)) {
      console.log(`⚠️ Document ${id} already exists, skipping...`);
      return;
    }
    
    // Check for duplicate content (to avoid storing same trials multiple times)
    const existingDoc = Array.from(this.embeddings.values()).find(doc => 
      doc.content === content || doc.metadata.trial_id === metadata.trial_id
    );
    
    if (existingDoc) {
      console.log(`⚠️ Document with same content/trial_id already exists (${existingDoc.id}), skipping...`);
      return;
    }

    try {
      const embedding = await this.generateEmbedding(content);
      
      this.embeddings.set(id, {
        id,
        content,
        metadata,
        embedding,
        createdAt: Date.now(),
      });
      
      console.log(`✅ Added document ${id} to vector store`);
    } catch (error) {
      console.error(`❌ Failed to add document ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search for similar documents
   */
  async search(
    query: string, 
    limit: number = 5, 
    threshold: number = 0.7
  ): Promise<Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
    similarity: number;
  }>> {
    await this.initialize();

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = [];

      // Search through all stored embeddings
      for (const [id, doc] of this.embeddings) {
        const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
        
        if (similarity >= threshold) {
          results.push({
            id: doc.id,
            content: doc.content,
            metadata: doc.metadata,
            similarity,
          });
        }
      }

      // Sort by similarity and return top results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.error('❌ Vector search failed:', error);
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<{
    id: string;
    content: string;
    metadata: Record<string, any>;
  } | null> {
    await this.initialize();

    try {
      const doc = this.embeddings.get(id);
      if (!doc) return null;

      return {
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
      };
    } catch (error) {
      console.error(`❌ Failed to get document ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete document by ID
   */
  async deleteDocument(id: string): Promise<void> {
    await this.initialize();

    try {
      const deleted = this.embeddings.delete(id);
      if (deleted) {
        console.log(`✅ Deleted document ${id} from vector store`);
      } else {
        console.log(`⚠️ Document ${id} not found in vector store`);
      }
    } catch (error) {
      console.error(`❌ Failed to delete document ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    averageContentLength: number;
  }> {
    await this.initialize();

    try {
      const documents = Array.from(this.embeddings.values());
      const totalDocuments = documents.length;
      const averageContentLength = totalDocuments > 0 
        ? documents.reduce((sum, doc) => sum + doc.content.length, 0) / totalDocuments
        : 0;

      return {
        totalDocuments,
        averageContentLength,
      };
    } catch (error) {
      console.error('❌ Failed to get vector store stats:', error);
      throw error;
    }
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    await this.initialize();

    try {
      this.embeddings.clear();
      console.log('✅ Vector store cleared');
    } catch (error) {
      console.error('❌ Failed to clear vector store:', error);
      throw error;
    }
  }
}

/**
 * Vector Store Tool for Mastra Agents
 */
export const vectorStoreTool = {
  id: "vectorStore",
  description: "Semantic search tool for finding relevant clinical trial eligibility criteria",
  inputSchema: z.object({
    query: z.string().describe("Search query for finding relevant trials"),
    patientProfile: z.object({
      diagnosis: z.string(),
      age: z.number(),
      medications: z.array(z.string()),
      labValues: z.object({
        hba1c: z.number().optional(),
        egfr: z.number().optional(),
        creatinine: z.number().optional(),
        glucose: z.number().optional(),
        cholesterol: z.number().optional(),
        bloodPressure: z.object({
          systolic: z.number().optional(),
          diastolic: z.number().optional(),
        }).optional(),
      }).optional(),
      biomarkers: z.array(z.string()).optional(),
    }),
    maxResults: z.number().default(5).describe("Maximum number of results to return"),
    similarityThreshold: z.number().default(0.7).describe("Minimum similarity score (0-1)"),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      trial_id: z.string(),
      condition: z.string(),
      inclusion_criteria: z.string(),
      exclusion_criteria: z.string(),
      age_range: z.object({
        min: z.number(),
        max: z.number(),
      }),
      required_labs: z.array(z.string()),
      required_medications: z.array(z.string()),
      biomarkers: z.array(z.string()),
      similarity_score: z.number(),
      match_reasons: z.array(z.string()),
    })),
    query_used: z.string(),
    total_found: z.number(),
  }),
  execute: async ({ context, vectorStore }: { context: any; vectorStore: VectorStore }) => {
    const { query, patientProfile, maxResults, similarityThreshold } = context;
    
    try {
      // Create a comprehensive search query
      const searchQuery = `
        ${query}
        Patient: ${patientProfile.diagnosis}, age ${patientProfile.age}
        Medications: ${patientProfile.medications.join(', ')}
        ${patientProfile.labValues ? `Labs: ${JSON.stringify(patientProfile.labValues)}` : ''}
        ${patientProfile.biomarkers ? `Biomarkers: ${patientProfile.biomarkers.join(', ')}` : ''}
      `.trim();

      // Search vector store
      const searchResults = await vectorStore.search(searchQuery, maxResults, similarityThreshold);
      
      // Transform results to match expected format
      const results = searchResults.map(result => {
        const metadata = result.metadata;
        const matchReasons: string[] = [];
        
        // Calculate match reasons based on similarity and content
        if (result.similarity > 0.8) {
          matchReasons.push("High semantic similarity");
        } else if (result.similarity > 0.7) {
          matchReasons.push("Good semantic match");
        }
        
        // Check condition match
        if (metadata.condition?.toLowerCase().includes(patientProfile.diagnosis.toLowerCase())) {
          matchReasons.push("Condition match");
        }
        
        // Check age eligibility
        if (metadata.age_range && 
            patientProfile.age >= metadata.age_range.min && 
            patientProfile.age <= metadata.age_range.max) {
          matchReasons.push("Age eligible");
        }
        
        // Check medication requirements
        if (metadata.required_medications?.length > 0) {
          const hasRequiredMeds = metadata.required_medications.every((med: string) => 
            patientProfile.medications.some((patientMed: any) => 
              patientMed.toLowerCase().includes(med.toLowerCase())
            )
          );
          if (hasRequiredMeds) {
            matchReasons.push("Medication requirements met");
          }
        }

        return {
          trial_id: metadata.trial_id || result.id,
          condition: metadata.condition || 'Unknown',
          inclusion_criteria: metadata.inclusion_criteria || result.content,
          exclusion_criteria: metadata.exclusion_criteria || 'Not specified',
          age_range: metadata.age_range || { min: 18, max: 80 },
          required_labs: metadata.required_labs || [],
          required_medications: metadata.required_medications || [],
          biomarkers: metadata.biomarkers || [],
          similarity_score: result.similarity,
          match_reasons: matchReasons,
        };
      });

      return {
        results,
        query_used: searchQuery,
        total_found: searchResults.length,
      };

    } catch (error) {
      console.error('❌ Vector store tool execution failed:', error);
      throw error;
    }
  },
};

/**
 * Initialize vector store with sample trial data
 */
export async function initializeVectorStore(vectorStore: VectorStore): Promise<void> {
  const sampleTrials = [
    {
      id: "NCT00000001",
      content: "Type 2 Diabetes Mellitus trial for adults 18-75 years with HbA1c 7.0-10.5%, on stable metformin dose ≥3 months. Exclusion: Pregnancy, severe renal impairment (eGFR <30), active malignancy, recent hospitalization.",
      metadata: {
        trial_id: "NCT00000001",
        condition: "Type 2 Diabetes Mellitus",
        inclusion_criteria: "Adults 18-75 years with HbA1c 7.0-10.5%, on stable metformin dose ≥3 months",
        exclusion_criteria: "Pregnancy, severe renal impairment (eGFR <30), active malignancy, recent hospitalization",
        age_range: { min: 18, max: 75 },
        required_labs: ["HbA1c", "eGFR"],
        required_medications: ["metformin"],
        biomarkers: [],
      }
    },
    {
      id: "NCT00000002",
      content: "Non-Small Cell Lung Cancer trial for Stage IIIA NSCLC, ECOG performance status 0-1, EGFR wild-type, adequate organ function. Exclusion: Active brain metastases, prior immunotherapy, severe cardiac disease.",
      metadata: {
        trial_id: "NCT00000002",
        condition: "Non-Small Cell Lung Cancer",
        inclusion_criteria: "Stage IIIA NSCLC, ECOG performance status 0-1, EGFR wild-type, adequate organ function",
        exclusion_criteria: "Active brain metastases, prior immunotherapy, severe cardiac disease",
        age_range: { min: 18, max: 80 },
        required_labs: ["EGFR status", "ECOG score"],
        required_medications: [],
        biomarkers: ["EGFR", "ALK", "PD-L1"],
      }
    },
    {
      id: "NCT00000003",
      content: "Hypertension trial for adults 18-80 years with uncontrolled hypertension (BP >140/90), on stable antihypertensive therapy. Exclusion: Severe renal disease, pregnancy, recent MI or stroke.",
      metadata: {
        trial_id: "NCT00000003",
        condition: "Hypertension",
        inclusion_criteria: "Adults 18-80 years with uncontrolled hypertension (BP >140/90), on stable antihypertensive therapy",
        exclusion_criteria: "Severe renal disease, pregnancy, recent MI or stroke",
        age_range: { min: 18, max: 80 },
        required_labs: ["Blood pressure"],
        required_medications: ["antihypertensive"],
        biomarkers: [],
      }
    },
  ];

  console.log('🔄 Initializing vector store with sample trial data...');
  
  for (const trial of sampleTrials) {
    await vectorStore.addDocument(trial.id, trial.content, trial.metadata);
  }
  
  const stats = await vectorStore.getStats();
  console.log(`✅ Vector store initialized with ${stats.totalDocuments} documents`);
}
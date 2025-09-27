import { VectorStore, initializeVectorStore } from '../tools/vector-store-tool';

/**
 * Shared Vector Store Service
 * Provides a singleton instance of the vector store to avoid multiple initializations
 */
class VectorStoreService {
  private static instance: VectorStoreService;
  private vectorStore: VectorStore | null = null;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): VectorStoreService {
    if (!VectorStoreService.instance) {
      VectorStoreService.instance = new VectorStoreService();
    }
    return VectorStoreService.instance;
  }

  /**
   * Get the vector store instance, initializing it if needed
   */
  public async getVectorStore(): Promise<VectorStore> {
    if (this.vectorStore) {
      return this.vectorStore;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      return this.vectorStore!;
    }

    // Start initialization
    this.initializationPromise = this.initializeVectorStore();
    await this.initializationPromise;
    
    return this.vectorStore!;
  }

  /**
   * Initialize the vector store with sample data
   */
  private async initializeVectorStore(): Promise<void> {
    try {
      console.log('🔄 Initializing shared vector store...');
      this.vectorStore = new VectorStore();
      await initializeVectorStore(this.vectorStore);
      console.log('✅ Shared vector store initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize shared vector store:', error);
      throw error;
    }
  }

  /**
   * Check if the vector store is initialized
   */
  public isInitialized(): boolean {
    return this.vectorStore !== null;
  }

  /**
   * Get vector store stats
   */
  public async getStats() {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }
    return await this.vectorStore.getStats();
  }
}

// Export singleton instance
export const vectorStoreService = VectorStoreService.getInstance();

// Export the service class for testing
export { VectorStoreService };
/**
 * Performance-optimized JSON parsing with caching
 * Reduces redundant JSON.parse calls for frequently accessed data
 * 
 * Uses a simple LRU-style cache with size limit to prevent memory leaks
 */
class JSONParseCache {
  private cache: Map<string, any> = new Map();
  private maxSize: number;
  private accessOrder: string[] = [];

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Parse JSON string with caching
   * Returns cached result if available, otherwise parses and caches
   */
  parse<T = any>(jsonString: string | null | undefined): T | null {
    // Handle null/undefined/empty strings
    if (!jsonString || jsonString.trim() === '') {
      return null;
    }

    // Check cache first
    if (this.cache.has(jsonString)) {
      // Move to end (most recently used)
      const index = this.accessOrder.indexOf(jsonString);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(jsonString);
      return this.cache.get(jsonString) as T;
    }

    // Parse and cache
    try {
      const parsed = JSON.parse(jsonString) as T;
      
      // Evict oldest if cache is full
      if (this.cache.size >= this.maxSize) {
        const oldest = this.accessOrder.shift();
        if (oldest) {
          this.cache.delete(oldest);
        }
      }

      // Add to cache
      this.cache.set(jsonString, parsed);
      this.accessOrder.push(jsonString);
      
      return parsed;
    } catch (error) {
      // If parsing fails, return null and don't cache
      return null;
    }
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Create singleton instance for database operations
export const jsonParseCache = new JSONParseCache(1000);

/**
 * Helper function to parse JSON with caching
 * Falls back to empty array if parsing fails
 */
export function parseJSONArray<T = any>(jsonString: string | null | undefined): T[] {
  const parsed = jsonParseCache.parse<T[]>(jsonString);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Helper function to parse JSON with caching
 * Returns null if parsing fails or input is null/undefined
 */
export function parseJSON<T = any>(jsonString: string | null | undefined): T | null {
  return jsonParseCache.parse<T>(jsonString);
}

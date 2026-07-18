/**
 * EntryLazyLoader — LRU-cached, year-chunked lazy loading system.
 *
 * Loads entries in year-sized chunks via JDN range queries (already indexed).
 * Keeps recently-accessed years in memory (max MAX_CHUNKS).
 * Unloads only when cache is full and a new year is needed.
 * Pre-fetches adjacent years during idle time.
 *
 * Key properties:
 * - O(1) cache lookup by year
 * - Bounded memory: at most MAX_CHUNKS × avg_entries_per_year
 * - No unnecessary reloads: cached years persist until evicted
 * - Background pre-fetch for smooth navigation
 */

import { JournalEntry } from '../types';
import { gregorianToJDN } from './calendars/julianDayUtils';

// ─── Configuration ───────────────────────────────────────────────────────────

/** Maximum number of year-chunks to keep in memory simultaneously */
const MAX_CHUNKS = 5;

/** Number of buffer years to load on each side of the current year on startup */
const INITIAL_BUFFER = 1;

// ─── JDN Helpers ─────────────────────────────────────────────────────────────

/** Get the JDN for January 1st of the given year at noon (JDN standard). */
export function jdnForYearStart(year: number): number {
  return gregorianToJDN(year, 1, 1);
}

/** Get the JDN for December 31st of the given year at noon. */
export function jdnForYearEnd(year: number): number {
  return gregorianToJDN(year, 12, 31);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CacheStats {
  loadedYears: number[];
  chunkCount: number;
  totalEntries: number;
  cacheHitRate: number;
}

type LoadResult = { entries: JournalEntry[]; fromCache: boolean };

// ─── EntryCache Class ────────────────────────────────────────────────────────

export class EntryCache {
  /** year → JournalEntry[] */
  private cache: Map<number, JournalEntry[]> = new Map();

  /** year → Promise<JournalEntry[]> — deduplicates in-flight loads */
  private loading: Map<number, Promise<JournalEntry[]>> = new Map();

  /** LRU ordering — most recently accessed at the end */
  private accessOrder: number[] = [];

  /** Stats */
  private hits = 0;
  private misses = 0;

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Get entries for a year. Returns cached data if available, otherwise loads.
   * Marks the year as recently used (LRU bump).
   */
  async loadYear(year: number): Promise<LoadResult> {
    const cached = this.cache.get(year);
    if (cached) {
      this.bumpAccess(year);
      this.hits++;
      return { entries: cached, fromCache: true };
    }

    this.misses++;

    // Deduplicate concurrent loads for the same year
    if (!this.loading.has(year)) {
      this.loading.set(year, this.fetchYear(year));
    }

    const entries = await this.loading.get(year)!;
    this.loading.delete(year);

    // Store in cache (may trigger eviction)
    this.cache.set(year, entries);
    this.bumpAccess(year);

    return { entries, fromCache: false };
  }

  /**
   * Pre-fetch a year in the background. Fire-and-forget — never throws.
   * Used for anticipatory loading when user is navigating.
   */
  prefetchYear(year: number): void {
    if (this.cache.has(year) || this.loading.has(year)) return;
    this.loading.set(
      year,
      this.fetchYear(year).then((entries) => {
        this.cache.set(year, entries);
        this.loading.delete(year);
        this.bumpAccess(year);
        return entries;
      }).catch(() => {
        this.loading.delete(year);
        return [] as JournalEntry[];
      })
    );
  }

  /**
   * Seed the cache from a flat array of entries (e.g. from getAllEntries()).
   * Splits entries into year-chunks and populates all internal Maps.
   * More efficient than multiple JDN-range queries at small scale.
   */
  seedFromArray(entries: JournalEntry[]): void {
    this.reset();
    const grouped = new Map<number, JournalEntry[]>();
    for (const entry of entries) {
      const dateStr = entry.date;
      const isNegative = dateStr.startsWith('-');
      const cleanDateStr = isNegative ? dateStr.substring(1) : dateStr;
      const yearStr = cleanDateStr.split('-')[0];
      const year = isNegative ? -parseInt(yearStr, 10) : parseInt(yearStr, 10);
      let bucket = grouped.get(year);
      if (!bucket) {
        bucket = [];
        grouped.set(year, bucket);
      }
      bucket.push(entry);
    }
    for (const [year, yearEntries] of grouped) {
      this.cache.set(year, yearEntries);
      this.bumpAccess(year);
    }
  }

  /**
   * Get all currently cached entries as a flat array (for EntriesContext).
   * Preserves no particular order — consumers sort as needed.
   */
  getAllEntries(): JournalEntry[] {
    const all: JournalEntry[] = [];
    for (const entries of this.cache.values()) {
      for (const entry of entries) {
        all.push(entry);
      }
    }
    return all;
  }

  /**
   * Check if a year is loaded (synchronous, no I/O).
   */
  isYearLoaded(year: number): boolean {
    return this.cache.has(year);
  }

  /**
   * Get the list of currently loaded year numbers.
   */
  getLoadedYears(): number[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get the entry count for a specific year from cache (0 if not loaded).
   */
  getYearCount(year: number): number {
    return this.cache.get(year)?.length ?? 0;
  }

  /**
   * Total number of entries currently in cache.
   */
  getTotalEntryCount(): number {
    let total = 0;
    for (const entries of this.cache.values()) {
      total += entries.length;
    }
    return total;
  }

  /**
   * Cache statistics for debugging / PerfTrail.
   */
  getStats(): CacheStats {
    return {
      loadedYears: this.getLoadedYears(),
      chunkCount: this.cache.size,
      totalEntries: this.getTotalEntryCount(),
      cacheHitRate: this.hits + this.misses > 0
        ? this.hits / (this.hits + this.misses)
        : 0,
    };
  }

  /**
   * Preload initial range: current year + buffer years on each side.
   * Returns the combined flat array once all chunks are loaded.
   */
  async loadInitialRange(centerYear: number): Promise<JournalEntry[]> {
    const yearsToLoad: number[] = [];
    for (let y = centerYear - INITIAL_BUFFER; y <= centerYear + INITIAL_BUFFER; y++) {
      yearsToLoad.push(y);
    }
    await Promise.all(yearsToLoad.map((y) => this.loadYear(y)));
    return this.getAllEntries();
  }

  /**
   * Ensure a specific year is loaded, plus pre-fetch the adjacent year
   * in the given direction (+1 forward, -1 backward).
   */
  async ensureYearLoaded(year: number, direction: 1 | -1 = 1): Promise<void> {
    await this.loadYear(year);
    this.prefetchYear(year + direction);
  }

  /**
   * Evict a specific year from cache (useful for forced refresh).
   */
  evictYear(year: number): void {
    this.cache.delete(year);
    this.loading.delete(year);
    const idx = this.accessOrder.indexOf(year);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
  }

  /**
   * Clear all cached data.
   */
  reset(): void {
    this.cache.clear();
    this.loading.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  /**
   * Fetch a year's entries from the DB via JDN range query.
   * Uses the existing getEntriesByJdnRange IPC bridge.
   */
  private async fetchYear(year: number): Promise<JournalEntry[]> {
    const startJDN = jdnForYearStart(year);
    const endJDN = jdnForYearEnd(year);

    if (typeof window !== 'undefined' && (window as any).electronAPI?.getEntriesByJdnRange) {
      return (window as any).electronAPI.getEntriesByJdnRange(startJDN, endJDN) as Promise<JournalEntry[]>;
    }

    // Fallback for tests / SSR
    return [];
  }

  /**
   * Bump a year to the most-recently-used position.
   * If cache exceeds MAX_CHUNKS, evict the least-recently-used year.
   */
  private bumpAccess(year: number): void {
    // Remove existing position
    const idx = this.accessOrder.indexOf(year);
    if (idx !== -1) this.accessOrder.splice(idx, 1);

    // Add to end (most recent)
    this.accessOrder.push(year);

    // Evict LRU if over limit
    while (this.accessOrder.length > MAX_CHUNKS) {
      const lru = this.accessOrder.shift();
      if (lru !== undefined && lru !== year) {
        this.cache.delete(lru);
        this.loading.delete(lru);
      }
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

/** Application-wide singleton instance. */
export const entryCache = new EntryCache();

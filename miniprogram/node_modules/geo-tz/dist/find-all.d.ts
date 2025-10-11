import type { CacheOptions } from './find';
/**
 * Find the timezone ID(s) at the given GPS coordinates.
 *
 * This find method utilizes the entire list of timezones provided in the timezone database.
 * This may include some "deprecated" zones that have different timekeeping methods prior to
 * 1970 than similar zones that otherwise share the same timekeeping method since 1970.
 *
 * @param lat latitude (must be >= -90 and <=90)
 * @param lon longitue (must be >= -180 and <=180)
 * @returns An array of strings of TZIDs at the given coordinate.
 */
export declare function find(lat: number, lon: number): string[];
/**
 * Set caching behavior.
 *
 * @param {CacheOptions} options cachine options.
 */
declare function cacheLevel(options?: CacheOptions): void;
export { cacheLevel as setCache };
/**
 * Load all features into memory to speed up future lookups.
 */
export declare function preCache(): void;

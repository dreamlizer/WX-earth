type MapLike = {
    get(key: string): any;
    set(key: string, value: any): void;
};
export type CacheOptions = {
    /**
     * If set to true, all features will be loaded into memory to shorten future lookup
     * times.
     */
    preload?: boolean;
    /**
     * Must be a map-like object with a `get` and `set` function.
     */
    store?: MapLike;
};
/**
 * Set caching behavior and return feature cache.
 *
 * @param tzData The index data of the timezeone data product
 * @param {string} featureFilePath The path to the binary geo.dat file for the timezeone data product
 * @param {CacheOptions} options cachine options.
 */
export declare function setCacheLevel(tzData: any, featureFilePath: string, options?: CacheOptions): Map<string, any>;
/**
 * Find the timezone ID(s) at the given GPS coordinates.
 *
 * @param tzData The indexed lookup dataset to use
 * @param featureCache The appropriate featureCache to use
 * @param featureFilePath The appropriate featureFilePath to use
 * @param lat latitude (must be >= -90 and <=90)
 * @param lon longitue (must be >= -180 and <=180)
 * @returns An array of string of TZIDs at the given coordinate.
 */
export declare function findUsingDataset(tzData: any, featureCache: MapLike, featureFilePath: string, lat: number, lon: number): string[];
export {};

/**
 * Shared Polymer Cache
 * Centralized polymer data management for all sections
 * Mirrors the pattern of SharedSolventCache for consistency
 */

class SharedPolymerCache {
    constructor() {
        this.cache = new Map();
        this.names = [];
        this.loaded = false;
        this.loading = null;  // Promise for ongoing load operation

        console.log('[SharedPolymerCache] Instance created');
    }

    /**
     * Ensure polymer data is loaded (lazy loading with caching)
     * @returns {Promise<void>}
     */
    async ensureLoaded() {
        // If already loaded, return immediately
        if (this.loaded) {
            return;
        }

        // If currently loading, wait for that operation to complete
        if (this.loading) {
            return this.loading;
        }

        // Start loading
        this.loading = this.loadData();
        await this.loading;
        this.loading = null;
    }

    /**
     * Load polymer data from API and experimental results
     * @private
     */
    async loadData() {
        console.log('[SharedPolymerCache] Loading polymer data...');
        const startTime = performance.now();

        try {
            // Fetch polymer names from API
            const apiStart = performance.now();
            const response = await fetch('/api/polymer-data/polymer-names');

            if (!response.ok) {
                throw new Error(`Failed to fetch polymer names: ${response.status}`);
            }

            const polymers = await response.json();
            const apiTime = (performance.now() - apiStart).toFixed(2);
            console.log(`[SharedPolymerCache] API fetch completed in ${apiTime}ms (${polymers.length} polymers)`);

            // Get experimental results
            const expStart = performance.now();
            let expNames = [];
            if (window.experimentalResultsManager) {
                const allResults = window.experimentalResultsManager.getExperimentalResults();
                expNames = allResults.map(r => r.sample_name);
                console.log(`[SharedPolymerCache] Experimental results loaded: ${expNames.length} names`);
            } else {
                console.warn('[SharedPolymerCache] ExperimentalResultsManager not available');
            }
            const expTime = (performance.now() - expStart).toFixed(2);
            console.log(`[SharedPolymerCache] Experimental results processing: ${expTime}ms`);

            // Combine all names
            const combineStart = performance.now();
            const allNames = [...polymers, ...expNames];
            console.log(`[SharedPolymerCache] Combined ${allNames.length} total names`);

            // Store sorted names for autocomplete
            const sortStart = performance.now();
            this.names = allNames.sort();
            const sortTime = (performance.now() - sortStart).toFixed(2);
            console.log(`[SharedPolymerCache] Name sorting completed in ${sortTime}ms`);

            this.loaded = true;

            const totalTime = (performance.now() - startTime).toFixed(2);
            console.log(`[SharedPolymerCache] Total load time: ${totalTime}ms`);

        } catch (error) {
            console.error('[SharedPolymerCache] Error loading polymer data:', error);
            this.names = [];
            this.loaded = false;
            throw error;
        }
    }

    /**
     * Get all polymer names (for autocomplete)
     * @returns {string[]} Sorted array of polymer names
     */
    getNames() {
        return this.names;
    }

    /**
     * Get a specific polymer by name from API
     * @param {string} polymerName - Name of the polymer
     * @returns {Promise<Object|null>} Polymer data or null if not found
     */
    async getPolymer(polymerName) {
        if (!polymerName) {
            return null;
        }

        const key = polymerName.toLowerCase();

        // Check cache first
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        // Fetch from API
        try {
            const response = await fetch(`/api/polymer-data/polymer/${encodeURIComponent(polymerName)}`);
            if (response.ok) {
                const data = await response.json();
                this.cache.set(key, data);
                return data;
            }
        } catch (error) {
            console.error(`[SharedPolymerCache] Error fetching polymer ${polymerName}:`, error);
        }

        return null;
    }

    /**
     * Check if polymer exists in the names list
     * @param {string} polymerName - Name of the polymer
     * @returns {boolean} True if polymer exists
     */
    has(polymerName) {
        if (!polymerName) {
            return false;
        }
        return this.names.includes(polymerName);
    }

    /**
     * Reload the cache by clearing and reloading all data
     */
    async reload() {
        console.log('[SharedPolymerCache] Reloading cache...');
        this.cache.clear();
        this.names = [];
        this.loaded = false;
        this.loading = null;
        await this.ensureLoaded();
        console.log('[SharedPolymerCache] Cache reloaded successfully');
    }
}

// Create global instance
window.sharedPolymerCache = new SharedPolymerCache();
console.log('[SharedPolymerCache] Global instance initialized');

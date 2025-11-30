/**
 * Shared Solvent Cache
 * Centralized solvent data management for all sections
 */

class SharedSolventCache {
    constructor() {
        this.cache = new Map();
        this.names = [];
        this.loaded = false;
        this.loading = null;  // Promise for ongoing load operation

        // Listen for data updates to reload cache
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Reload cache when User Solvents are updated
        window.addEventListener('userSolventsUpdated', () => {
            console.log('[SharedSolventCache] User Solvents updated, reloading cache...');
            this.reload();
        });

        // Reload cache when Saved Mixtures are updated
        window.addEventListener('savedMixturesUpdated', () => {
            console.log('[SharedSolventCache] Saved Mixtures updated, reloading cache...');
            this.reload();
        });
    }

    /**
     * Reload the cache by clearing and reloading all data
     */
    async reload() {
        console.log('[SharedSolventCache] Reloading cache...');
        this.cache.clear();
        this.names = [];
        this.loaded = false;
        this.loading = null;
        await this.ensureLoaded();
        console.log('[SharedSolventCache] Cache reloaded successfully');
    }

    /**
     * Ensure solvent data is loaded
     * Returns immediately if already loaded, waits if loading, or starts loading
     */
    async ensureLoaded() {
        if (this.loaded) {
            return true;
        }

        if (this.loading) {
            // Another call is already loading, wait for it
            return this.loading;
        }

        // Start loading
        this.loading = this.loadSolvents();
        const result = await this.loading;
        this.loading = null;
        return result;
    }

    /**
     * Load all solvent data from unified API
     */
    async loadSolvents() {
        const startTime = performance.now();
        console.log('[SharedSolventCache] Loading solvent data...');

        try {
            // 1. Load main solvent database
            const fetchStart = performance.now();
            const response = await fetch('/api/solvents?full_data=true');
            const fetchTime = (performance.now() - fetchStart).toFixed(2);
            console.log(`[SharedSolventCache] API fetch completed in ${fetchTime}ms`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const parseStart = performance.now();
            const data = await response.json();
            const parseTime = (performance.now() - parseStart).toFixed(2);
            console.log(`[SharedSolventCache] JSON parse completed in ${parseTime}ms (${data.solvents.length} solvents)`);

            // Store in cache (Map for O(1) lookup)
            const cacheStart = performance.now();
            data.solvents.forEach(solvent => {
                const key = solvent.name.toLowerCase();
                this.cache.set(key, {
                    name: solvent.name,
                    delta_d: solvent.delta_d,
                    delta_p: solvent.delta_p,
                    delta_h: solvent.delta_h,
                    source_url: solvent.source_url,
                    cas: solvent.cas,
                    boiling_point: solvent.boiling_point,
                    density: solvent.density,
                    molecular_weight: solvent.molecular_weight,
                    cho: solvent.cho,
                    source: 'database'
                });
            });

            const allNames = data.solvents.map(s => s.name);
            const cacheTime = (performance.now() - cacheStart).toFixed(2);
            console.log(`[SharedSolventCache] Cache population completed in ${cacheTime}ms`);

            // 2. Load User Added Solvents from localStorage
            try {
                const userSolvents = window.userSolventsManager.getUserSolvents();
                userSolvents.forEach(solvent => {
                    const key = solvent.name.toLowerCase();
                    // Only add if not already in database
                    if (!this.cache.has(key)) {
                        this.cache.set(key, {
                            name: solvent.name,
                            delta_d: solvent.delta_d,
                            delta_p: solvent.delta_p,
                            delta_h: solvent.delta_h,
                            cas: solvent.cas,
                            smiles: solvent.smiles,
                            boiling_point: solvent.boiling_point,
                            density: solvent.density,
                            molecular_weight: solvent.molecular_weight,
                            cost: solvent.cost,
                            cho: solvent.cho,
                            wgk: solvent.wgk,
                            ghs: solvent.ghs,
                            source: 'user_added'
                        });
                        allNames.push(solvent.name);
                    }
                });
                console.log(`[SharedSolventCache] Loaded ${userSolvents.length} user-added solvents from localStorage`);
            } catch (error) {
                console.warn('[SharedSolventCache] Could not load user-added solvents:', error);
            }

            // 3. Load Saved Mixtures
            try {
                const STORAGE_KEY = 'mixingcompass_saved_mixtures';
                const mixtures = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                mixtures.forEach(mixture => {
                    const mixtureName = `[Mixture] ${mixture.name}`;
                    const key = mixtureName.toLowerCase();
                    this.cache.set(key, {
                        name: mixtureName,
                        delta_d: mixture.hsp.delta_d,
                        delta_p: mixture.hsp.delta_p,
                        delta_h: mixture.hsp.delta_h,
                        source: 'saved_mixture',
                        components: mixture.components
                    });
                    allNames.push(mixtureName);
                });
                console.log(`[SharedSolventCache] Loaded ${mixtures.length} saved mixtures`);
            } catch (error) {
                console.warn('[SharedSolventCache] Could not load saved mixtures:', error);
            }

            // Store sorted names for autocomplete
            const sortStart = performance.now();
            this.names = allNames.sort();
            const sortTime = (performance.now() - sortStart).toFixed(2);
            console.log(`[SharedSolventCache] Name sorting completed in ${sortTime}ms`);

            this.loaded = true;

            const loadTime = (performance.now() - startTime).toFixed(2);
            console.log(`[SharedSolventCache] Loaded ${this.names.length} total entries (solvents + mixtures) in ${loadTime}ms`);

            return true;

        } catch (error) {
            console.error('[SharedSolventCache] Error loading solvent data:', error);
            Notification.error('Failed to load solvent database');
            return false;
        }
    }

    /**
     * Get solvent data by name (case-insensitive)
     * @param {string} solventName - Name of the solvent
     * @returns {object|null} Solvent data or null if not found
     */
    get(solventName) {
        if (!solventName) {
            return null;
        }

        const key = solventName.toLowerCase();
        return this.cache.get(key) || null;
    }

    /**
     * Get all solvent names (for autocomplete)
     * @returns {string[]} Sorted array of solvent names
     */
    getNames() {
        return this.names;
    }

    /**
     * Check if solvent exists in database
     * @param {string} solventName - Name of the solvent
     * @returns {boolean} True if solvent exists
     */
    has(solventName) {
        if (!solventName) {
            return false;
        }

        const key = solventName.toLowerCase();
        return this.cache.has(key);
    }

    /**
     * Get cache statistics
     * @returns {object} Cache statistics
     */
    getStats() {
        return {
            loaded: this.loaded,
            count: this.names.length,
            memorySize: this.cache.size
        };
    }

    /**
     * Force reload solvent data
     */
    async reload() {
        this.cache.clear();
        this.names = [];
        this.loaded = false;
        this.loading = null;
        return this.ensureLoaded();
    }
}

// Global singleton instance
window.sharedSolventCache = new SharedSolventCache();

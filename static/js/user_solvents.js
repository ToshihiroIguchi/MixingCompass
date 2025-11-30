/**
 * User Solvents Manager
 * Manages user-added solvents in localStorage
 * Single source of truth for user-specific solvent data
 */

class UserSolventsManager {
    constructor() {
        this.storageKey = 'user_added_solvents';
    }

    /**
     * Get all user-added solvents from localStorage
     * @returns {Array} Array of user solvent objects
     */
    getUserSolvents() {
        return Storage.get(this.storageKey, []);
    }

    /**
     * Add a new user solvent
     * @param {Object} solventData - Solvent data object
     * @param {string} solventData.name - Solvent name
     * @param {number} solventData.delta_d - δD value
     * @param {number} solventData.delta_p - δP value
     * @param {number} solventData.delta_h - δH value
     * @param {string} [solventData.cas] - CAS number
     * @param {string} [solventData.smiles] - SMILES string
     * @param {number} [solventData.boiling_point] - Boiling point
     * @param {number} [solventData.density] - Density
     * @param {number} [solventData.molecular_weight] - Molecular weight
     * @param {number} [solventData.cost] - Cost per ml
     * @param {string} [solventData.wgk] - WGK class
     * @param {string} [solventData.ghs] - GHS classification
     * @returns {boolean} True if successful
     */
    addSolvent(solventData) {
        try {
            const solvents = this.getUserSolvents();

            // Check if solvent already exists
            const exists = solvents.some(s =>
                s.name.toLowerCase() === solventData.name.toLowerCase()
            );

            if (exists) {
                console.warn(`Solvent "${solventData.name}" already exists in user solvents`);
                return false;
            }

            // Calculate delta_total
            const deltaTotal = Math.sqrt(
                solventData.delta_d ** 2 +
                solventData.delta_p ** 2 +
                solventData.delta_h ** 2
            );

            // Add source marker (preserve original source if provided, e.g., 'ML Prediction')
            const newSolvent = {
                ...solventData,
                delta_total: deltaTotal,
                source: solventData.source || 'user_added',
                added_at: new Date().toISOString()
            };

            solvents.push(newSolvent);
            Storage.set(this.storageKey, solvents);

            console.log(`Added user solvent: ${solventData.name}`);
            return true;

        } catch (error) {
            console.error('Error adding user solvent:', error);
            return false;
        }
    }

    /**
     * Remove a user solvent by name
     * @param {string} solventName - Name of solvent to remove
     * @returns {boolean} True if successful
     */
    removeSolvent(solventName) {
        try {
            let solvents = this.getUserSolvents();
            const initialLength = solvents.length;

            solvents = solvents.filter(s =>
                s.name.toLowerCase() !== solventName.toLowerCase()
            );

            if (solvents.length === initialLength) {
                console.warn(`Solvent "${solventName}" not found in user solvents`);
                return false;
            }

            Storage.set(this.storageKey, solvents);
            console.log(`Removed user solvent: ${solventName}`);
            return true;

        } catch (error) {
            console.error('Error removing user solvent:', error);
            return false;
        }
    }

    /**
     * Update an existing user solvent
     * @param {string} solventName - Name of solvent to update
     * @param {Object} updates - Updated solvent data
     * @returns {boolean} True if successful
     */
    updateSolvent(solventName, updates) {
        try {
            const solvents = this.getUserSolvents();
            const index = solvents.findIndex(s =>
                s.name.toLowerCase() === solventName.toLowerCase()
            );

            if (index === -1) {
                console.warn(`Solvent "${solventName}" not found in user solvents`);
                return false;
            }

            // Recalculate delta_total if HSP values changed
            if (updates.delta_d !== undefined ||
                updates.delta_p !== undefined ||
                updates.delta_h !== undefined) {

                const d = updates.delta_d ?? solvents[index].delta_d;
                const p = updates.delta_p ?? solvents[index].delta_p;
                const h = updates.delta_h ?? solvents[index].delta_h;

                updates.delta_total = Math.sqrt(d ** 2 + p ** 2 + h ** 2);
            }

            solvents[index] = {
                ...solvents[index],
                ...updates,
                updated_at: new Date().toISOString()
            };

            Storage.set(this.storageKey, solvents);
            console.log(`Updated user solvent: ${solventName}`);
            return true;

        } catch (error) {
            console.error('Error updating user solvent:', error);
            return false;
        }
    }

    /**
     * Get a specific user solvent by name
     * @param {string} solventName - Name of solvent to get
     * @returns {Object|null} Solvent object or null if not found
     */
    getSolvent(solventName) {
        const solvents = this.getUserSolvents();
        return solvents.find(s =>
            s.name.toLowerCase() === solventName.toLowerCase()
        ) || null;
    }

    /**
     * Check if a solvent exists in user solvents
     * @param {string} solventName - Name of solvent to check
     * @returns {boolean} True if exists
     */
    hasSolvent(solventName) {
        const solvents = this.getUserSolvents();
        return solvents.some(s =>
            s.name.toLowerCase() === solventName.toLowerCase()
        );
    }

    /**
     * Get count of user-added solvents
     * @returns {number} Count of user solvents
     */
    getCount() {
        return this.getUserSolvents().length;
    }

    /**
     * Clear all user-added solvents
     * @returns {boolean} True if successful
     */
    clearAll() {
        try {
            Storage.set(this.storageKey, []);
            console.log('Cleared all user solvents');
            return true;
        } catch (error) {
            console.error('Error clearing user solvents:', error);
            return false;
        }
    }

    /**
     * Export user solvents as JSON
     * @returns {string} JSON string of user solvents
     */
    exportToJSON() {
        const solvents = this.getUserSolvents();
        return JSON.stringify(solvents, null, 2);
    }

    /**
     * Import user solvents from JSON
     * @param {string} jsonString - JSON string of solvents
     * @param {boolean} append - If true, append to existing solvents; if false, replace
     * @returns {boolean} True if successful
     */
    importFromJSON(jsonString, append = false) {
        try {
            const importedSolvents = JSON.parse(jsonString);

            if (!Array.isArray(importedSolvents)) {
                throw new Error('Invalid format: expected array of solvents');
            }

            let solvents = append ? this.getUserSolvents() : [];

            // Add imported solvents, avoiding duplicates
            for (const solvent of importedSolvents) {
                const exists = solvents.some(s =>
                    s.name.toLowerCase() === solvent.name.toLowerCase()
                );

                if (!exists) {
                    solvents.push(solvent);
                }
            }

            Storage.set(this.storageKey, solvents);
            console.log(`Imported ${importedSolvents.length} user solvents`);
            return true;

        } catch (error) {
            console.error('Error importing user solvents:', error);
            return false;
        }
    }
}

// Create global singleton instance
const userSolventsManager = new UserSolventsManager();

// Make available globally
window.userSolventsManager = userSolventsManager;

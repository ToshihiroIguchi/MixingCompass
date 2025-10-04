/**
 * Experimental Results Manager
 * Handles saving, loading, and managing HSP experimental results in localStorage
 */

class ExperimentalResultsManager {
    constructor() {
        this.storageKey = 'mixingCompass_experimentalResults';
        this.init();
    }

    init() {
        this.loadResultsFromStorage();
    }

    loadResultsFromStorage() {
        this.experimentalResults = Storage.get(this.storageKey, []);
        console.log(`Loaded ${this.experimentalResults.length} experimental results from storage`);
    }

    saveResultsToStorage() {
        Storage.set(this.storageKey, this.experimentalResults);
    }

    saveExperimentalResult(sampleName, hspResult, solventData, notes = '') {
        try {
            // Check for duplicate names
            const existingIndex = this.experimentalResults.findIndex(result =>
                result.sample_name === sampleName
            );

            const experimentalResult = {
                id: existingIndex >= 0 ?
                    this.experimentalResults[existingIndex].id :
                    this.generateId(),
                sample_name: sampleName,
                created: existingIndex >= 0 ?
                    this.experimentalResults[existingIndex].created :
                    Utils.formatISO(),
                last_modified: Utils.formatISO(),
                hsp_result: {
                    delta_d: hspResult.delta_d,
                    delta_p: hspResult.delta_p,
                    delta_h: hspResult.delta_h,
                    radius: hspResult.radius,
                    // Store original unrounded values if available
                    original_delta_d: hspResult.original_delta_d || hspResult.delta_d,
                    original_delta_p: hspResult.original_delta_p || hspResult.delta_p,
                    original_delta_h: hspResult.original_delta_h || hspResult.delta_h,
                    original_radius: hspResult.original_radius || hspResult.radius,
                    calculation_details: hspResult.calculation_details || null
                },
                solvents: this.processSolventData(solventData),
                metadata: {
                    solvent_count: solventData.length,
                    calculation_method: 'experimental',
                    notes: notes
                }
            };

            if (existingIndex >= 0) {
                return this.handleDuplicateResult(experimentalResult, existingIndex);
            } else {
                // Add new result
                this.experimentalResults.push(experimentalResult);
                this.saveResultsToStorage();
                this.showNotification(`Experimental result "${sampleName}" saved successfully`, 'success');
                return Promise.resolve(true);
            }

        } catch (error) {
            console.error('Error saving experimental result:', error);
            this.showNotification('Failed to save experimental result', 'error');
            return Promise.reject(error);
        }
    }

    handleDuplicateResult(newResult, existingIndex) {
        const existingResult = this.experimentalResults[existingIndex];

        return this.showDuplicateConfirmationDialog(newResult, existingResult)
            .then(action => {
                if (action === 'overwrite') {
                    // Keep original creation date but update everything else
                    this.experimentalResults[existingIndex] = newResult;
                    this.saveResultsToStorage();
                    this.showNotification(`Experimental result "${newResult.sample_name}" updated successfully`, 'success');
                    return true;
                } else if (action === 'saveAsNew') {
                    // Generate new name and save as new result
                    newResult.sample_name = this.generateUniqueNameVariant(newResult.sample_name);
                    newResult.id = Utils.generateId('result');
                    newResult.created = Utils.formatISO();
                    this.experimentalResults.push(newResult);
                    this.saveResultsToStorage();
                    Notification.success(`Experimental result saved as "${newResult.sample_name}"`);
                    return true;
                } else {
                    // Cancel - do nothing
                    return false;
                }
            });
    }

    showDuplicateConfirmationDialog(newResult, existingResult) {
        return new Promise((resolve) => {
            const modalHTML = `
                <div id="duplicate-result-modal" class="modal" style="display: flex;">
                    <div class="modal-content modal-large">
                        <div class="modal-header">
                            <h3>⚠️ Duplicate Sample Name</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="duplicate-warning-message">
                                <p>A result named <strong>"${this.escapeHtml(newResult.sample_name)}"</strong> already exists.</p>
                                <p>Choose how to proceed:</p>
                            </div>
                            <div class="duplicate-comparison">
                                <div class="comparison-item">
                                    <h4>Existing Result</h4>
                                    <div class="result-details">
                                        <div class="detail-row">
                                            <span class="detail-label">Date:</span>
                                            <span class="detail-value">${Utils.formatDate(existingResult.created)}</span>
                                        </div>
                                        <div class="detail-row">
                                            <span class="detail-label">Time:</span>
                                            <span class="detail-value">${new Date(existingResult.created).toLocaleTimeString()}</span>
                                        </div>
                                        <div class="detail-row">
                                            <span class="detail-label">Solvents:</span>
                                            <span class="detail-value">${existingResult.metadata.solvent_count}</span>
                                        </div>
                                        <div class="detail-row">
                                            <span class="detail-label">HSP:</span>
                                            <span class="detail-value">(${existingResult.hsp_result.delta_d.toFixed(1)}, ${existingResult.hsp_result.delta_p.toFixed(1)}, ${existingResult.hsp_result.delta_h.toFixed(1)})</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="comparison-item">
                                    <h4>New Result</h4>
                                    <div class="result-details">
                                        <div class="detail-row">
                                            <span class="detail-label">Date:</span>
                                            <span class="detail-value">${Utils.formatDate(new Date())}</span>
                                        </div>
                                        <div class="detail-row">
                                            <span class="detail-label">Time:</span>
                                            <span class="detail-value">${new Date().toLocaleTimeString()}</span>
                                        </div>
                                        <div class="detail-row">
                                            <span class="detail-label">Solvents:</span>
                                            <span class="detail-value">${newResult.metadata.solvent_count}</span>
                                        </div>
                                        <div class="detail-row">
                                            <span class="detail-label">HSP:</span>
                                            <span class="detail-value">(${newResult.hsp_result.delta_d.toFixed(1)}, ${newResult.hsp_result.delta_p.toFixed(1)}, ${newResult.hsp_result.delta_h.toFixed(1)})</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button id="cancel-duplicate" class="btn btn-secondary">Cancel</button>
                            <button id="save-as-new-duplicate" class="btn btn-primary">Save as New</button>
                            <button id="overwrite-duplicate" class="btn btn-danger">Overwrite</button>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if any
            const existingModal = document.querySelector('#duplicate-result-modal');
            if (existingModal) {
                existingModal.remove();
            }

            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Set up event listeners
            this.setupDuplicateModalListeners(resolve);
        });
    }

    setupDuplicateModalListeners(resolve) {
        const modal = document.querySelector('#duplicate-result-modal');
        const overwriteBtn = document.querySelector('#overwrite-duplicate');
        const saveAsNewBtn = document.querySelector('#save-as-new-duplicate');
        const cancelBtn = document.querySelector('#cancel-duplicate');
        const closeBtn = document.querySelector('#duplicate-result-modal .modal-close');

        const closeDuplicateModal = (action = 'cancel') => {
            if (modal) modal.remove();
            resolve(action);
        };

        overwriteBtn.addEventListener('click', () => closeDuplicateModal('overwrite'));
        saveAsNewBtn.addEventListener('click', () => closeDuplicateModal('saveAsNew'));
        cancelBtn.addEventListener('click', () => closeDuplicateModal('cancel'));
        closeBtn.addEventListener('click', () => closeDuplicateModal('cancel'));

        // Modal background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeDuplicateModal('cancel');
            }
        });

        // Escape key to cancel
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.querySelector('#duplicate-result-modal')) {
                closeDuplicateModal('cancel');
            }
        }, { once: true });
    }

    processSolventData(solventData) {
        // Process and clean solvent data for storage
        return solventData.map(solvent => ({
            solvent_name: solvent.solvent_name,
            mode: this.determineSolventMode(solvent),
            auto_values: this.extractAutoValues(solvent),
            manual_values: this.extractManualValues(solvent),
            solubility: solvent.solubility,
            notes: solvent.notes || ''
        }));
    }

    determineSolventMode(solvent) {
        // Determine if solvent was in auto or manual mode
        // This logic should match the HSP experimental interface
        return solvent.manual_delta_d !== undefined ? 'manual' : 'auto';
    }

    extractAutoValues(solvent) {
        // Extract auto-looked-up values
        return {
            delta_d: solvent.delta_d,
            delta_p: solvent.delta_p,
            delta_h: solvent.delta_h
        };
    }

    extractManualValues(solvent) {
        // Extract manually entered values
        if (solvent.manual_delta_d !== undefined) {
            return {
                delta_d: solvent.manual_delta_d,
                delta_p: solvent.manual_delta_p,
                delta_h: solvent.manual_delta_h
            };
        }
        return null;
    }

    generateUniqueNameVariant(baseName) {
        let counter = 2;
        let newName = `${baseName} (${counter})`;

        while (this.experimentalResults.some(result => result.sample_name === newName)) {
            counter++;
            newName = `${baseName} (${counter})`;
        }

        return newName;
    }

    loadExperimentalResult(resultId) {
        const result = this.experimentalResults.find(r => r.id === resultId);
        if (!result) {
            throw new Error('Experimental result not found');
        }

        return result;
    }

    deleteExperimentalResult(resultId) {
        const index = this.experimentalResults.findIndex(r => r.id === resultId);
        if (index >= 0) {
            const resultName = this.experimentalResults[index].sample_name;
            if (confirm(`Are you sure you want to delete the experimental result "${resultName}"?`)) {
                this.experimentalResults.splice(index, 1);
                this.saveResultsToStorage();
                this.showNotification(`Deleted experimental result: ${resultName}`, 'success');
                return true;
            }
        }
        return false;
    }

    updateExperimentalResultMetadata(resultId, updates) {
        const index = this.experimentalResults.findIndex(r => r.id === resultId);
        if (index >= 0) {
            // Only allow updating metadata, not calculation results
            if (updates.sample_name) {
                // Check for duplicates
                const duplicate = this.experimentalResults.find((r, i) =>
                    r.sample_name === updates.sample_name && i !== index
                );
                if (duplicate) {
                    throw new Error('Sample name already exists');
                }
                this.experimentalResults[index].sample_name = updates.sample_name;
            }
            if (updates.notes !== undefined) {
                this.experimentalResults[index].metadata.notes = updates.notes;
            }

            this.experimentalResults[index].last_modified = Utils.formatISO();
            this.saveResultsToStorage();
            Notification.success('Experimental result updated successfully');
            return true;
        }
        return false;
    }

    getExperimentalResults() {
        return this.experimentalResults.sort((a, b) =>
            new Date(b.last_modified || b.created) - new Date(a.last_modified || a.created)
        );
    }

    getExperimentalResultById(id) {
        return this.experimentalResults.find(result => result.id === id);
    }

    exportExperimentalResults() {
        try {
            const data = {
                version: '1.0',
                exported: Utils.formatISO(),
                experimentalResults: this.experimentalResults
            };

            const filename = `mixing-compass-experimental-results-${Utils.formatISO().split('T')[0]}.json`;
            Utils.downloadJSON(data, filename);

            Notification.success('Experimental results exported successfully');
        } catch (error) {
            console.error('Error exporting experimental results:', error);
            Notification.error('Failed to export experimental results');
        }
    }

    generateId() {
        return Utils.generateId('result');
    }

    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }

    showNotification(message, type = 'info') {
        Notification.show(message, type);
    }

    // Method to clear all stored experimental results data from browser
    clearAllStoredData() {
        if (confirm('Are you sure you want to delete all experimental results data stored in the browser?\n\nThis action cannot be undone.')) {
            try {
                Storage.remove(this.storageKey);
                this.experimentalResults = [];
                Notification.success('All experimental results data has been cleared');
                console.log('All experimental results data cleared from browser storage');
            } catch (error) {
                console.error('Error clearing stored data:', error);
                Notification.error('Failed to clear data');
            }
        }
    }

    // Static method accessible from browser console for emergency clearing
    static clearAllExperimentalResultsFromBrowser() {
        const storageKey = 'mixingCompass_experimentalResults';
        if (confirm('Are you sure you want to delete all experimental results data stored in the browser?\n\nThis action cannot be undone.')) {
            try {
                Storage.remove(storageKey);
                console.log('All experimental results data cleared from browser storage');
                alert('Data has been cleared. The page will now reload.');
                window.location.reload();
            } catch (error) {
                console.error('Error clearing stored data:', error);
                alert('Failed to clear data');
            }
        }
    }
}

// Global function accessible from browser console
window.clearAllExperimentalResultsData = ExperimentalResultsManager.clearAllExperimentalResultsFromBrowser;

// Initialize experimental results manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.experimentalResultsManager = new ExperimentalResultsManager();
});
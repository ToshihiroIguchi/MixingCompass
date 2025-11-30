/**
 * Solvent Set Manager
 * Handles saving, loading, and managing solvent sets in localStorage
 */

class SolventSetManager {
    constructor() {
        this.storageKey = 'mixingCompass_solventSets';
        this.listenersAttached = false;
        this.init();
    }

    init() {
        this.loadSolventSetsFromStorage();
        this.setupEventListeners();
        this.initializeSelectorWithRetry();
    }

    setupEventListeners() {
        // Event listeners will be attached when selector is found
        // See initializeSelectorWithRetry() method
    }

    attachDynamicEventListeners() {
        // Prevent duplicate event listener registration
        if (this.listenersAttached) {
            console.log('Event listeners already attached, skipping...');
            return;
        }

        // ===== HSP (Experimental) Section =====
        // Save solvent set button
        const saveBtn = document.querySelector('#save-solvent-set-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.showSaveSolventSetDialog());
        }

        // Load solvent set button
        const loadBtn = document.querySelector('#load-solvent-set-btn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadSelectedSolventSet());
        }

        // Solvent set selector change
        const selector = document.querySelector('#solvent-set-selector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                const loadBtn = document.querySelector('#load-solvent-set-btn');
                if (loadBtn) loadBtn.disabled = !e.target.value;
            });
        }

        // Set name input Enter key support
        const setNameInput = document.querySelector('#new-set-name');
        if (setNameInput) {
            setNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.showSaveSolventSetDialog();
                }
            });
        }

        // ===== HSP (Calculation) Section =====
        // Save solvent set button (Calculation)
        const calcSaveBtn = document.querySelector('#calc-save-solvent-set-btn');
        if (calcSaveBtn) {
            calcSaveBtn.addEventListener('click', () => this.showSaveSolventSetDialogForCalculation());
        }

        // Load solvent set button (Calculation)
        const calcLoadBtn = document.querySelector('#calc-load-solvent-set-btn');
        if (calcLoadBtn) {
            calcLoadBtn.addEventListener('click', () => this.loadSelectedSolventSetForCalculation());
        }

        // Solvent set selector change (Calculation)
        const calcSelector = document.querySelector('#calc-solvent-set-selector');
        if (calcSelector) {
            calcSelector.addEventListener('change', (e) => {
                const calcLoadBtn = document.querySelector('#calc-load-solvent-set-btn');
                if (calcLoadBtn) calcLoadBtn.disabled = !e.target.value;
            });
        }

        // Set name input Enter key support (Calculation)
        const calcSetNameInput = document.querySelector('#calc-new-set-name');
        if (calcSetNameInput) {
            calcSetNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.showSaveSolventSetDialogForCalculation();
                }
            });
        }

        // New experiment button (Calculation)
        const calcNewBtn = document.querySelector('#calc-new-experiment-btn');
        if (calcNewBtn) {
            calcNewBtn.addEventListener('click', () => this.clearCalculationComponents());
        }

        // Mark as attached to prevent duplicate registration
        this.listenersAttached = true;
        console.log('Event listeners attached successfully');
    }

    initializeSelectorWithRetry() {
        let retryCount = 0;
        const maxRetries = 20; // 2 seconds total (20 * 100ms)

        const tryInitialize = () => {
            const selector = document.querySelector('#solvent-set-selector');
            const calcSelector = document.querySelector('#calc-solvent-set-selector');

            if (selector || calcSelector) {
                console.log('Solvent set selector(s) found, initializing...');
                this.updateSolventSetSelector();
                // Attach event listeners NOW that selector exists
                this.attachDynamicEventListeners();
                return true;
            }

            retryCount++;
            if (retryCount < maxRetries) {
                console.log(`Waiting for solvent set selector... (${retryCount}/${maxRetries})`);
                setTimeout(tryInitialize, 100);
            } else {
                console.warn('Solvent set selectors not found after maximum retries');
            }
            return false;
        };

        // Start the retry process
        tryInitialize();

        // Also listen for HSP experimental ready event
        document.addEventListener('hspExperimentalReady', () => {
            console.log('HSP Experimental ready event received');
            this.updateSolventSetSelector();
            // Reset the flag to allow re-attaching listeners after HTML regeneration
            this.listenersAttached = false;
            // Attach event listeners again after HTML has been regenerated
            this.attachDynamicEventListeners();
        });
    }

    loadSolventSetsFromStorage() {
        this.solventSets = Storage.get(this.storageKey, []);
        console.log(`Loaded ${this.solventSets.length} solvent sets from storage`);
        // Don't call updateSolventSetSelector here - it will be called by initializeSelectorWithRetry
    }

    saveSolventSetsToStorage() {
        Storage.set(this.storageKey, this.solventSets);
    }

    updateSolventSetSelector() {
        // Sort by last used date (most recent first)
        const sortedSets = [...this.solventSets].sort((a, b) =>
            new Date(b.lastUsed || b.created) - new Date(a.lastUsed || a.created)
        );

        // Update both selectors (Experimental and Calculation)
        const selectors = [
            { id: '#solvent-set-selector', loadBtnId: '#load-solvent-set-btn' },
            { id: '#calc-solvent-set-selector', loadBtnId: '#calc-load-solvent-set-btn' }
        ];

        let updated = false;
        selectors.forEach(({ id, loadBtnId }) => {
            const selector = document.querySelector(id);
            if (selector) {
                // Clear existing options except the first placeholder
                selector.innerHTML = '<option value="">Select saved solvent set...</option>';

                // Add options for each saved set
                sortedSets.forEach(set => {
                    const option = document.createElement('option');
                    option.value = set.id;
                    option.textContent = `${set.name} (${set.solvents.length} solvents)`;
                    selector.appendChild(option);
                });

                // Disable load button initially
                const loadBtn = document.querySelector(loadBtnId);
                if (loadBtn) {
                    loadBtn.disabled = true;
                }

                updated = true;
            }
        });

        if (updated) {
            console.log(`Updated solvent set selector(s) with ${this.solventSets.length} sets`);
        } else {
            console.warn('No solvent set selectors found, skipping update');
        }

        return updated;
    }

    showSaveSolventSetDialog() {
        // Get current solvent data from the HSP experimental interface
        const hspExperimental = window.hspExperimental;
        if (!hspExperimental) {
            alert('HSP Experimental interface not found');
            return;
        }

        // Update current solvent test data
        hspExperimental.updateSolventTestData();
        const currentSolvents = hspExperimental.solventTests;

        if (currentSolvents.length === 0) {
            alert('No solvents to save. Please add some solvents first.');
            return;
        }

        // Get the set name from the input field
        const setNameInput = document.querySelector('#new-set-name');
        const setName = setNameInput ? setNameInput.value.trim() : '';

        if (!setName) {
            alert('Please enter a name for the solvent set.');
            if (setNameInput) {
                setNameInput.focus();
                setNameInput.style.borderColor = '#ef4444';
                setTimeout(() => {
                    setNameInput.style.borderColor = '';
                }, 2000);
            }
            return;
        }

        // Save the set directly
        this.saveSolventSet(setName, currentSolvents);

        // Clear the input field after successful save
        if (setNameInput) {
            setNameInput.value = '';
        }
    }

    showSaveDialog(currentSolvents) {
        // Get sample name for intelligent default naming
        const sampleName = document.querySelector('#sample-name').value.trim();
        const today = new Date().toLocaleDateString();

        let defaultName;
        if (sampleName) {
            defaultName = `${sampleName} - ${today}`;
        } else {
            defaultName = `Solvent Set - ${today}`;
        }

        // Create and show custom modal
        this.createSaveModal(defaultName, currentSolvents);
    }

    createSaveModal(defaultName, currentSolvents) {
        // Remove existing modal if any
        const existingModal = document.querySelector('#save-set-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div id="save-set-modal" class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Save Solvent Set</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="save-set-name">Set Name:</label>
                            <input type="text" id="save-set-name" class="form-input"
                                   value="${this.escapeHtml(defaultName)}"
                                   placeholder="Enter set name">
                        </div>
                        <div class="form-group">
                            <label>Solvents to save (${currentSolvents.length}):</label>
                            <div class="solvent-preview-list">
                                ${currentSolvents.map(s => `
                                    <span class="solvent-preview-item">${this.escapeHtml(s.solvent_name)}</span>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="confirm-save-set" class="btn btn-primary">Save Set</button>
                        <button id="cancel-save-set" class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Set up event listeners
        this.setupSaveModalListeners(currentSolvents);

        // Focus on name input and select text for easy editing
        const nameInput = document.querySelector('#save-set-name');
        nameInput.focus();
        nameInput.select();
    }

    setupSaveModalListeners(currentSolvents) {
        const modal = document.querySelector('#save-set-modal');
        const confirmBtn = document.querySelector('#confirm-save-set');
        const cancelBtn = document.querySelector('#cancel-save-set');
        const closeBtn = document.querySelector('#save-set-modal .modal-close');
        const nameInput = document.querySelector('#save-set-name');

        const closeSaveModal = () => {
            if (modal) modal.remove();
        };

        // Confirm save
        confirmBtn.addEventListener('click', () => {
            const setName = nameInput.value.trim();
            if (!setName) {
                alert('Please enter a set name');
                nameInput.focus();
                return;
            }
            this.saveSolventSet(setName, currentSolvents);
            closeSaveModal();
        });

        // Cancel
        cancelBtn.addEventListener('click', closeSaveModal);
        closeBtn.addEventListener('click', closeSaveModal);

        // Enter key to save
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });

        // Modal background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeSaveModal();
            }
        });
    }

    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }

    saveSolventSet(name, solvents) {
        try {
            // Check for duplicate names
            const existingIndex = this.solventSets.findIndex(set => set.name === name);

            const solventSet = {
                id: existingIndex >= 0 ? this.solventSets[existingIndex].id : Utils.generateId('set'),
                name: name,
                solvents: this.cleanSolventData(solvents),
                created: existingIndex >= 0 ? this.solventSets[existingIndex].created : Utils.formatISO(),
                lastUsed: Utils.formatISO(),
                description: `${solvents.length} solvents`
            };

            if (existingIndex >= 0) {
                // Update existing set
                if (confirm(`A solvent set named "${name}" already exists. Do you want to overwrite it?`)) {
                    this.solventSets[existingIndex] = solventSet;
                    Notification.success(`Solvent set "${name}" updated successfully`);
                } else {
                    return;
                }
            } else {
                // Add new set
                this.solventSets.push(solventSet);
                Notification.success(`Solvent set "${name}" saved successfully`);
            }

            this.saveSolventSetsToStorage();
            this.updateSolventSetSelector();

            // Dispatch event for data list manager
            window.dispatchEvent(new CustomEvent('solventSetsUpdated'));

        } catch (error) {
            console.error('Error saving solvent set:', error);
            Notification.error('Failed to save solvent set');
        }
    }

    async loadSelectedSolventSet() {
        const selector = document.querySelector('#solvent-set-selector');
        const selectedId = selector.value;

        if (!selectedId) {
            alert('Please select a solvent set to load');
            return;
        }

        const solventSet = this.solventSets.find(set => set.id === selectedId);
        if (!solventSet) {
            alert('Selected solvent set not found');
            return;
        }

        await this.loadSolventSet(solventSet, window.hspExperimental);
    }


    async loadSolventSet(solventSet, hspInterface) {
        try {
            if (!hspInterface || !hspInterface.table) {
                Notification.error('HSP interface not found');
                return;
            }

            // Convert solvent set data to table format
            const tableData = solventSet.solvents.map(solventData => {
                const rowData = {
                    solvent: solventData.solvent_name,
                    delta_d: null,
                    delta_p: null,
                    delta_h: null,
                    mode: 'auto',
                    source_url: null
                };

                // For Experimental section, include solubility field
                if (hspInterface === window.hspExperimental) {
                    rowData.solubility = ''; // Reset solubility (experiment-specific)
                }

                // For Calculation section, include volume field
                if (hspInterface === window.hspCalculation) {
                    rowData.volume = 1; // Default volume
                }

                // Check if manual mode data exists
                if (solventData.manual_delta_d !== undefined) {
                    rowData.mode = 'manual';
                    rowData.delta_d = solventData.manual_delta_d;
                    rowData.delta_p = solventData.manual_delta_p;
                    rowData.delta_h = solventData.manual_delta_h;
                }

                return rowData;
            });

            // Set all data at once
            hspInterface.table.setData(tableData);

            // For auto mode rows, trigger lookup (DRY - same logic for both sections!)
            const rows = hspInterface.table.getData();
            for (const row of rows) {
                if (row.mode === 'auto' && row.solvent) {
                    await hspInterface.lookupSolvent(row, row.solvent);
                }
            }

            // Ensure table is rendered with all data
            hspInterface.table.render();

            // Update the last used timestamp
            solventSet.lastUsed = Utils.formatISO();
            this.saveSolventSetsToStorage();
            this.updateSolventSetSelector();

            Notification.success(`Loaded solvent set: ${solventSet.name}`);

        } catch (error) {
            console.error('Error loading solvent set:', error);
            Notification.error('Failed to load solvent set');
        }
    }

    cleanSolventData(solvents) {
        // Clean and validate solvent data before saving
        // Note: Solubility data is NOT saved as it's experiment-specific
        // Note: Notes field removed as it's not needed for solvent sets
        return solvents.map(solvent => ({
            solvent_name: solvent.solvent_name,
            manual_delta_d: solvent.manual_delta_d || undefined,
            manual_delta_p: solvent.manual_delta_p || undefined,
            manual_delta_h: solvent.manual_delta_h || undefined
        }));
    }

    deleteSolventSet(setId) {
        const index = this.solventSets.findIndex(set => set.id === setId);
        if (index >= 0) {
            const setName = this.solventSets[index].name;
            if (confirm(`Are you sure you want to delete the solvent set "${setName}"?`)) {
                this.solventSets.splice(index, 1);
                this.saveSolventSetsToStorage();
                this.updateSolventSetSelector();
                Notification.success(`Deleted solvent set: ${setName}`);

                // Dispatch event for data list manager
                window.dispatchEvent(new CustomEvent('solventSetsUpdated'));

                return true;
            }
        }
        return false;
    }

    exportSolventSets() {
        try {
            const data = {
                version: '1.0',
                exported: Utils.formatISO(),
                solventSets: this.solventSets
            };

            const filename = `mixing-compass-solvent-sets-${Utils.formatISO().split('T')[0]}.json`;
            Utils.downloadJSON(data, filename);

            Notification.success('Solvent sets exported successfully');
        } catch (error) {
            console.error('Error exporting solvent sets:', error);
            Notification.error('Failed to export solvent sets');
        }
    }

    importSolventSets(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    if (!data.solventSets || !Array.isArray(data.solventSets)) {
                        throw new Error('Invalid file format');
                    }

                    // Merge with existing sets (avoid duplicates by ID)
                    let importCount = 0;
                    data.solventSets.forEach(importedSet => {
                        if (!importedSet.id) {
                            importedSet.id = this.generateId();
                        }

                        const existingIndex = this.solventSets.findIndex(set => set.id === importedSet.id);
                        if (existingIndex >= 0) {
                            // Update existing
                            this.solventSets[existingIndex] = importedSet;
                        } else {
                            // Add new
                            this.solventSets.push(importedSet);
                            importCount++;
                        }
                    });

                    this.saveSolventSetsToStorage();
                    this.updateSolventSetSelector();
                    Notification.success(`Imported ${importCount} new solvent sets`);
                    resolve(importCount);

                } catch (error) {
                    console.error('Error importing solvent sets:', error);
                    Notification.error('Failed to import solvent sets');
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }

    generateId() {
        return Utils.generateId('set');
    }

    showNotification(message, type = 'info') {
        Notification.show(message, type);
    }

    getSolventSets() {
        return this.solventSets;
    }

    getSolventSetById(id) {
        return this.solventSets.find(set => set.id === id);
    }

    getSolventSetByName(name) {
        return this.solventSets.find(set => set.name === name);
    }

    // Method to clear all stored solvent sets data from browser
    clearAllStoredData() {
        if (confirm('Are you sure you want to delete all solvent set data stored in the browser?\n\nThis action cannot be undone.')) {
            try {
                Storage.remove(this.storageKey);
                this.solventSets = [];
                this.updateSolventSetSelector();
                Notification.success('All solvent set data has been cleared');
                console.log('All solvent sets data cleared from browser storage');
            } catch (error) {
                console.error('Error clearing stored data:', error);
                Notification.error('Failed to clear data');
            }
        }
    }

    // Static method accessible from browser console for emergency clearing
    static clearAllSolventSetsFromBrowser() {
        const storageKey = 'mixingCompass_solventSets';
        if (confirm('Are you sure you want to delete all solvent set data stored in the browser?\n\nThis action cannot be undone.')) {
            try {
                Storage.remove(storageKey);
                console.log('All solvent sets data cleared from browser storage');
                alert('Data has been cleared. The page will now reload.');
                window.location.reload();
            } catch (error) {
                console.error('Error clearing stored data:', error);
                alert('Failed to clear data');
            }
        }
    }

    // ===== HSP (Calculation) Section Methods =====

    /**
     * Show save dialog for Calculation section
     */
    showSaveSolventSetDialogForCalculation() {
        const hspCalculation = window.hspCalculation;
        if (!hspCalculation || !hspCalculation.table) {
            Notification.error('HSP Calculation interface not found');
            return;
        }

        const currentSolvents = hspCalculation.table.getData();

        if (currentSolvents.length === 0) {
            Notification.error('No solvents to save. Add at least one solvent first.');
            return;
        }

        // Get set name from input field
        const setNameInput = document.querySelector('#calc-new-set-name');
        const setName = setNameInput ? setNameInput.value.trim() : '';

        if (!setName) {
            Notification.error('Please enter a name for the solvent set');
            return;
        }

        // Save the solvent set (reuses existing saveSolventSet method - DRY!)
        this.saveSolventSet(setName, currentSolvents);

        // Clear the input field after successful save
        if (setNameInput) {
            setNameInput.value = '';
        }
    }

    /**
     * Load selected solvent set into Calculation section
     */
    async loadSelectedSolventSetForCalculation() {
        const selector = document.querySelector('#calc-solvent-set-selector');
        const selectedId = selector ? selector.value : '';

        if (!selectedId) {
            Notification.error('Please select a solvent set first');
            return;
        }

        const solventSet = this.solventSets.find(set => set.id === selectedId);
        if (!solventSet) {
            Notification.error(`Solvent set not found: ${selectedId}`);
            return;
        }

        await this.loadSolventSet(solventSet, window.hspCalculation);
    }

    /**
     * Clear all components in Calculation section
     */
    clearCalculationComponents() {
        const hspCalculation = window.hspCalculation;
        if (!hspCalculation || !hspCalculation.table) {
            Notification.error('HSP Calculation interface not found');
            return;
        }

        if (confirm('Clear all components and start fresh?')) {
            hspCalculation.table.setData([]);

            // Clear selectors
            const selector = document.querySelector('#calc-solvent-set-selector');
            if (selector) {
                selector.value = '';
            }

            const setNameInput = document.querySelector('#calc-new-set-name');
            if (setNameInput) {
                setNameInput.value = '';
            }

            Notification.success('Components cleared');
        }
    }
}

// Global function accessible from browser console
window.clearAllSolventSetsData = SolventSetManager.clearAllSolventSetsFromBrowser;

// Initialize solvent set manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.solventSetManager = new SolventSetManager();
});
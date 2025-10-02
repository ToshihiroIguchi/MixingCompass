/**
 * Solvent Set Manager
 * Handles saving, loading, and managing solvent sets in localStorage
 */

class SolventSetManager {
    constructor() {
        this.storageKey = 'mixingCompass_solventSets';
        this.init();
    }

    init() {
        this.loadSolventSetsFromStorage();
        this.setupEventListeners();
        this.initializeSelectorWithRetry();
    }

    setupEventListeners() {
        // Wait for HSP experimental to initialize the table
        setTimeout(() => {
            this.attachDynamicEventListeners();
        }, 100);
    }

    attachDynamicEventListeners() {
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
    }

    initializeSelectorWithRetry() {
        let retryCount = 0;
        const maxRetries = 20; // 2 seconds total (20 * 100ms)

        const tryInitialize = () => {
            const selector = document.querySelector('#solvent-set-selector');

            if (selector) {
                console.log('Solvent set selector found, initializing...');
                this.updateSolventSetSelector();
                return true;
            }

            retryCount++;
            if (retryCount < maxRetries) {
                console.log(`Waiting for solvent set selector... (${retryCount}/${maxRetries})`);
                setTimeout(tryInitialize, 100);
            } else {
                console.warn('Solvent set selector not found after maximum retries');
            }
            return false;
        };

        // Start the retry process
        tryInitialize();

        // Also listen for HSP experimental ready event
        document.addEventListener('hspExperimentalReady', () => {
            console.log('HSP Experimental ready event received');
            this.updateSolventSetSelector();
        });
    }

    loadSolventSetsFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            this.solventSets = stored ? JSON.parse(stored) : [];
            console.log(`Loaded ${this.solventSets.length} solvent sets from storage`);
            // Don't call updateSolventSetSelector here - it will be called by initializeSelectorWithRetry
        } catch (error) {
            console.error('Error loading solvent sets from storage:', error);
            this.solventSets = [];
        }
    }

    saveSolventSetsToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.solventSets));
        } catch (error) {
            console.error('Error saving solvent sets to storage:', error);
            throw new Error('Failed to save solvent sets. Storage may be full.');
        }
    }

    updateSolventSetSelector() {
        const selector = document.querySelector('#solvent-set-selector');
        if (!selector) {
            console.warn('Solvent set selector not found, skipping update');
            return false;
        }

        // Clear existing options except the first placeholder
        selector.innerHTML = '<option value="">Select saved solvent set...</option>';

        // Sort by last used date (most recent first)
        const sortedSets = [...this.solventSets].sort((a, b) =>
            new Date(b.lastUsed || b.created) - new Date(a.lastUsed || a.created)
        );

        // Add options for each saved set
        sortedSets.forEach(set => {
            const option = document.createElement('option');
            option.value = set.id;
            option.textContent = `${set.name} (${set.solvents.length} solvents)`;
            selector.appendChild(option);
        });

        // Disable load button initially
        const loadBtn = document.querySelector('#load-solvent-set-btn');
        if (loadBtn) {
            loadBtn.disabled = true;
        }

        console.log(`Updated solvent set selector with ${this.solventSets.length} sets`);
        return true;
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
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    saveSolventSet(name, solvents) {
        try {
            // Check for duplicate names
            const existingIndex = this.solventSets.findIndex(set => set.name === name);

            const solventSet = {
                id: existingIndex >= 0 ? this.solventSets[existingIndex].id : this.generateId(),
                name: name,
                solvents: this.cleanSolventData(solvents),
                created: existingIndex >= 0 ? this.solventSets[existingIndex].created : new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                description: `${solvents.length} solvents`
            };

            if (existingIndex >= 0) {
                // Update existing set
                if (confirm(`A solvent set named "${name}" already exists. Do you want to overwrite it?`)) {
                    this.solventSets[existingIndex] = solventSet;
                    this.showNotification(`Solvent set "${name}" updated successfully`, 'success');
                } else {
                    return;
                }
            } else {
                // Add new set
                this.solventSets.push(solventSet);
                this.showNotification(`Solvent set "${name}" saved successfully`, 'success');
            }

            this.saveSolventSetsToStorage();
            this.updateSolventSetSelector();

        } catch (error) {
            console.error('Error saving solvent set:', error);
            this.showNotification('Failed to save solvent set', 'error');
        }
    }

    loadSelectedSolventSet() {
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

        this.loadSolventSet(solventSet);
    }


    loadSolventSet(solventSet) {
        try {
            const hspExperimental = window.hspExperimental;
            if (!hspExperimental) {
                alert('HSP Experimental interface not found');
                return;
            }

            // Clear existing solvent table
            this.clearSolventTable();

            // Load each solvent from the set
            solventSet.solvents.forEach(solventData => {
                hspExperimental.addSolventRow();
                const rows = document.querySelectorAll('#solvent-table-body tr');
                const newRow = rows[rows.length - 1];
                this.populateRowWithSolventSetData(newRow, solventData);
            });

            // Update the last used timestamp
            solventSet.lastUsed = new Date().toISOString();
            this.saveSolventSetsToStorage();
            this.updateSolventSetSelector();

            this.showNotification(`Loaded solvent set: ${solventSet.name}`, 'success');

        } catch (error) {
            console.error('Error loading solvent set:', error);
            this.showNotification('Failed to load solvent set', 'error');
        }
    }

    clearSolventTable() {
        const tbody = document.querySelector('#solvent-table-body');
        if (tbody) {
            tbody.innerHTML = '';
        }
    }

    populateRowWithSolventSetData(row, solventData) {
        try {
            // Set solvent name
            const nameInput = row.querySelector('.solvent-name-input');
            if (nameInput) {
                nameInput.value = solventData.solvent_name;
            }

            // Set HSP values if manual mode data exists
            if (solventData.manual_delta_d !== undefined) {
                const deltaD = row.querySelector('.delta-d');
                const deltaP = row.querySelector('.delta-p');
                const deltaH = row.querySelector('.delta-h');

                if (deltaD) deltaD.value = solventData.manual_delta_d;
                if (deltaP) deltaP.value = solventData.manual_delta_p;
                if (deltaH) deltaH.value = solventData.manual_delta_h;

                // Set to manual mode
                const hspExperimental = window.hspExperimental;
                if (hspExperimental) {
                    hspExperimental.setRowMode(row, 'manual');
                }
            } else {
                // Set to auto mode and trigger lookup
                const hspExperimental = window.hspExperimental;
                if (hspExperimental) {
                    hspExperimental.setRowMode(row, 'auto');
                    // Trigger solvent name lookup
                    hspExperimental.onSolventNameChange({ target: nameInput }, row);
                }
            }

            // Reset solubility to default (experiment-specific data should not be restored)
            const solubilitySelect = row.querySelector('.solubility-select');
            if (solubilitySelect) {
                solubilitySelect.value = ''; // Reset to default empty state
                const customInput = row.querySelector('.custom-solubility-input');
                if (customInput) {
                    customInput.style.display = 'none';
                    customInput.value = '';
                }
            }

            // Set notes
            const notesInput = row.querySelector('.notes-input');
            if (notesInput && solventData.notes) {
                notesInput.value = solventData.notes;
            }

        } catch (error) {
            console.error('Error populating row with solvent data:', error);
        }
    }

    cleanSolventData(solvents) {
        // Clean and validate solvent data before saving
        // Note: Solubility data is NOT saved as it's experiment-specific
        return solvents.map(solvent => ({
            solvent_name: solvent.solvent_name,
            notes: solvent.notes || null,
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
                this.showNotification(`Deleted solvent set: ${setName}`, 'success');
                return true;
            }
        }
        return false;
    }

    exportSolventSets() {
        try {
            const data = {
                version: '1.0',
                exported: new Date().toISOString(),
                solventSets: this.solventSets
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mixing-compass-solvent-sets-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification('Solvent sets exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting solvent sets:', error);
            this.showNotification('Failed to export solvent sets', 'error');
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
                    this.showNotification(`Imported ${importCount} new solvent sets`, 'success');
                    resolve(importCount);

                } catch (error) {
                    console.error('Error importing solvent sets:', error);
                    this.showNotification('Failed to import solvent sets', 'error');
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }

    generateId() {
        return 'set_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    showNotification(message, type = 'info') {
        // Use the existing notification system from HSP experimental
        const hspExperimental = window.hspExperimental;
        if (hspExperimental && hspExperimental.showNotification) {
            hspExperimental.showNotification(message, type);
        } else {
            // Fallback to alert
            alert(message);
        }
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
                localStorage.removeItem(this.storageKey);
                this.solventSets = [];
                this.updateSolventSetSelector();
                this.showNotification('All solvent set data has been cleared', 'success');
                console.log('All solvent sets data cleared from browser storage');
            } catch (error) {
                console.error('Error clearing stored data:', error);
                this.showNotification('Failed to clear data', 'error');
            }
        }
    }

    // Static method accessible from browser console for emergency clearing
    static clearAllSolventSetsFromBrowser() {
        const storageKey = 'mixingCompass_solventSets';
        if (confirm('Are you sure you want to delete all solvent set data stored in the browser?\n\nThis action cannot be undone.')) {
            try {
                localStorage.removeItem(storageKey);
                console.log('All solvent sets data cleared from browser storage');
                alert('Data has been cleared. The page will now reload.');
                // Refresh the page to reset the application state
                window.location.reload();
            } catch (error) {
                console.error('Error clearing stored data:', error);
                alert('Failed to clear data');
            }
        }
    }
}

// Global function accessible from browser console
window.clearAllSolventSetsData = SolventSetManager.clearAllSolventSetsFromBrowser;

// Initialize solvent set manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.solventSetManager = new SolventSetManager();
});
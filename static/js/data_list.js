/**
 * Data List Page Manager
 * Handles solvent set management interface
 */

class DataListManager {
    constructor() {
        this.currentEditingSet = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSolventSetsDisplay();
        this.loadExperimentalResultsDisplay();
    }

    setupEventListeners() {
        // Export sets button
        const exportBtn = document.querySelector('#export-sets-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportSolventSets());
        }

        // Import sets button
        const importBtn = document.querySelector('#import-sets-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.showImportDialog());
        }

        // Import file input
        const importInput = document.querySelector('#import-file-input');
        if (importInput) {
            importInput.addEventListener('change', (e) => this.handleImportFile(e));
        }

        // Edit modal controls
        const saveChangesBtn = document.querySelector('#save-set-changes');
        if (saveChangesBtn) {
            saveChangesBtn.addEventListener('click', () => this.saveSetChanges());
        }

        const cancelEditBtn = document.querySelector('#cancel-set-edit');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => this.closeEditModal());
        }

        const modalCloseBtn = document.querySelector('.modal-close');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => this.closeEditModal());
        }

        // Modal background click
        const modal = document.querySelector('#edit-set-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeEditModal();
                }
            });
        }
    }

    loadSolventSetsDisplay() {
        const solventSetManager = window.solventSetManager;
        if (!solventSetManager) {
            console.error('Solvent set manager not found');
            return;
        }

        const solventSets = solventSetManager.getSolventSets();
        this.displaySolventSets(solventSets);
        this.updateSetsCount(solventSets.length);
    }

    displaySolventSets(solventSets) {
        const listContainer = document.querySelector('#solvent-sets-list');
        if (!listContainer) return;

        if (solventSets.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>No solvent sets saved yet.</p>
                    <p>Create sets in the <a href="/">HSP Analysis</a> page to manage them here.</p>
                </div>
            `;
            return;
        }

        // Sort sets by last used date (most recent first)
        const sortedSets = [...solventSets].sort((a, b) =>
            new Date(b.lastUsed || b.created) - new Date(a.lastUsed || a.created)
        );

        const setsHTML = sortedSets.map(set => this.createSetCardHTML(set)).join('');
        listContainer.innerHTML = setsHTML;

        // Add event listeners for set actions
        this.attachSetActionListeners();
    }

    createSetCardHTML(set) {
        const createdDate = new Date(set.created).toLocaleDateString();
        const lastUsedDate = set.lastUsed ? new Date(set.lastUsed).toLocaleDateString() : 'Never';

        return `
            <div class="solvent-set-card" data-set-id="${set.id}">
                <div class="set-card-header">
                    <h4 class="set-name">${this.escapeHtml(set.name)}</h4>
                    <div class="set-actions">
                        <button class="btn-icon edit-set-btn" title="Edit set" data-set-id="${set.id}">
                            ✏️
                        </button>
                        <button class="btn-icon delete-set-btn" title="Delete set" data-set-id="${set.id}">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="set-card-content">
                    <div class="set-info">
                        <span class="set-solvent-count">${set.solvents.length} solvents</span>
                        <span class="set-dates">
                            Created: ${createdDate} | Last used: ${lastUsedDate}
                        </span>
                    </div>
                    <div class="set-solvents-preview">
                        ${this.createSolventsPreviewHTML(set.solvents)}
                    </div>
                </div>
                <div class="set-card-footer">
                    <button class="btn btn-primary btn-small load-set-btn" data-set-id="${set.id}">
                        Load in HSP Analysis
                    </button>
                </div>
            </div>
        `;
    }

    createSolventsPreviewHTML(solvents) {
        if (solvents.length === 0) return '<span class="no-solvents">No solvents</span>';

        const preview = solvents.slice(0, 5).map(solvent => {
            const solubilityLabel = this.getSolubilityLabel(solvent.solubility);
            return `<span class="solvent-preview" title="${solvent.solvent_name} (${solubilityLabel})">${solvent.solvent_name}</span>`;
        }).join('');

        const remaining = solvents.length - 5;
        const moreText = remaining > 0 ? ` <span class="more-solvents">+${remaining} more</span>` : '';

        return preview + moreText;
    }

    getSolubilityLabel(solubility) {
        if (typeof solubility === 'number') {
            return `Custom: ${solubility}`;
        }
        const labels = {
            'soluble': 'Soluble',
            'insoluble': 'Insoluble',
            'partial': 'Partial'
        };
        return labels[solubility] || 'Unknown';
    }

    attachSetActionListeners() {
        // Edit buttons
        document.querySelectorAll('.edit-set-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const setId = e.target.dataset.setId;
                this.editSolventSet(setId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-set-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const setId = e.target.dataset.setId;
                this.deleteSolventSet(setId);
            });
        });

        // Load buttons
        document.querySelectorAll('.load-set-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const setId = e.target.dataset.setId;
                this.loadSolventSetInAnalysis(setId);
            });
        });
    }

    editSolventSet(setId) {
        const solventSetManager = window.solventSetManager;
        if (!solventSetManager) return;

        const solventSet = solventSetManager.getSolventSetById(setId);
        if (!solventSet) {
            alert('Solvent set not found');
            return;
        }

        this.currentEditingSet = solventSet;
        this.showEditModal(solventSet);
    }

    showEditModal(solventSet) {
        const modal = document.querySelector('#edit-set-modal');
        const nameInput = document.querySelector('#edit-set-name');
        const solventsList = document.querySelector('#edit-solvents-list');

        if (!modal || !nameInput || !solventsList) return;

        // Populate modal with set data
        nameInput.value = solventSet.name;

        // Create editable solvents list
        const solventsHTML = solventSet.solvents.map((solvent, index) => `
            <div class="edit-solvent-item" data-index="${index}">
                <div class="solvent-field">
                    <label>Solvent:</label>
                    <input type="text" class="solvent-name-field" value="${this.escapeHtml(solvent.solvent_name)}">
                </div>
                <div class="solvent-field">
                    <label>Solubility:</label>
                    <select class="solubility-field">
                        <option value="soluble" ${solvent.solubility === 'soluble' ? 'selected' : ''}>Soluble</option>
                        <option value="partial" ${solvent.solubility === 'partial' ? 'selected' : ''}>Partial</option>
                        <option value="insoluble" ${solvent.solubility === 'insoluble' ? 'selected' : ''}>Insoluble</option>
                        <option value="custom" ${typeof solvent.solubility === 'number' ? 'selected' : ''}>Custom</option>
                    </select>
                    ${typeof solvent.solubility === 'number' ?
                        `<input type="number" class="custom-solubility-field" min="0" max="1" step="0.1" value="${solvent.solubility}">` :
                        `<input type="number" class="custom-solubility-field" min="0" max="1" step="0.1" style="display: none;">`
                    }
                </div>
                <div class="solvent-field">
                    <label>Notes:</label>
                    <input type="text" class="notes-field" value="${this.escapeHtml(solvent.notes || '')}">
                </div>
                <button class="btn-icon remove-solvent-btn" title="Remove solvent" data-index="${index}">×</button>
            </div>
        `).join('');

        solventsList.innerHTML = solventsHTML + `
            <button id="add-solvent-to-set" class="btn btn-secondary btn-small">Add Solvent</button>
        `;

        // Add event listeners for dynamic controls
        this.setupEditModalListeners();

        modal.style.display = 'block';
    }

    setupEditModalListeners() {
        // Solubility select change handlers
        document.querySelectorAll('.solubility-field').forEach(select => {
            select.addEventListener('change', (e) => {
                const customInput = e.target.parentNode.querySelector('.custom-solubility-field');
                if (e.target.value === 'custom') {
                    customInput.style.display = 'inline-block';
                } else {
                    customInput.style.display = 'none';
                }
            });
        });

        // Remove solvent buttons
        document.querySelectorAll('.remove-solvent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.edit-solvent-item').remove();
            });
        });

        // Add solvent button
        const addBtn = document.querySelector('#add-solvent-to-set');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addSolventToEditList());
        }
    }

    addSolventToEditList() {
        const solventsList = document.querySelector('#edit-solvents-list');
        const addBtn = document.querySelector('#add-solvent-to-set');

        const newIndex = document.querySelectorAll('.edit-solvent-item').length;
        const newSolventHTML = `
            <div class="edit-solvent-item" data-index="${newIndex}">
                <div class="solvent-field">
                    <label>Solvent:</label>
                    <input type="text" class="solvent-name-field" placeholder="Enter solvent name">
                </div>
                <div class="solvent-field">
                    <label>Solubility:</label>
                    <select class="solubility-field">
                        <option value="soluble">Soluble</option>
                        <option value="partial">Partial</option>
                        <option value="insoluble" selected>Insoluble</option>
                        <option value="custom">Custom</option>
                    </select>
                    <input type="number" class="custom-solubility-field" min="0" max="1" step="0.1" style="display: none;">
                </div>
                <div class="solvent-field">
                    <label>Notes:</label>
                    <input type="text" class="notes-field" placeholder="Optional notes">
                </div>
                <button class="btn-icon remove-solvent-btn" title="Remove solvent" data-index="${newIndex}">×</button>
            </div>
        `;

        addBtn.insertAdjacentHTML('beforebegin', newSolventHTML);
        this.setupEditModalListeners();
    }

    saveSetChanges() {
        const nameInput = document.querySelector('#edit-set-name');
        const newName = nameInput.value.trim();

        if (!newName) {
            alert('Please enter a set name');
            return;
        }

        // Collect solvent data from form
        const solventItems = document.querySelectorAll('.edit-solvent-item');
        const solvents = [];

        solventItems.forEach(item => {
            const name = item.querySelector('.solvent-name-field').value.trim();
            if (!name) return; // Skip empty entries

            const solubilitySelect = item.querySelector('.solubility-field');
            const customInput = item.querySelector('.custom-solubility-field');
            const notes = item.querySelector('.notes-field').value.trim();

            let solubility;
            if (solubilitySelect.value === 'custom') {
                solubility = parseFloat(customInput.value) || 0.5;
            } else {
                solubility = solubilitySelect.value;
            }

            solvents.push({
                solvent_name: name,
                solubility: solubility,
                notes: notes || null
            });
        });

        if (solvents.length === 0) {
            alert('Please add at least one solvent');
            return;
        }

        // Update the set
        this.currentEditingSet.name = newName;
        this.currentEditingSet.solvents = solvents;
        this.currentEditingSet.lastUsed = new Date().toISOString();

        // Save to storage
        const solventSetManager = window.solventSetManager;
        if (solventSetManager) {
            solventSetManager.saveSolventSetsToStorage();
            this.showNotification(`Updated solvent set: ${newName}`, 'success');
        }

        this.closeEditModal();
        this.loadSolventSetsDisplay();
    }

    closeEditModal() {
        const modal = document.querySelector('#edit-set-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentEditingSet = null;
    }

    deleteSolventSet(setId) {
        const solventSetManager = window.solventSetManager;
        if (!solventSetManager) return;

        const solventSet = solventSetManager.getSolventSetById(setId);
        if (!solventSet) return;

        if (confirm(`Are you sure you want to delete the solvent set "${solventSet.name}"?`)) {
            if (solventSetManager.deleteSolventSet(setId)) {
                this.loadSolventSetsDisplay();
            }
        }
    }

    loadSolventSetInAnalysis(setId) {
        const solventSetManager = window.solventSetManager;
        if (!solventSetManager) return;

        const solventSet = solventSetManager.getSolventSetById(setId);
        if (!solventSet) return;

        // Store the set ID to load and redirect
        sessionStorage.setItem('loadSolventSetId', setId);
        window.location.href = '/';
    }

    exportSolventSets() {
        const solventSetManager = window.solventSetManager;
        if (solventSetManager) {
            solventSetManager.exportSolventSets();
        }
    }

    showImportDialog() {
        const fileInput = document.querySelector('#import-file-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    async handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const solventSetManager = window.solventSetManager;
        if (!solventSetManager) return;

        try {
            await solventSetManager.importSolventSets(file);
            this.loadSolventSetsDisplay();
        } catch (error) {
            console.error('Import failed:', error);
        }

        // Clear the file input
        event.target.value = '';
    }

    updateSetsCount(count) {
        const countBadge = document.querySelector('#sets-count');
        if (countBadge) {
            countBadge.textContent = `${count} ${count === 1 ? 'set' : 'sets'}`;
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Simple notification - could be enhanced with a proper notification system
        alert(message);
    }

    // === Experimental Results Management ===

    loadExperimentalResultsDisplay() {
        const listContainer = document.querySelector('#experimental-results-list');
        if (!listContainer) {
            console.warn('Experimental results list container not found');
            return;
        }

        // Get experimental results from storage
        const results = window.experimentalResultsManager ?
            window.experimentalResultsManager.getExperimentalResults() : [];

        if (results.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <h4>No Experimental Results</h4>
                    <p>Saved experimental results will appear here after you run HSP calculations.</p>
                </div>
            `;
            return;
        }

        // Generate results cards HTML
        const resultsHTML = results.map(result => this.createExperimentalResultCard(result)).join('');

        listContainer.innerHTML = resultsHTML;

        // Add event listeners for result actions
        this.setupExperimentalResultsListeners();
    }

    createExperimentalResultCard(result) {
        const created = new Date(result.created);
        const lastModified = result.last_modified ? new Date(result.last_modified) : created;

        return `
            <div class="experimental-result-card" data-result-id="${result.id}">
                <div class="result-card-header">
                    <h4 class="result-sample-name">${this.escapeHtml(result.sample_name)}</h4>
                    <div class="result-actions">
                        <button class="btn-icon load-result-btn" title="Load result" data-result-id="${result.id}">📖</button>
                        <button class="btn-icon edit-result-btn" title="Edit metadata" data-result-id="${result.id}">✏️</button>
                        <button class="btn-icon export-single-result-btn" title="Export result" data-result-id="${result.id}">📤</button>
                        <button class="btn-icon delete-result-btn" title="Delete result" data-result-id="${result.id}">🗑️</button>
                    </div>
                </div>
                <div class="result-card-content">
                    <div class="result-metadata">
                        <div class="metadata-item">
                            <span class="metadata-label">Created:</span>
                            <span class="metadata-value">${created.toLocaleDateString()} ${created.toLocaleTimeString()}</span>
                        </div>
                        ${result.last_modified && result.last_modified !== result.created ? `
                        <div class="metadata-item">
                            <span class="metadata-label">Modified:</span>
                            <span class="metadata-value">${lastModified.toLocaleDateString()} ${lastModified.toLocaleTimeString()}</span>
                        </div>
                        ` : ''}
                        <div class="metadata-item">
                            <span class="metadata-label">Solvents:</span>
                            <span class="metadata-value">${result.metadata.solvent_count}</span>
                        </div>
                    </div>
                    <div class="result-hsp-values">
                        <div class="hsp-summary">
                            <span class="hsp-label">HSP:</span>
                            <span class="hsp-value">δD: ${result.hsp_result.delta_d.toFixed(1)}</span>
                            <span class="hsp-value">δP: ${result.hsp_result.delta_p.toFixed(1)}</span>
                            <span class="hsp-value">δH: ${result.hsp_result.delta_h.toFixed(1)}</span>
                            <span class="hsp-value">Ra: ${result.hsp_result.radius.toFixed(1)}</span>
                        </div>
                    </div>
                    ${result.metadata.notes ? `
                    <div class="result-notes">
                        <span class="notes-label">Notes:</span>
                        <span class="notes-value">${this.escapeHtml(result.metadata.notes)}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    setupExperimentalResultsListeners() {
        // Load result buttons
        document.querySelectorAll('.load-result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const resultId = e.target.dataset.resultId;
                this.loadExperimentalResult(resultId);
            });
        });

        // Edit result buttons
        document.querySelectorAll('.edit-result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const resultId = e.target.dataset.resultId;
                this.editExperimentalResult(resultId);
            });
        });

        // Export single result buttons
        document.querySelectorAll('.export-single-result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const resultId = e.target.dataset.resultId;
                this.exportSingleExperimentalResult(resultId);
            });
        });

        // Delete result buttons
        document.querySelectorAll('.delete-result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const resultId = e.target.dataset.resultId;
                this.deleteExperimentalResult(resultId);
            });
        });
    }

    loadExperimentalResult(resultId) {
        try {
            if (!window.experimentalResultsManager) {
                this.showNotification('Experimental results manager not available', 'error');
                return;
            }

            const result = window.experimentalResultsManager.getExperimentalResultById(resultId);
            if (!result) {
                this.showNotification('Experimental result not found', 'error');
                return;
            }

            // Store result ID in session storage for the HSP experimental page to pick up
            sessionStorage.setItem('loadExperimentalResultId', resultId);

            // Navigate to HSP experimental page
            const currentUrl = new URL(window.location);
            currentUrl.hash = '';
            currentUrl.search = '';
            window.location.href = currentUrl.origin + currentUrl.pathname + '#hsp-experimental';

            // Trigger navigation if we're already on the page
            if (window.location.hash === '#hsp-experimental') {
                window.location.reload();
            }

        } catch (error) {
            console.error('Error loading experimental result:', error);
            this.showNotification('Failed to load experimental result', 'error');
        }
    }

    editExperimentalResult(resultId) {
        // Show edit modal for result metadata (sample name, notes)
        // Implementation would go here - for now, show placeholder
        alert('Edit experimental result feature - to be implemented');
    }

    exportSingleExperimentalResult(resultId) {
        try {
            if (!window.experimentalResultsManager) {
                this.showNotification('Experimental results manager not available', 'error');
                return;
            }

            const result = window.experimentalResultsManager.getExperimentalResultById(resultId);
            if (!result) {
                this.showNotification('Experimental result not found', 'error');
                return;
            }

            // Create export data
            const exportData = {
                version: '1.0',
                exported: new Date().toISOString(),
                experimental_result: result
            };

            // Create and download file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hsp-result-${result.sample_name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification(`Exported: ${result.sample_name}`, 'success');

        } catch (error) {
            console.error('Error exporting experimental result:', error);
            this.showNotification('Failed to export experimental result', 'error');
        }
    }

    deleteExperimentalResult(resultId) {
        try {
            if (!window.experimentalResultsManager) {
                this.showNotification('Experimental results manager not available', 'error');
                return;
            }

            if (window.experimentalResultsManager.deleteExperimentalResult(resultId)) {
                // Refresh the display
                this.loadExperimentalResultsDisplay();
            }

        } catch (error) {
            console.error('Error deleting experimental result:', error);
            this.showNotification('Failed to delete experimental result', 'error');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if we need to load a specific solvent set from session storage
    const loadSetId = sessionStorage.getItem('loadSolventSetId');
    if (loadSetId) {
        sessionStorage.removeItem('loadSolventSetId');
        // This will be handled by the main page
    }

    window.dataListManager = new DataListManager();
});
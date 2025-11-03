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
        this.loadUserAddedSolvents();
        this.loadSolventDatabase();
        this.loadSolventSetsDisplay();
        this.loadExperimentalResultsDisplay();
    }

    setupEventListeners() {
        // Solvent database search (global search across all columns)
        const dbSearchInput = document.querySelector('#solvent-database-search');
        if (dbSearchInput) {
            let searchTimeout;
            dbSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const searchTerm = e.target.value.trim();
                    if (this.solventDatabaseTable) {
                        if (searchTerm) {
                            // Apply global filter across name, CAS fields
                            this.solventDatabaseTable.setFilter([
                                { field: "solvent", type: "like", value: searchTerm },
                                { field: "cas", type: "like", value: searchTerm },
                            ], "or");
                        } else {
                            this.solventDatabaseTable.clearFilter();
                        }
                    }
                }, 300);
            });
        }

        // Refresh database button
        const refreshDbBtn = document.querySelector('#refresh-database-btn');
        if (refreshDbBtn) {
            refreshDbBtn.addEventListener('click', () => {
                const searchInput = document.querySelector('#solvent-database-search');
                if (searchInput) searchInput.value = '';
                if (this.solventDatabaseTable) {
                    this.solventDatabaseTable.clearFilter();
                }
                this.loadSolventDatabase();
            });
        }

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
        const createdDate = Utils.formatDate(set.created);
        const lastUsedDate = set.lastUsed ? Utils.formatDate(set.lastUsed) : 'Never';

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
        this.currentEditingSet.lastUsed = Utils.formatISO();

        // Save to storage
        const solventSetManager = window.solventSetManager;
        if (solventSetManager) {
            solventSetManager.saveSolventSetsToStorage();
            Notification.success(`Updated solvent set: ${newName}`);
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

        // Store the set ID to load
        sessionStorage.setItem('loadSolventSetId', setId);

        // Switch to HSP Experimental tab
        if (window.mixingCompass) {
            window.mixingCompass.switchSection('hsp-experimental');
        }
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

    // === Solvent Database Management ===

    async loadSolventDatabase(searchQuery = '') {
        const container = document.querySelector('#solvent-database-table');
        const countBadge = document.querySelector('#database-count');

        if (!container) {
            console.error('Solvent database table container not found');
            return;
        }

        try {
            // Fetch total count first
            const response = await fetch('/api/data-list/solvents?limit=1&offset=0');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const initialData = await response.json();

            // Update count badge
            if (countBadge) {
                countBadge.textContent = `${initialData.total} solvents`;
            }

            // Initialize or update Tabulator
            if (this.solventDatabaseTable) {
                // Clear filters and reload data
                this.solventDatabaseTable.clearFilter();
                this.solventDatabaseTable.setData();
            } else {
                // Create new Tabulator instance with progressive load
                this.solventDatabaseTable = new Tabulator("#solvent-database-table", {
                    ajaxURL: "/api/data-list/solvents",
                    ajaxParams: { limit: 100, offset: 0 },
                    progressiveLoad: "scroll",
                    paginationSize: 100,
                    ajaxURLGenerator: (url, config, params) => {
                        // Convert Tabulator params to our API format
                        const page = params.page || 1;
                        const size = params.size || 100;
                        const offset = (page - 1) * size;
                        return `${url}?limit=${size}&offset=${offset}`;
                    },
                    ajaxResponse: (url, params, response) => {
                        // Return data in format Tabulator expects
                        return response.solvents || response.data || response;
                    },
                    dataLoader: true,
                    dataLoaderLoading: `
                        <div style="display: flex; flex-direction: column; align-items: center; padding: 40px; color: #666;">
                            <div style="font-size: 3rem; margin-bottom: 10px;">⏳</div>
                            <div style="font-size: 1.1rem; font-weight: 500;">Loading solvent database...</div>
                            <div style="font-size: 0.9rem; margin-top: 5px;">${initialData.total} solvents available</div>
                        </div>
                    `,
                    layout: "fitDataFill",
                    responsiveLayout: "collapse",
                    pagination: false,
                    movableColumns: true,
                    resizableColumns: true,
                    initialSort: [
                        { column: "solvent", dir: "asc" }
                    ],
                    columns: [
                        {
                            title: "Solvent",
                            field: "solvent",
                            minWidth: 200,
                            headerFilter: "input",
                            headerFilterPlaceholder: "Filter...",
                            sorter: "string"
                        },
                        {
                            title: "δD",
                            field: "delta_d",
                            minWidth: 80,
                            hozAlign: "right",
                            headerFilter: "number",
                            headerFilterPlaceholder: "Min",
                            headerFilterFunc: ">=",
                            formatter: (cell) => {
                                const value = cell.getValue();
                                return value !== null && value !== undefined ? value.toFixed(1) : '-';
                            },
                            sorter: "number"
                        },
                        {
                            title: "δP",
                            field: "delta_p",
                            minWidth: 80,
                            hozAlign: "right",
                            headerFilter: "number",
                            headerFilterPlaceholder: "Min",
                            headerFilterFunc: ">=",
                            formatter: (cell) => {
                                const value = cell.getValue();
                                return value !== null && value !== undefined ? value.toFixed(1) : '-';
                            },
                            sorter: "number"
                        },
                        {
                            title: "δH",
                            field: "delta_h",
                            minWidth: 80,
                            hozAlign: "right",
                            headerFilter: "number",
                            headerFilterPlaceholder: "Min",
                            headerFilterFunc: ">=",
                            formatter: (cell) => {
                                const value = cell.getValue();
                                return value !== null && value !== undefined ? value.toFixed(1) : '-';
                            },
                            sorter: "number"
                        },
                        {
                            title: "CAS",
                            field: "cas",
                            minWidth: 120,
                            headerFilter: "input",
                            headerFilterPlaceholder: "Filter...",
                            formatter: (cell) => {
                                const value = cell.getValue();
                                return value || '-';
                            }
                        },
                        {
                            title: "BP (°C)",
                            field: "boiling_point",
                            minWidth: 100,
                            hozAlign: "right",
                            headerFilter: "number",
                            headerFilterPlaceholder: "Min",
                            headerFilterFunc: ">=",
                            formatter: (cell) => {
                                const value = cell.getValue();
                                return value !== null && value !== undefined ? value.toFixed(1) : '-';
                            },
                            sorter: "number"
                        },
                        {
                            title: "Link",
                            field: "source_url",
                            minWidth: 80,
                            hozAlign: "center",
                            headerSort: false,
                            formatter: (cell) => {
                                const row = cell.getRow().getData();
                                const sourceUrl = row.source_url;
                                const sourceFile = row.source_file;

                                // If no URL and it's a user-added solvent, show nothing
                                if (!sourceUrl && sourceFile === 'user_added') {
                                    return '-';
                                }

                                // If there's a URL, show link icon
                                if (sourceUrl) {
                                    return `<a href="${this.escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="source-link" title="${this.escapeHtml(sourceUrl)}">🔗</a>`;
                                }

                                // If no URL but has source file, show link icon without href
                                if (sourceFile && sourceFile !== 'user_added') {
                                    const sourceName = this.formatSource(sourceFile);
                                    return `<span class="source-icon" title="Source: ${this.escapeHtml(sourceName)} (no URL available)">🔗</span>`;
                                }

                                return '-';
                            }
                        }
                    ]
                });
            }

            console.log(`Loaded ${data.solvents.length} of ${data.total} solvents into Tabulator`);

        } catch (error) {
            console.error('Error loading solvent database:', error);
            if (container) {
                container.innerHTML = `<div class="error-cell">Error loading solvent database: ${error.message}</div>`;
            }
            Notification.error('Failed to load solvent database');
        }
    }

    formatSource(sourceFile) {
        if (!sourceFile) return '-';
        if (sourceFile === 'user_added') return 'User Added';

        // Extract filename from path
        const filename = sourceFile.split(/[/\\]/).pop();
        return filename || sourceFile;
    }

    formatSourceLink(sourceUrl, sourceFile) {
        // If no URL and it's a user-added solvent, show nothing
        if (!sourceUrl && sourceFile === 'user_added') {
            return '-';
        }

        // If there's a URL, show link icon that opens URL
        if (sourceUrl) {
            return `<a href="${this.escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="source-link" title="${this.escapeHtml(sourceUrl)}">🔗</a>`;
        }

        // If no URL but has source file, show link icon without href (not clickable)
        if (sourceFile && sourceFile !== 'user_added') {
            const sourceName = this.formatSource(sourceFile);
            return `<span class="source-icon" title="Source: ${this.escapeHtml(sourceName)} (no URL available)">🔗</span>`;
        }

        return '-';
    }

    /**
     * Format solvent property values for display
     * @param {Object} solvent - Solvent data object
     * @returns {Object} Formatted values
     */
    formatSolventValues(solvent) {
        return {
            deltaD: solvent.delta_d !== null ? solvent.delta_d.toFixed(1) : '-',
            deltaP: solvent.delta_p !== null ? solvent.delta_p.toFixed(1) : '-',
            deltaH: solvent.delta_h !== null ? solvent.delta_h.toFixed(1) : '-',
            cas: solvent.cas || '-',
            bp: solvent.boiling_point !== null ? solvent.boiling_point.toFixed(1) : '-'
        };
    }

    /**
     * Refresh all solvent-related tables
     */
    async refreshAllTables() {
        await this.loadUserAddedSolvents();
        await this.loadSolventDatabase();
    }

    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }

    showNotification(message, type = 'info') {
        Notification.show(message, type);
    }

    // === User Added Solvents Management ===

    async loadUserAddedSolvents() {
        const tbody = document.querySelector('#user-solvents-tbody');
        const countBadge = document.querySelector('#user-solvents-count');

        if (!tbody) {
            console.error('User solvents table body not found');
            return;
        }

        try {
            // Fetch user-added solvents
            const response = await fetch('/api/data-list/user-solvents');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const solvents = await response.json();

            // Update count badge
            if (countBadge) {
                countBadge.textContent = `${solvents.length} solvents`;
            }

            // Display results
            if (solvents.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No user-added solvents yet. Add solvents in the HSP Experimental page using Manual mode.</td></tr>';
                return;
            }

            // Create table rows with edit/delete buttons
            const rows = solvents.map(solvent => {
                const values = this.formatSolventValues(solvent);

                return `
                    <tr>
                        <td class="solvent-name-cell">${this.escapeHtml(solvent.solvent)}</td>
                        <td>${values.deltaD}</td>
                        <td>${values.deltaP}</td>
                        <td>${values.deltaH}</td>
                        <td class="cas-cell">${this.escapeHtml(values.cas)}</td>
                        <td>${values.bp}</td>
                        <td class="actions-cell">
                            <button class="btn-icon edit-user-solvent-btn" title="Edit" data-solvent='${JSON.stringify(solvent).replace(/'/g, "&apos;")}'>✏️</button>
                            <button class="btn-icon delete-user-solvent-btn" title="Delete" data-solvent-name="${this.escapeHtml(solvent.solvent)}">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = rows;

            // Attach event listeners
            this.setupUserSolventListeners();

            console.log(`Loaded ${solvents.length} user-added solvents`);

        } catch (error) {
            console.error('Error loading user-added solvents:', error);
            tbody.innerHTML = `<tr><td colspan="7" class="error-cell">Error loading user-added solvents: ${error.message}</td></tr>`;
            Notification.error('Failed to load user-added solvents');
        }
    }

    setupUserSolventListeners() {
        // Edit buttons
        document.querySelectorAll('.edit-user-solvent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const solventData = JSON.parse(e.target.dataset.solvent);
                this.showEditUserSolventModal(solventData);
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-user-solvent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const solventName = e.target.dataset.solventName;
                this.deleteUserSolvent(solventName);
            });
        });

        // Edit modal controls
        const saveBtn = document.querySelector('#save-user-solvent-btn');
        const cancelBtn = document.querySelector('#cancel-edit-user-solvent-btn');
        const closeBtn = document.querySelector('#edit-user-solvent-modal .modal-close');
        const modal = document.querySelector('#edit-user-solvent-modal');

        if (saveBtn && !saveBtn.hasAttribute('data-listener-attached')) {
            saveBtn.setAttribute('data-listener-attached', 'true');
            saveBtn.addEventListener('click', () => this.saveUserSolventChanges());
        }

        if (cancelBtn && !cancelBtn.hasAttribute('data-listener-attached')) {
            cancelBtn.setAttribute('data-listener-attached', 'true');
            cancelBtn.addEventListener('click', () => this.closeEditUserSolventModal());
        }

        if (closeBtn && !closeBtn.hasAttribute('data-listener-attached')) {
            closeBtn.setAttribute('data-listener-attached', 'true');
            closeBtn.addEventListener('click', () => this.closeEditUserSolventModal());
        }

        if (modal && !modal.hasAttribute('data-listener-attached')) {
            modal.setAttribute('data-listener-attached', 'true');
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeEditUserSolventModal();
                }
            });
        }
    }

    showEditUserSolventModal(solventData) {
        const modal = document.querySelector('#edit-user-solvent-modal');
        const nameInput = document.querySelector('#edit-solvent-name');
        const deltaDInput = document.querySelector('#edit-delta-d');
        const deltaPInput = document.querySelector('#edit-delta-p');
        const deltaHInput = document.querySelector('#edit-delta-h');
        const casInput = document.querySelector('#edit-cas');
        const bpInput = document.querySelector('#edit-boiling-point');

        if (!modal) return;

        // Store original solvent name for update
        modal.setAttribute('data-original-name', solventData.solvent);

        // Populate form
        if (nameInput) nameInput.value = solventData.solvent || '';
        if (deltaDInput) deltaDInput.value = solventData.delta_d !== null ? solventData.delta_d : '';
        if (deltaPInput) deltaPInput.value = solventData.delta_p !== null ? solventData.delta_p : '';
        if (deltaHInput) deltaHInput.value = solventData.delta_h !== null ? solventData.delta_h : '';
        if (casInput) casInput.value = solventData.cas || '';
        if (bpInput) bpInput.value = solventData.boiling_point !== null ? solventData.boiling_point : '';

        modal.style.display = 'block';
    }

    closeEditUserSolventModal() {
        const modal = document.querySelector('#edit-user-solvent-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.removeAttribute('data-original-name');
        }
    }

    async saveUserSolventChanges() {
        const modal = document.querySelector('#edit-user-solvent-modal');
        const originalName = modal.getAttribute('data-original-name');

        const nameInput = document.querySelector('#edit-solvent-name');
        const deltaDInput = document.querySelector('#edit-delta-d');
        const deltaPInput = document.querySelector('#edit-delta-p');
        const deltaHInput = document.querySelector('#edit-delta-h');
        const casInput = document.querySelector('#edit-cas');
        const bpInput = document.querySelector('#edit-boiling-point');

        // Validate required fields
        const newName = nameInput.value.trim();
        const deltaD = parseFloat(deltaDInput.value);
        const deltaP = parseFloat(deltaPInput.value);
        const deltaH = parseFloat(deltaHInput.value);

        if (!newName) {
            Notification.error('Solvent name is required');
            return;
        }

        if (isNaN(deltaD) || isNaN(deltaP) || isNaN(deltaH)) {
            Notification.error('HSP values (δD, δP, δH) are required');
            return;
        }

        // Prepare update data
        const updateData = {
            solvent: newName,
            delta_d: deltaD,
            delta_p: deltaP,
            delta_h: deltaH,
            cas: casInput.value.trim() || null,
            boiling_point: bpInput.value ? parseFloat(bpInput.value) : null,
            smiles: null,
            source_file: 'user_added',
            source_url: null
        };

        try {
            // Send PUT request
            const response = await fetch(`/api/data-list/user-solvents/${encodeURIComponent(originalName)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            Notification.success(`Solvent '${newName}' updated successfully`);
            this.closeEditUserSolventModal();

            // Reload all tables to reflect changes
            await this.refreshAllTables();

        } catch (error) {
            console.error('Error updating user solvent:', error);
            Notification.error(`Failed to update solvent: ${error.message}`);
        }
    }

    async deleteUserSolvent(solventName) {
        if (!confirm(`Are you sure you want to delete the solvent "${solventName}"?`)) {
            return;
        }

        try {
            // Send DELETE request
            const response = await fetch(`/api/data-list/user-solvents/${encodeURIComponent(solventName)}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            Notification.success(`Solvent '${solventName}' deleted successfully`);

            // Reload all tables to reflect changes
            await this.refreshAllTables();

        } catch (error) {
            console.error('Error deleting user solvent:', error);
            Notification.error(`Failed to delete solvent: ${error.message}`);
        }
    }

    // === Experimental Results Management ===

    loadExperimentalResultsDisplay() {
        const tableContainer = document.querySelector('#experimental-results-table');
        const emptyState = document.querySelector('#experimental-results-empty');
        const countBadge = document.querySelector('#results-count');

        if (!tableContainer) {
            console.warn('Experimental results table container not found');
            return;
        }

        // Get experimental results from storage
        const results = window.experimentalResultsManager ?
            window.experimentalResultsManager.getExperimentalResults() : [];

        // Update count badge
        if (countBadge) {
            countBadge.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
        }

        if (results.length === 0) {
            tableContainer.style.display = 'none';
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            return;
        }

        // Show table and hide empty state
        tableContainer.style.display = 'block';
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        // Initialize Tabulator
        this.experimentalResultsTable = new Tabulator("#experimental-results-table", {
            data: results,
            dataLoader: true,
            dataLoaderLoading: `
                <div style="display: flex; flex-direction: column; align-items: center; padding: 40px; color: #666;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">⏳</div>
                    <div style="font-size: 1.1rem; font-weight: 500;">Loading experimental results...</div>
                    <div style="font-size: 0.9rem; margin-top: 5px;">${results.length} result${results.length !== 1 ? 's' : ''} found</div>
                </div>
            `,
            layout: "fitColumns",
            responsiveLayout: "collapse",
            pagination: true,
            paginationSize: 10,
            paginationSizeSelector: [5, 10, 20, 50],
            movableColumns: true,
            resizableColumns: true,
            columns: [
                {
                    title: "Name",
                    field: "sample_name",
                    minWidth: 150,
                    headerFilter: "input",
                    editor: "input",
                    cellEdited: (cell) => {
                        const row = cell.getRow().getData();
                        window.experimentalResultsManager.updateExperimentalResultMetadata(
                            row.id,
                            row.sample_name,
                            row.metadata.notes
                        );
                        this.showNotification('Sample name updated', 'success');
                    }
                },
                {
                    title: "δD",
                    field: "hsp_result.delta_d",
                    minWidth: 80,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        return value != null ? value.toFixed(1) : '-';
                    },
                    sorter: "number"
                },
                {
                    title: "δP",
                    field: "hsp_result.delta_p",
                    minWidth: 80,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        return value != null ? value.toFixed(1) : '-';
                    },
                    sorter: "number"
                },
                {
                    title: "δH",
                    field: "hsp_result.delta_h",
                    minWidth: 80,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        return value != null ? value.toFixed(1) : '-';
                    },
                    sorter: "number"
                },
                {
                    title: "R₀",
                    field: "hsp_result.radius",
                    minWidth: 80,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        return value != null ? value.toFixed(1) : '-';
                    },
                    sorter: "number"
                },
                {
                    title: "Solvents",
                    field: "metadata.solvent_count",
                    minWidth: 90,
                    hozAlign: "center",
                    sorter: "number"
                },
                {
                    title: "Created",
                    field: "created",
                    minWidth: 140,
                    formatter: (cell) => {
                        return Utils.formatDateTime(cell.getValue());
                    },
                    sorter: "date"
                },
                {
                    title: "Actions",
                    minWidth: 200,
                    width: 200,
                    hozAlign: "center",
                    headerSort: false,
                    formatter: (cell) => {
                        return `
                            <button class="btn-icon" title="Load" data-action="load">📖</button>
                            <button class="btn-icon" title="Edit" data-action="edit">✏️</button>
                            <button class="btn-icon" title="Export" data-action="export">📤</button>
                            <button class="btn-icon" title="Delete" data-action="delete">🗑️</button>
                        `;
                    },
                    cellClick: (e, cell) => {
                        const target = e.target;
                        if (!target.classList.contains('btn-icon')) return;

                        const action = target.dataset.action;
                        const row = cell.getRow().getData();

                        switch(action) {
                            case 'load':
                                this.loadExperimentalResult(row.id);
                                break;
                            case 'edit':
                                this.editExperimentalResult(row.id);
                                break;
                            case 'export':
                                this.exportSingleExperimentalResult(row.id);
                                break;
                            case 'delete':
                                this.deleteExperimentalResult(row.id);
                                break;
                        }
                    }
                }
            ]
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

            // Switch to HSP Experimental tab
            if (window.mixingCompass) {
                window.mixingCompass.switchSection('hsp-experimental');
            }

        } catch (error) {
            console.error('Error loading experimental result:', error);
            this.showNotification('Failed to load experimental result', 'error');
        }
    }

    editExperimentalResult(resultId) {
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

            // Prompt for new sample name
            const newName = prompt('Edit sample name:', result.sample_name);
            if (newName === null) return; // User cancelled

            if (newName.trim() === '') {
                this.showNotification('Sample name cannot be empty', 'error');
                return;
            }

            // Prompt for notes
            const newNotes = prompt('Edit notes (optional):', result.metadata.notes || '');
            if (newNotes === null) return; // User cancelled

            // Update the result
            window.experimentalResultsManager.updateExperimentalResultMetadata(
                resultId,
                newName.trim(),
                newNotes.trim()
            );

            // Refresh the table
            this.loadExperimentalResultsDisplay();
            this.showNotification('Experimental result updated', 'success');

        } catch (error) {
            console.error('Error editing experimental result:', error);
            this.showNotification('Failed to edit experimental result', 'error');
        }
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
                exported: Utils.formatISO(),
                experimental_result: result
            };

            // Create and download file
            const filename = `hsp-result-${result.sample_name.replace(/[^a-zA-Z0-9]/g, '_')}-${Utils.formatISO().split('T')[0]}.json`;
            Utils.downloadJSON(exportData, filename);

            Notification.success(`Exported: ${result.sample_name}`);

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

// Initialize when DOM is loaded (only if on standalone data list page)
document.addEventListener('DOMContentLoaded', () => {
    // Only auto-initialize if we're on the standalone data-list page
    // In the main app, initialization is handled by main.js when switching tabs
    if (window.location.pathname === '/data-list') {
        window.dataListManager = new DataListManager();
    }
});
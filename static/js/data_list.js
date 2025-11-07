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
        this.setupUserSolventModalListeners();
        this.setupUserPolymerModalListeners();
        this.setupCollapsibleSections();
        this.loadUserAddedSolvents();
        this.loadUserAddedPolymers();
        this.loadSavedMixtures();
        // Database loading is now called only when sections are expanded
        this.loadSolventSetsDisplay();
        this.loadExperimentalResultsDisplay();

        // Load databases immediately if sections are expanded
        const polymerExpanded = localStorage.getItem('polymerDatabaseSectionExpanded') === 'true';
        if (polymerExpanded) {
            this.loadPolymerDatabase();
        }

        const solventExpanded = localStorage.getItem('databaseSectionExpanded') === 'true';
        if (solventExpanded) {
            this.loadSolventDatabase();
        }
    }

    setupEventListeners() {
        // Add user solvent button
        const addUserSolventBtn = document.querySelector('#add-user-solvent-btn');
        if (addUserSolventBtn) {
            addUserSolventBtn.addEventListener('click', () => this.showAddUserSolventModal());
        }

        // Add user polymer button
        const addUserPolymerBtn = document.querySelector('#add-user-polymer-btn');
        if (addUserPolymerBtn) {
            addUserPolymerBtn.addEventListener('click', () => this.showAddUserPolymerModal());
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

    async loadSolventDatabase() {
        const container = document.querySelector('#solvent-database-table');
        const countBadge = document.querySelector('#database-count');

        if (!container) {
            console.error('Solvent database table container not found');
            return;
        }

        try {
            // Show loading state with spinner
            container.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <span class="loading-text">Loading solvent database...</span>
                </div>
            `;

            // Fetch solvent data
            const response = await fetch('/api/data-list/solvents?limit=2000&offset=0');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Update count badge
            if (countBadge) {
                countBadge.textContent = `${data.total} solvents`;
            }

            // Initialize or update Tabulator
            if (this.solventDatabaseTable) {
                // Update existing table data
                this.solventDatabaseTable.setData(data.solvents);
            } else {
                // Create new Tabulator instance
                this.solventDatabaseTable = new Tabulator("#solvent-database-table", {
                    data: data.solvents,
                    layout: "fitColumns",
                    responsiveLayout: "collapse",
                    pagination: true,
                    paginationSize: 20,
                    paginationSizeSelector: [10, 20, 50, 100],
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

    // === Polymer Database Management ===

    async loadPolymerDatabase() {
        const container = document.querySelector('#polymer-database-table');
        const countBadge = document.querySelector('#polymer-database-count');

        if (!container) {
            console.error('Polymer database table container not found');
            return;
        }

        try {
            // Show loading state with spinner
            container.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <span class="loading-text">Loading polymer database...</span>
                </div>
            `;

            // Fetch polymer data
            const response = await fetch('/api/polymer-data/polymers');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Update count badge
            if (countBadge) {
                countBadge.textContent = `${data.total} polymers`;
            }

            // Initialize or update Tabulator
            if (this.polymerDatabaseTable) {
                // Update existing table data
                this.polymerDatabaseTable.setData(data.polymers);
            } else {
                // Create new Tabulator instance
                this.polymerDatabaseTable = new Tabulator("#polymer-database-table", {
                    data: data.polymers,
                    layout: "fitColumns",
                    responsiveLayout: "collapse",
                    pagination: true,
                    paginationSize: 20,
                    paginationSizeSelector: [10, 20, 50, 100],
                    movableColumns: true,
                    resizableColumns: true,
                    initialSort: [
                        { column: "polymer", dir: "asc" }
                    ],
                    columns: [
                        {
                            title: "Polymer",
                            field: "polymer",
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
                            title: "R0",
                            field: "ra",
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
                            title: "Link",
                            field: "source_url",
                            minWidth: 80,
                            hozAlign: "center",
                            headerSort: false,
                            formatter: (cell) => {
                                const row = cell.getRow().getData();
                                const sourceUrl = row.source_url;
                                const sourceFile = row.source_file;

                                // If there's a URL, show link icon
                                if (sourceUrl) {
                                    return `<a href="${this.escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="source-link" title="${this.escapeHtml(sourceUrl)}">🔗</a>`;
                                }

                                // If no URL but has source file, show link icon without href
                                if (sourceFile) {
                                    const sourceName = this.formatSource(sourceFile);
                                    return `<span class="source-icon" title="Source: ${this.escapeHtml(sourceName)} (no URL available)">🔗</span>`;
                                }

                                return '-';
                            }
                        }
                    ]
                });
            }

            console.log(`Loaded ${data.polymers.length} of ${data.total} polymers into Tabulator`);

        } catch (error) {
            console.error('Error loading polymer database:', error);
            if (container) {
                container.innerHTML = `<div class="error-cell">Error loading polymer database: ${error.message}</div>`;
            }
            Notification.error('Failed to load polymer database');
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
        const tableContainer = document.querySelector('#user-solvents-table');
        const emptyState = document.querySelector('#user-solvents-empty');
        const countBadge = document.querySelector('#user-solvents-count');

        if (!tableContainer) {
            console.error('User solvents table container not found');
            return;
        }

        try {
            // Show loading state with spinner
            tableContainer.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <span class="loading-text">Loading user-added solvents...</span>
                </div>
            `;

            // Fetch user-added solvents
            const response = await fetch('/api/data-list/user-solvents');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const solvents = await response.json();

            // Update count badge
            if (countBadge) {
                countBadge.textContent = `${solvents.length} solvent${solvents.length !== 1 ? 's' : ''}`;
            }

            // Display results
            if (solvents.length === 0) {
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

            // Initialize or update Tabulator
            setTimeout(() => {
                if (this.userSolventsTable) {
                    this.userSolventsTable.setData(solvents);
                } else {
                    this.userSolventsTable = new Tabulator("#user-solvents-table", {
                        data: solvents,
                        layout: "fitColumns",
                        responsiveLayout: "collapse",
                        pagination: true,
                        paginationSize: 10,
                        paginationSizeSelector: [5, 10, 20, 50],
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
                                title: "Actions",
                                minWidth: 120,
                                width: 120,
                                hozAlign: "center",
                                headerSort: false,
                                formatter: (cell) => {
                                    return `
                                        <button class="btn-icon" title="Edit" data-action="edit">✏️</button>
                                        <button class="btn-icon" title="Delete" data-action="delete">🗑️</button>
                                    `;
                                },
                                cellClick: (e, cell) => {
                                    const target = e.target;
                                    if (!target.classList.contains('btn-icon')) return;

                                    const action = target.dataset.action;
                                    const row = cell.getRow().getData();

                                    switch(action) {
                                        case 'edit':
                                            this.showEditUserSolventModal(row);
                                            break;
                                        case 'delete':
                                            this.deleteUserSolvent(row.solvent);
                                            break;
                                    }
                                }
                            }
                        ]
                    });
                }
            }, 50);

            console.log(`Loaded ${solvents.length} user-added solvents`);

        } catch (error) {
            console.error('Error loading user-added solvents:', error);
            if (tableContainer) {
                tableContainer.innerHTML = `<div class="error-cell">Error loading user-added solvents: ${error.message}</div>`;
            }
            Notification.error('Failed to load user-added solvents');
        }
    }

    setupUserSolventModalListeners() {
        // Add modal controls
        const addSaveBtn = document.querySelector('#save-add-user-solvent-btn');
        const addCancelBtn = document.querySelector('#cancel-add-user-solvent-btn');
        const addModal = document.querySelector('#add-user-solvent-modal');
        const addCloseBtn = addModal?.querySelector('.modal-close');

        if (addSaveBtn && !addSaveBtn.hasAttribute('data-listener-attached')) {
            addSaveBtn.setAttribute('data-listener-attached', 'true');
            addSaveBtn.addEventListener('click', () => this.addUserSolvent());
        }

        if (addCancelBtn && !addCancelBtn.hasAttribute('data-listener-attached')) {
            addCancelBtn.setAttribute('data-listener-attached', 'true');
            addCancelBtn.addEventListener('click', () => this.closeAddUserSolventModal());
        }

        if (addCloseBtn && !addCloseBtn.hasAttribute('data-listener-attached')) {
            addCloseBtn.setAttribute('data-listener-attached', 'true');
            addCloseBtn.addEventListener('click', () => this.closeAddUserSolventModal());
        }

        if (addModal && !addModal.hasAttribute('data-listener-attached')) {
            addModal.setAttribute('data-listener-attached', 'true');
            addModal.addEventListener('click', (e) => {
                if (e.target === addModal) {
                    this.closeAddUserSolventModal();
                }
            });
        }

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

    showAddUserSolventModal() {
        const modal = document.querySelector('#add-user-solvent-modal');
        const nameInput = document.querySelector('#add-solvent-name');
        const deltaDInput = document.querySelector('#add-delta-d');
        const deltaPInput = document.querySelector('#add-delta-p');
        const deltaHInput = document.querySelector('#add-delta-h');
        const casInput = document.querySelector('#add-cas');
        const bpInput = document.querySelector('#add-boiling-point');

        if (!modal) return;

        // Clear form
        if (nameInput) nameInput.value = '';
        if (deltaDInput) deltaDInput.value = '';
        if (deltaPInput) deltaPInput.value = '';
        if (deltaHInput) deltaHInput.value = '';
        if (casInput) casInput.value = '';
        if (bpInput) bpInput.value = '';

        modal.style.display = 'block';
    }

    closeAddUserSolventModal() {
        const modal = document.querySelector('#add-user-solvent-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async addUserSolvent() {
        const nameInput = document.querySelector('#add-solvent-name');
        const deltaDInput = document.querySelector('#add-delta-d');
        const deltaPInput = document.querySelector('#add-delta-p');
        const deltaHInput = document.querySelector('#add-delta-h');
        const casInput = document.querySelector('#add-cas');
        const bpInput = document.querySelector('#add-boiling-point');

        // Validate required fields
        const name = nameInput.value.trim();
        const deltaD = parseFloat(deltaDInput.value);
        const deltaP = parseFloat(deltaPInput.value);
        const deltaH = parseFloat(deltaHInput.value);

        if (!name) {
            Notification.error('Solvent name is required');
            return;
        }

        if (isNaN(deltaD) || isNaN(deltaP) || isNaN(deltaH)) {
            Notification.error('HSP values (δD, δP, δH) are required');
            return;
        }

        // Prepare data
        const solventData = {
            solvent: name,
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
            // Send POST request
            const response = await fetch('/api/data-list/user-solvents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(solventData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            Notification.success(`Solvent '${name}' added successfully`);
            this.closeAddUserSolventModal();

            // Reload all tables to reflect changes
            await this.refreshAllTables();

        } catch (error) {
            console.error('Error adding user solvent:', error);
            Notification.error(`Failed to add solvent: ${error.message}`);
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

    // === User Added Polymers Management ===

    getUserPolymersFromStorage() {
        try {
            const polymers = localStorage.getItem('userAddedPolymers');
            return polymers ? JSON.parse(polymers) : [];
        } catch (error) {
            console.error('Error reading user polymers from storage:', error);
            return [];
        }
    }

    saveUserPolymersToStorage(polymers) {
        try {
            localStorage.setItem('userAddedPolymers', JSON.stringify(polymers));
        } catch (error) {
            console.error('Error saving user polymers to storage:', error);
            Notification.error('Failed to save polymer data');
        }
    }

    loadUserAddedPolymers() {
        const tableContainer = document.querySelector('#user-polymers-table');
        const emptyState = document.querySelector('#user-polymers-empty');
        const countBadge = document.querySelector('#user-polymers-count');

        if (!tableContainer) return;

        const polymers = this.getUserPolymersFromStorage();

        if (countBadge) {
            countBadge.textContent = `${polymers.length} polymer${polymers.length !== 1 ? 's' : ''}`;
        }

        if (polymers.length === 0) {
            tableContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        tableContainer.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        if (this.userPolymersTable) {
            this.userPolymersTable.setData(polymers);
        } else {
            this.userPolymersTable = new Tabulator("#user-polymers-table", {
                data: polymers,
                layout: "fitColumns",
                responsiveLayout: "collapse",
                pagination: true,
                paginationSize: 10,
                paginationSizeSelector: [5, 10, 20, 50],
                initialSort: [{ column: "name", dir: "asc" }],
                columns: [
                    { title: "Polymer", field: "name", minWidth: 200, headerFilter: "input", sorter: "string" },
                    { title: "δD", field: "delta_d", minWidth: 80, hozAlign: "right", formatter: (cell) => cell.getValue()?.toFixed(1) || '-', sorter: "number" },
                    { title: "δP", field: "delta_p", minWidth: 80, hozAlign: "right", formatter: (cell) => cell.getValue()?.toFixed(1) || '-', sorter: "number" },
                    { title: "δH", field: "delta_h", minWidth: 80, hozAlign: "right", formatter: (cell) => cell.getValue()?.toFixed(1) || '-', sorter: "number" },
                    { title: "R0", field: "r0", minWidth: 80, hozAlign: "right", formatter: (cell) => cell.getValue()?.toFixed(1) || '-', sorter: "number" },
                    { title: "CAS", field: "cas", minWidth: 120, formatter: (cell) => cell.getValue() || '-' },
                    {
                        title: "Actions", minWidth: 120, width: 120, hozAlign: "center", headerSort: false,
                        formatter: () => '<button class="btn-icon" title="Edit" data-action="edit">✏️</button><button class="btn-icon" title="Delete" data-action="delete">🗑️</button>',
                        cellClick: (e, cell) => {
                            const target = e.target;
                            if (!target.classList.contains('btn-icon')) return;
                            const row = cell.getRow().getData();
                            if (target.dataset.action === 'edit') this.showEditUserPolymerModal(row);
                            else if (target.dataset.action === 'delete') this.deleteUserPolymer(row.name);
                        }
                    }
                ]
            });
        }
    }

    setupUserPolymerModalListeners() {
        const addModal = document.querySelector('#add-user-polymer-modal');
        ['#save-add-user-polymer-btn', '#cancel-add-user-polymer-btn', addModal?.querySelector('.modal-close')].forEach((sel, idx) => {
            const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
            if (el && !el.hasAttribute('data-listener-attached')) {
                el.setAttribute('data-listener-attached', 'true');
                el.addEventListener('click', () => [this.addUserPolymer, this.closeAddUserPolymerModal, this.closeAddUserPolymerModal][idx]?.call(this));
            }
        });
        if (addModal && !addModal.hasAttribute('data-listener-attached')) {
            addModal.setAttribute('data-listener-attached', 'true');
            addModal.addEventListener('click', (e) => e.target === addModal && this.closeAddUserPolymerModal());
        }

        const editModal = document.querySelector('#edit-user-polymer-modal');
        ['#save-user-polymer-btn', '#cancel-edit-user-polymer-btn', editModal?.querySelector('.modal-close')].forEach((sel, idx) => {
            const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
            if (el && !el.hasAttribute('data-listener-attached')) {
                el.setAttribute('data-listener-attached', 'true');
                el.addEventListener('click', () => [this.saveUserPolymerChanges, this.closeEditUserPolymerModal, this.closeEditUserPolymerModal][idx]?.call(this));
            }
        });
        if (editModal && !editModal.hasAttribute('data-listener-attached')) {
            editModal.setAttribute('data-listener-attached', 'true');
            editModal.addEventListener('click', (e) => e.target === editModal && this.closeEditUserPolymerModal());
        }
    }

    showAddUserPolymerModal() {
        const modal = document.querySelector('#add-user-polymer-modal');
        if (!modal) return;
        ['name', 'delta-d', 'delta-p', 'delta-h', 'r0', 'cas'].forEach(id => {
            const el = document.querySelector(`#add-polymer-${id}`);
            if (el) el.value = '';
        });
        modal.style.display = 'block';
    }

    closeAddUserPolymerModal() {
        const modal = document.querySelector('#add-user-polymer-modal');
        if (modal) modal.style.display = 'none';
    }

    addUserPolymer() {
        const name = document.querySelector('#add-polymer-name')?.value.trim();
        const delta_d = parseFloat(document.querySelector('#add-polymer-delta-d')?.value);
        const delta_p = parseFloat(document.querySelector('#add-polymer-delta-p')?.value);
        const delta_h = parseFloat(document.querySelector('#add-polymer-delta-h')?.value);
        const r0 = parseFloat(document.querySelector('#add-polymer-r0')?.value);
        const cas = document.querySelector('#add-polymer-cas')?.value.trim();

        if (!name || isNaN(delta_d) || isNaN(delta_p) || isNaN(delta_h) || isNaN(r0)) {
            Notification.error('Polymer name and HSP values (δD, δP, δH, R0) are required');
            return;
        }

        const polymers = this.getUserPolymersFromStorage();
        if (polymers.find(p => p.name === name)) {
            Notification.error(`Polymer '${name}' already exists`);
            return;
        }

        polymers.push({ name, delta_d, delta_p, delta_h, r0, cas: cas || null });
        this.saveUserPolymersToStorage(polymers);
        Notification.success(`Polymer '${name}' added successfully`);
        this.closeAddUserPolymerModal();
        this.loadUserAddedPolymers();
    }

    showEditUserPolymerModal(polymerData) {
        const modal = document.querySelector('#edit-user-polymer-modal');
        if (!modal) return;
        modal.setAttribute('data-original-name', polymerData.name);
        document.querySelector('#edit-polymer-name').value = polymerData.name || '';
        document.querySelector('#edit-polymer-delta-d').value = polymerData.delta_d ?? '';
        document.querySelector('#edit-polymer-delta-p').value = polymerData.delta_p ?? '';
        document.querySelector('#edit-polymer-delta-h').value = polymerData.delta_h ?? '';
        document.querySelector('#edit-polymer-r0').value = polymerData.r0 ?? '';
        document.querySelector('#edit-polymer-cas').value = polymerData.cas || '';
        modal.style.display = 'block';
    }

    closeEditUserPolymerModal() {
        const modal = document.querySelector('#edit-user-polymer-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.removeAttribute('data-original-name');
        }
    }

    saveUserPolymerChanges() {
        const modal = document.querySelector('#edit-user-polymer-modal');
        const originalName = modal.getAttribute('data-original-name');
        const name = document.querySelector('#edit-polymer-name')?.value.trim();
        const delta_d = parseFloat(document.querySelector('#edit-polymer-delta-d')?.value);
        const delta_p = parseFloat(document.querySelector('#edit-polymer-delta-p')?.value);
        const delta_h = parseFloat(document.querySelector('#edit-polymer-delta-h')?.value);
        const r0 = parseFloat(document.querySelector('#edit-polymer-r0')?.value);
        const cas = document.querySelector('#edit-polymer-cas')?.value.trim();

        if (!name || isNaN(delta_d) || isNaN(delta_p) || isNaN(delta_h) || isNaN(r0)) {
            Notification.error('Polymer name and HSP values are required');
            return;
        }

        const polymers = this.getUserPolymersFromStorage();
        const index = polymers.findIndex(p => p.name === originalName);
        if (index === -1) {
            Notification.error('Polymer not found');
            return;
        }

        polymers[index] = { name, delta_d, delta_p, delta_h, r0, cas: cas || null };
        this.saveUserPolymersToStorage(polymers);
        Notification.success(`Polymer '${name}' updated successfully`);
        this.closeEditUserPolymerModal();
        this.loadUserAddedPolymers();
    }

    deleteUserPolymer(polymerName) {
        if (!confirm(`Are you sure you want to delete the polymer "${polymerName}"?`)) return;
        const polymers = this.getUserPolymersFromStorage();
        const filtered = polymers.filter(p => p.name !== polymerName);
        this.saveUserPolymersToStorage(filtered);
        Notification.success(`Polymer '${polymerName}' deleted successfully`);
        this.loadUserAddedPolymers();
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

        // Show loading state briefly with spinner
        tableContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <span class="loading-text">Loading experimental results...</span>
            </div>
        `;

        // Initialize Tabulator (will replace loading state)
        setTimeout(() => {
            this.experimentalResultsTable = new Tabulator("#experimental-results-table", {
                data: results,
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
                    responsive: 0, // Always show this column
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
        }, 50); // Small delay to show loading state
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

    // === Collapsible Sections Management ===

    setupCollapsibleSections() {
        // Setup Polymer Database collapsible
        this.setupCollapsibleSection(
            '#polymer-database-collapse-toggle',
            '#polymer-database-collapsible-content',
            'polymerDatabaseSectionExpanded',
            () => {
                if (!this.polymerDatabaseTable || this.polymerDatabaseTable.getData().length === 0) {
                    this.loadPolymerDatabase();
                }
            }
        );

        // Setup Solvent Database collapsible
        this.setupCollapsibleSection(
            '#database-collapse-toggle',
            '#database-collapsible-content',
            'databaseSectionExpanded',
            () => {
                if (!this.solventDatabaseTable || this.solventDatabaseTable.getData().length === 0) {
                    this.loadSolventDatabase();
                }
            }
        );

        console.log('Collapsible sections setup complete');
    }

    setupCollapsibleSection(toggleSelector, contentSelector, storageKey, loadCallback) {
        const toggle = document.querySelector(toggleSelector);
        const content = document.querySelector(contentSelector);

        if (!toggle || !content) {
            console.warn(`Collapsible section elements not found: ${toggleSelector}`);
            return;
        }

        // Load saved state from LocalStorage
        const isExpanded = localStorage.getItem(storageKey) === 'true';

        // Set initial state
        if (isExpanded) {
            this.expandSection(toggle, content);
        } else {
            this.collapseSection(toggle, content);
        }

        // Add click handler
        toggle.addEventListener('click', () => {
            const currentlyExpanded = toggle.getAttribute('aria-expanded') === 'true';

            if (currentlyExpanded) {
                this.collapseSection(toggle, content);
                localStorage.setItem(storageKey, 'false');
            } else {
                this.expandSection(toggle, content);
                localStorage.setItem(storageKey, 'true');

                // Load database if not already loaded and section is expanded
                if (loadCallback) {
                    loadCallback();
                }
            }
        });
    }

    expandSection(toggle, content) {
        toggle.setAttribute('aria-expanded', 'true');
        content.style.display = 'block';
    }

    collapseSection(toggle, content) {
        toggle.setAttribute('aria-expanded', 'false');
        content.style.display = 'none';
    }

    // === Helper Methods ===

    /**
     * Create a standardized Actions column for Tabulator tables
     * @param {Object} config - Configuration object
     * @param {Array} config.buttons - Array of button objects with {title, action, icon}
     * @param {Object} config.handlers - Object mapping action names to handler functions
     * @param {number} config.width - Optional fixed width for the column
     * @returns {Object} Tabulator column definition
     */
    createActionsColumn(config) {
        const { buttons, handlers, width = null } = config;
        return {
            title: "Actions",
            minWidth: width || buttons.length * 50,
            width: width || buttons.length * 50,
            hozAlign: "center",
            headerSort: false,
            responsive: 0, // Always show this column
            formatter: () => buttons.map(btn =>
                `<button class="btn-icon" title="${btn.title}" data-action="${btn.action}">${btn.icon}</button>`
            ).join(''),
            cellClick: (e, cell) => {
                const target = e.target;
                if (!target.classList.contains('btn-icon')) return;

                const action = target.dataset.action;
                const rowData = cell.getRow().getData();
                const handler = handlers[action];

                if (handler) {
                    handler.call(this, rowData.id);
                }
            }
        };
    }

    // === Saved Mixtures Management ===

    loadSavedMixtures() {
        const tableContainer = document.querySelector('#saved-mixtures-table');
        const emptyState = document.querySelector('#saved-mixtures-empty');
        const countBadge = document.querySelector('#saved-mixtures-count');

        if (!tableContainer) {
            console.warn('Saved mixtures table container not found');
            return;
        }

        // Get saved mixtures from storage
        const STORAGE_KEY = 'mixingcompass_saved_mixtures';
        const mixtures = Storage.get(STORAGE_KEY, []);

        // Update count badge
        if (countBadge) {
            countBadge.textContent = `${mixtures.length} mixture${mixtures.length !== 1 ? 's' : ''}`;
        }

        if (mixtures.length === 0) {
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

        // Prepare data for Tabulator
        const tableData = mixtures.map(mixture => ({
            id: mixture.id,
            name: mixture.name,
            delta_d: mixture.hsp.delta_d,
            delta_p: mixture.hsp.delta_p,
            delta_h: mixture.hsp.delta_h,
            composition: mixture.components.map(c =>
                `${c.solvent} (${c.volume})`
            ).join(', '),
            components: mixture.components,
            created_at: mixture.created_at
        }));

        // Show loading state briefly with spinner
        tableContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <span class="loading-text">Loading saved mixtures...</span>
            </div>
        `;

        // Initialize Tabulator (will replace loading state)
        setTimeout(() => {
            if (this.savedMixturesTable) {
                this.savedMixturesTable.setData(tableData);
            } else {
                this.savedMixturesTable = new Tabulator("#saved-mixtures-table", {
                    data: tableData,
                    layout: "fitColumns",
                    responsiveLayout: "collapse",
                    pagination: true,
                    paginationSize: 10,
                    paginationSizeSelector: [5, 10, 20, 50],
                    movableColumns: true,
                    resizableColumns: true,
                    initialSort: [{ column: "created_at", dir: "desc" }],
                    columns: [
                        {
                            title: "Name",
                            field: "name",
                            minWidth: 150,
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
                            formatter: (cell) => cell.getValue().toFixed(1),
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
                            formatter: (cell) => cell.getValue().toFixed(1),
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
                            formatter: (cell) => cell.getValue().toFixed(1),
                            sorter: "number"
                        },
                        {
                            title: "Composition",
                            field: "composition",
                            minWidth: 200,
                            headerFilter: "input",
                            headerFilterPlaceholder: "Filter...",
                            tooltip: true
                        },
                        {
                            title: "Created",
                            field: "created_at",
                            minWidth: 150,
                            formatter: (cell) => {
                                const date = new Date(cell.getValue());
                                return Utils.formatDate(date);
                            },
                            sorter: "string"
                        },
                        this.createActionsColumn({
                            buttons: [
                                { title: 'Load in HSP Calculation', action: 'load', icon: '📖' },
                                { title: 'Export', action: 'export', icon: '📤' },
                                { title: 'Delete', action: 'delete', icon: '🗑️' }
                            ],
                            handlers: {
                                load: this.loadMixtureInCalculation,
                                export: this.exportSingleMixture,
                                delete: this.deleteSavedMixture
                            },
                            width: 150
                        })
                    ]
                });
            }

            console.log(`Loaded ${mixtures.length} saved mixtures`);
        }, 10);
    }

    loadMixtureInCalculation(mixtureId) {
        const STORAGE_KEY = 'mixingcompass_saved_mixtures';
        const mixtures = Storage.get(STORAGE_KEY, []);
        const mixture = mixtures.find(m => m.id === mixtureId);

        if (!mixture) {
            Notification.error('Mixture not found');
            return;
        }

        // Store the mixture ID to load
        sessionStorage.setItem('loadMixtureId', mixtureId);

        // Switch to HSP Calculation tab
        if (window.mixingCompass) {
            window.mixingCompass.switchSection('hsp-calculation');
        }

        Notification.success(`Loading mixture: ${mixture.name}`);
    }

    exportSingleMixture(mixtureId) {
        try {
            const STORAGE_KEY = 'mixingcompass_saved_mixtures';
            const mixtures = Storage.get(STORAGE_KEY, []);
            const mixture = mixtures.find(m => m.id === mixtureId);

            if (!mixture) {
                Notification.error('Mixture not found');
                return;
            }

            // Create export data
            const exportData = {
                version: '1.0',
                exported: Utils.formatISO(),
                mixture: mixture
            };

            // Create and download file
            const filename = `mixture-${mixture.name.replace(/[^a-zA-Z0-9]/g, '_')}-${Utils.formatISO().split('T')[0]}.json`;
            Utils.downloadJSON(exportData, filename);

            Notification.success(`Exported: ${mixture.name}`);

        } catch (error) {
            console.error('Error exporting mixture:', error);
            Notification.error('Failed to export mixture');
        }
    }

    deleteSavedMixture(mixtureId) {
        try {
            const STORAGE_KEY = 'mixingcompass_saved_mixtures';
            const mixtures = Storage.get(STORAGE_KEY, []);
            const mixture = mixtures.find(m => m.id === mixtureId);

            if (!mixture) {
                Notification.error('Mixture not found');
                return;
            }

            if (!confirm(`Delete mixture "${mixture.name}"?`)) {
                return;
            }

            // Remove from storage
            const updatedMixtures = mixtures.filter(m => m.id !== mixtureId);
            Storage.set(STORAGE_KEY, updatedMixtures);

            // Reload table
            this.loadSavedMixtures();

            Notification.success(`Mixture "${mixture.name}" deleted`);

        } catch (error) {
            console.error('Error deleting mixture:', error);
            Notification.error('Failed to delete mixture');
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
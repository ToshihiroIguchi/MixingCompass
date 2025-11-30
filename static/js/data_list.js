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

        // Unified event-driven data update system
        const dataUpdateEvents = {
            'userSolventsUpdated': 'loadUserAddedSolvents',
            'solventSetsUpdated': 'loadSolventSetsDisplay',
            'savedMixturesUpdated': 'loadSavedMixtures',
            'experimentalResultsUpdated': 'loadExperimentalResultsDisplay',
            'userPolymersUpdated': 'loadUserAddedPolymers'
        };

        Object.entries(dataUpdateEvents).forEach(([eventName, methodName]) => {
            window.addEventListener(eventName, () => {
                console.log(`[DataListManager] ${eventName} received`);
                this[methodName]();
            });
        });
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
            return `<span class="solvent-preview" title="${solvent.solvent_name}">${solvent.solvent_name}</span>`;
        }).join('');

        const remaining = solvents.length - 5;
        const moreText = remaining > 0 ? ` <span class="more-solvents">+${remaining} more</span>` : '';

        return preview + moreText;
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
        const tableContainer = document.querySelector('#edit-solvents-table');

        if (!modal || !nameInput || !tableContainer) return;

        // Populate modal with set data
        nameInput.value = solventSet.name;

        // Initialize datalist with solvent names from shared cache
        this.initializeEditSolventDatalist();

        // Create Tabulator table for solvents
        const tableData = solventSet.solvents.map(s => ({
            solvent_name: s.solvent_name
        }));

        // Destroy existing table if any
        if (this.editSetTable) {
            this.editSetTable.destroy();
        }

        this.editSetTable = new Tabulator('#edit-solvents-table', {
            data: tableData,
            layout: 'fitColumns',
            height: '250px',
            placeholder: 'No solvents added. Click "+ Add Solvent" to add.',
            columns: [
                {
                    title: 'Solvent',
                    field: 'solvent_name',
                    editor: 'input',
                    editorParams: {
                        elementAttributes: {
                            list: 'edit-set-solvent-datalist'
                        }
                    },
                    validator: ['required', 'string'],
                    cellEdited: (cell) => {
                        // Auto-validate solvent name against database
                        const value = cell.getValue();
                        if (value && window.sharedSolventCache) {
                            const solvent = window.sharedSolventCache.get(value);
                            if (!solvent) {
                                cell.getElement().style.backgroundColor = '#fef3c7';
                                cell.getElement().title = 'Solvent not found in database';
                            } else {
                                cell.getElement().style.backgroundColor = '';
                                cell.getElement().title = '';
                            }
                        }
                    }
                },
                {
                    title: '',
                    formatter: 'buttonCross',
                    width: 40,
                    hozAlign: 'center',
                    cellClick: (e, cell) => {
                        cell.getRow().delete();
                    }
                }
            ]
        });

        // Setup add button listener
        this.setupEditModalListeners();

        modal.style.display = 'flex';
    }

    initializeEditSolventDatalist() {
        const datalist = document.querySelector('#edit-set-solvent-datalist');
        if (!datalist || !window.sharedSolventCache) return;

        // Get solvent names from shared cache
        const names = window.sharedSolventCache.getNames();
        datalist.innerHTML = names.map(name => `<option value="${this.escapeHtml(name)}">`).join('');
    }

    setupEditModalListeners() {
        // Add solvent button
        const addBtn = document.querySelector('#add-solvent-to-set');
        if (addBtn) {
            // Remove old listener and add new one
            const newBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newBtn, addBtn);
            newBtn.addEventListener('click', () => this.addSolventToEditList());
        }
    }

    addSolventToEditList() {
        if (this.editSetTable) {
            this.editSetTable.addRow({ solvent_name: '' });
        }
    }

    saveSetChanges() {
        const nameInput = document.querySelector('#edit-set-name');
        const newName = nameInput.value.trim();

        if (!newName) {
            alert('Please enter a set name');
            return;
        }

        if (!this.editSetTable) {
            alert('Table not initialized');
            return;
        }

        // Get data from Tabulator
        const tableData = this.editSetTable.getData();
        const solvents = tableData
            .filter(row => row.solvent_name && row.solvent_name.trim())
            .map(row => ({
                solvent_name: row.solvent_name.trim()
            }));

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
        // Destroy table to free resources
        if (this.editSetTable) {
            this.editSetTable.destroy();
            this.editSetTable = null;
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

            // Use shared solvent cache to get all solvents (includes CSV, User Solvents, and Saved Mixtures)
            await window.sharedSolventCache.ensureLoaded();
            const allNames = window.sharedSolventCache.getNames();

            // Build data array from cache
            const solvents = allNames.map(name => {
                const solvent = window.sharedSolventCache.get(name);
                return {
                    solvent: solvent.name,
                    delta_d: solvent.delta_d,
                    delta_p: solvent.delta_p,
                    delta_h: solvent.delta_h,
                    cas: solvent.cas,
                    boiling_point: solvent.boiling_point,
                    density: solvent.density,
                    molecular_weight: solvent.molecular_weight,
                    cho: solvent.cho,
                    source_url: solvent.source_url,
                    source_file: solvent.source === 'user_added' ? 'user_added' :
                                 solvent.source === 'saved_mixture' ? 'saved_mixture' :
                                 'database'
                };
            }).filter(s => s !== null);

            const data = {
                solvents: solvents,
                total: solvents.length
            };

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
                this.solventDatabaseTable = new Tabulator("#solvent-database-table", this.getDefaultTableConfig({
                    data: data.solvents,
                    paginationSize: 20,
                    paginationSizeSelector: [10, 20, 50, 100],
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
                }));
            }

            console.log(`[Data List] Using shared cache with ${data.total} solvents (includes CSV, User Solvents, and Saved Mixtures)`);

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
                this.polymerDatabaseTable = new Tabulator("#polymer-database-table", this.getDefaultTableConfig({
                    data: data.polymers,
                    paginationSize: 20,
                    paginationSizeSelector: [10, 20, 50, 100],
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
                }));
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

    /**
     * Refresh all solvent-related tables
     */
    async refreshAllTables() {
        await this.loadUserAddedSolvents();
        await this.loadSolventDatabase();

        // Reload shared solvent cache to make user-added solvents available in dropdowns
        if (window.sharedSolventCache) {
            await window.sharedSolventCache.reload();
        }
    }

    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }

    showNotification(message, type = 'info') {
        Notification.show(message, type);
    }

    // === User Added Solvents Management ===

    async loadUserAddedSolvents() {
        const tableContainer = document.querySelector('#user-solvents-table-container');
        const emptyState = document.querySelector('#user-solvents-empty');
        const countBadge = document.querySelector('#user-solvents-count');

        if (!tableContainer) {
            console.error('[User Solvents] Table container not found');
            return;
        }

        console.log('[User Solvents] Starting load...');

        try {
            // Show loading state with spinner (only if table doesn't exist yet)
            if (!this.userSolventsTable) {
                tableContainer.innerHTML = `
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <span class="loading-text">Loading user solvents...</span>
                    </div>
                `;
            }

            // Load user-added solvents from localStorage
            const userSolvents = window.userSolventsManager.getUserSolvents();

            // Transform to match expected format (name -> solvent)
            const solvents = userSolvents.map(s => ({
                solvent: s.name,
                delta_d: s.delta_d,
                delta_p: s.delta_p,
                delta_h: s.delta_h,
                cas: s.cas,
                boiling_point: s.boiling_point,
                density: s.density,
                molecular_weight: s.molecular_weight,
                cost_per_ml: s.cost,
                wgk_class: s.wgk,
                ghs_classification: s.ghs,
                smiles: s.smiles,
                molecular_formula: s.molecular_formula,
                cho: s.cho,
                source: s.source || 'user_added'
            }));

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

            console.log('[User Solvents] Data fetched, initializing table...', {
                solventCount: solvents.length,
                tableExists: !!this.userSolventsTable
            });

            // Initialize or update Tabulator
            setTimeout(() => {
                if (this.userSolventsTable) {
                    // Table already exists, just update data
                    console.log('[User Solvents] Updating existing table with new data');
                    this.userSolventsTable.setData(solvents);
                } else {
                    // First time initialization: clear loading state and recreate table element
                    console.log('[User Solvents] Creating new Tabulator instance');
                    tableContainer.innerHTML = '<div id="user-solvents-table"></div>';

                    this.userSolventsTable = new Tabulator("#user-solvents-table", this.getDefaultTableConfig({
                        data: solvents,
                        height: "400px",  // Set explicit height to prevent infinite resize loop
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
                                title: "CHO",
                                field: "cho",
                                minWidth: 70,
                                hozAlign: "center",
                                headerFilter: "list",
                                headerFilterParams: {
                                    values: { "": "All", "true": "CHO", "false": "Non-CHO" }
                                },
                                formatter: (cell) => {
                                    const value = cell.getValue();
                                    if (value === true) {
                                        return '<span class="cho-badge cho-true" style="font-size:0.75rem;padding:0.15rem 0.5rem;">CHO</span>';
                                    } else if (value === false) {
                                        return '<span class="cho-badge cho-false" style="font-size:0.75rem;padding:0.15rem 0.5rem;">Non-CHO</span>';
                                    }
                                    return '-';
                                }
                            },
                            {
                                title: "Source",
                                field: "source",
                                minWidth: 100,
                                headerFilter: "list",
                                headerFilterParams: {
                                    values: { "": "All", "user_added": "Manual", "ML Prediction": "ML Prediction" }
                                },
                                formatter: (cell) => {
                                    const value = cell.getValue();
                                    if (value === 'ML Prediction') {
                                        return '<span style="color:#0369a1;font-weight:500;">ML</span>';
                                    } else if (value === 'user_added') {
                                        return 'Manual';
                                    }
                                    return value || '-';
                                }
                            },
                            {
                                title: "Actions",
                                minWidth: 120,
                                width: 120,
                                hozAlign: "center",
                                headerSort: false,
                                responsive: 0, // Always show this column
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
                    }));
                    console.log('[User Solvents] Tabulator instance created successfully');
                }
            }, 50);

            console.log(`[User Solvents] Loaded ${solvents.length} user-added solvents successfully`);

        } catch (error) {
            console.error('Error loading user-added solvents:', error);
            if (tableContainer) {
                tableContainer.innerHTML = `<div class="error-cell">Error loading user solvents: ${error.message}</div>`;
            }
            Notification.error('Failed to load user solvents');
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

        // Open modal with autofocus, text selection, and Esc key support
        ModalManager.open('edit-user-solvent-modal', {
            focusSelector: '#edit-solvent-name',
            selectText: true
        });
    }

    closeEditUserSolventModal() {
        const modal = document.querySelector('#edit-user-solvent-modal');
        if (modal) {
            modal.removeAttribute('data-original-name');
        }
        ModalManager.close('edit-user-solvent-modal');
    }

    showAddUserSolventModal() {
        const nameInput = document.querySelector('#add-solvent-name');
        const deltaDInput = document.querySelector('#add-delta-d');
        const deltaPInput = document.querySelector('#add-delta-p');
        const deltaHInput = document.querySelector('#add-delta-h');
        const casInput = document.querySelector('#add-cas');
        const bpInput = document.querySelector('#add-boiling-point');

        // Clear form
        if (nameInput) nameInput.value = '';
        if (deltaDInput) deltaDInput.value = '';
        if (deltaPInput) deltaPInput.value = '';
        if (deltaHInput) deltaHInput.value = '';
        if (casInput) casInput.value = '';
        if (bpInput) bpInput.value = '';

        // Open modal with autofocus and Esc key support
        ModalManager.open('add-user-solvent-modal', {
            focusSelector: '#add-solvent-name'
        });
    }

    closeAddUserSolventModal() {
        ModalManager.close('add-user-solvent-modal');
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

        // Prepare data for localStorage
        const solventData = {
            name: name,
            delta_d: deltaD,
            delta_p: deltaP,
            delta_h: deltaH,
            cas: casInput.value.trim() || null,
            boiling_point: bpInput.value ? parseFloat(bpInput.value) : null
        };

        try {
            // Add to localStorage using userSolventsManager
            const success = window.userSolventsManager.addSolvent(solventData);

            if (!success) {
                throw new Error('Solvent already exists or failed to save');
            }

            Notification.success(`Solvent '${name}' added successfully`);
            this.closeAddUserSolventModal();

            // Reload solvent cache
            if (window.sharedSolventCache) {
                await window.sharedSolventCache.reload();
            }

            // Dispatch event for data list manager
            window.dispatchEvent(new CustomEvent('userSolventsUpdated'));

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

        // Prepare update data for localStorage
        const updateData = {
            name: newName,
            delta_d: deltaD,
            delta_p: deltaP,
            delta_h: deltaH,
            cas: casInput.value.trim() || null,
            boiling_point: bpInput.value ? parseFloat(bpInput.value) : null
        };

        try {
            // Update in localStorage using userSolventsManager
            const success = window.userSolventsManager.updateSolvent(originalName, updateData);

            if (!success) {
                throw new Error('Solvent not found or failed to update');
            }

            Notification.success(`Solvent '${newName}' updated successfully`);
            this.closeEditUserSolventModal();

            // Reload solvent cache
            if (window.sharedSolventCache) {
                await window.sharedSolventCache.reload();
            }

            // Dispatch event for data list manager
            window.dispatchEvent(new CustomEvent('userSolventsUpdated'));

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
            // Delete from localStorage using userSolventsManager
            const success = window.userSolventsManager.removeSolvent(solventName);

            if (!success) {
                throw new Error('Solvent not found or failed to delete');
            }

            Notification.success(`Solvent '${solventName}' deleted successfully`);

            // Reload solvent cache
            if (window.sharedSolventCache) {
                await window.sharedSolventCache.reload();
            }

            // Dispatch event for data list manager
            window.dispatchEvent(new CustomEvent('userSolventsUpdated'));

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
            this.userPolymersTable = new Tabulator("#user-polymers-table", this.getDefaultTableConfig({
                data: polymers,
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
                        responsive: 0, // Always show this column
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
            }));
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
        // Clear form
        ['name', 'delta-d', 'delta-p', 'delta-h', 'r0', 'cas'].forEach(id => {
            const el = document.querySelector(`#add-polymer-${id}`);
            if (el) el.value = '';
        });

        // Open modal with autofocus and Esc key support
        ModalManager.open('add-user-polymer-modal', {
            focusSelector: '#add-polymer-name'
        });
    }

    closeAddUserPolymerModal() {
        ModalManager.close('add-user-polymer-modal');
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

        // Dispatch event for data list manager
        window.dispatchEvent(new CustomEvent('userPolymersUpdated'));
    }

    showEditUserPolymerModal(polymerData) {
        const modal = document.querySelector('#edit-user-polymer-modal');
        if (!modal) return;

        // Store original polymer name for update
        modal.setAttribute('data-original-name', polymerData.name);

        // Populate form
        document.querySelector('#edit-polymer-name').value = polymerData.name || '';
        document.querySelector('#edit-polymer-delta-d').value = polymerData.delta_d ?? '';
        document.querySelector('#edit-polymer-delta-p').value = polymerData.delta_p ?? '';
        document.querySelector('#edit-polymer-delta-h').value = polymerData.delta_h ?? '';
        document.querySelector('#edit-polymer-r0').value = polymerData.r0 ?? '';
        document.querySelector('#edit-polymer-cas').value = polymerData.cas || '';

        // Open modal with autofocus, text selection, and Esc key support
        ModalManager.open('edit-user-polymer-modal', {
            focusSelector: '#edit-polymer-name',
            selectText: true
        });
    }

    closeEditUserPolymerModal() {
        const modal = document.querySelector('#edit-user-polymer-modal');
        if (modal) {
            modal.removeAttribute('data-original-name');
        }
        ModalManager.close('edit-user-polymer-modal');
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

        // Dispatch event for data list manager
        window.dispatchEvent(new CustomEvent('userPolymersUpdated'));
    }

    deleteUserPolymer(polymerName) {
        if (!confirm(`Are you sure you want to delete the polymer "${polymerName}"?`)) return;
        const polymers = this.getUserPolymersFromStorage();
        const filtered = polymers.filter(p => p.name !== polymerName);
        this.saveUserPolymersToStorage(filtered);
        Notification.success(`Polymer '${polymerName}' deleted successfully`);

        // Dispatch event for data list manager
        window.dispatchEvent(new CustomEvent('userPolymersUpdated'));
    }

    // === Experimental Results Management ===

    loadExperimentalResultsDisplay() {
        console.time('[Perf] Experimental Results - Total');
        const tableContainer = document.querySelector('#experimental-results-table');
        const emptyState = document.querySelector('#experimental-results-empty');
        const countBadge = document.querySelector('#results-count');

        if (!tableContainer) {
            console.warn('Experimental results table container not found');
            return;
        }

        // Get experimental results from storage
        console.time('[Perf] Experimental Results - Data Read');
        const results = window.experimentalResultsManager ?
            window.experimentalResultsManager.getExperimentalResults() : [];
        console.timeEnd('[Perf] Experimental Results - Data Read');

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

        // If table already exists, just update data without showing spinner
        if (this.experimentalResultsTable) {
            console.time('[Perf] Experimental Results - Tabulator Init');
            this.experimentalResultsTable.setData(results);
            console.timeEnd('[Perf] Experimental Results - Tabulator Init');
            console.timeEnd('[Perf] Experimental Results - Total');
            return;
        }

        // Show loading state briefly with spinner (first time only)
        tableContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <span class="loading-text">Loading experimental results...</span>
            </div>
        `;

        // Initialize Tabulator (will replace loading state)
        setTimeout(() => {
            console.time('[Perf] Experimental Results - Tabulator Init');
            this.experimentalResultsTable = new Tabulator("#experimental-results-table", this.getDefaultTableConfig({
                data: results,
                height: "500px", // Fix infinite resize loop by setting explicit height
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
                this.createActionsColumn({
                    buttons: [
                        { title: 'Load', action: 'load', icon: '📖' },
                        { title: 'Edit', action: 'edit', icon: '✏️' },
                        { title: 'Export', action: 'export', icon: '📤' },
                        { title: 'Delete', action: 'delete', icon: '🗑️' }
                    ],
                    handlers: {
                        load: this.loadExperimentalResult,
                        edit: this.editExperimentalResult,
                        export: this.exportSingleExperimentalResult,
                        delete: this.deleteExperimentalResult
                    },
                    width: 200
                })
            ]
            }));
            console.timeEnd('[Perf] Experimental Results - Tabulator Init');
            console.timeEnd('[Perf] Experimental Results - Total');
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

    /**
     * Get default Tabulator configuration
     * @param {Object} overrides - Custom configuration to override defaults
     * @returns {Object} Tabulator configuration object
     */
    getDefaultTableConfig(overrides = {}) {
        const defaults = {
            layout: "fitDataFill",
            pagination: true,
            paginationSize: 10,
            paginationSizeSelector: [5, 10, 20, 50],
            movableColumns: true,
            resizableColumns: true
        };

        return { ...defaults, ...overrides };
    }

    // === Saved Mixtures Management ===

    loadSavedMixtures() {
        console.time('[Perf] Saved Mixtures - Total');
        const tableContainer = document.querySelector('#saved-mixtures-table');
        const emptyState = document.querySelector('#saved-mixtures-empty');
        const countBadge = document.querySelector('#saved-mixtures-count');

        if (!tableContainer) {
            console.warn('Saved mixtures table container not found');
            return;
        }

        // Get saved mixtures from storage
        console.time('[Perf] Saved Mixtures - Storage Read');
        const STORAGE_KEY = 'mixingcompass_saved_mixtures';
        const mixtures = Storage.get(STORAGE_KEY, []);
        console.timeEnd('[Perf] Saved Mixtures - Storage Read');

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
        console.time('[Perf] Saved Mixtures - Data Transform');
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
        console.timeEnd('[Perf] Saved Mixtures - Data Transform');

        // If table already exists, just update data without showing spinner
        if (this.savedMixturesTable) {
            console.time('[Perf] Saved Mixtures - Tabulator Init');
            this.savedMixturesTable.setData(tableData);
            console.timeEnd('[Perf] Saved Mixtures - Tabulator Init');
            console.log(`Loaded ${mixtures.length} saved mixtures`);
            console.timeEnd('[Perf] Saved Mixtures - Total');
            return;
        }

        // Show loading state briefly with spinner (first time only)
        tableContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <span class="loading-text">Loading saved mixtures...</span>
            </div>
        `;

        // Initialize Tabulator (will replace loading state)
        setTimeout(() => {
            console.time('[Perf] Saved Mixtures - Tabulator Init');
            this.savedMixturesTable = new Tabulator("#saved-mixtures-table", this.getDefaultTableConfig({
                    data: tableData,
                    height: "500px", // Fix infinite resize loop by setting explicit height
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
                }));
            console.timeEnd('[Perf] Saved Mixtures - Tabulator Init');

            console.log(`Loaded ${mixtures.length} saved mixtures`);
            console.timeEnd('[Perf] Saved Mixtures - Total');
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

            // Dispatch event for data list manager
            window.dispatchEvent(new CustomEvent('savedMixturesUpdated'));

            // Reload shared solvent cache to remove deleted mixture from dropdowns
            if (window.sharedSolventCache) {
                window.sharedSolventCache.reload();
            }

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
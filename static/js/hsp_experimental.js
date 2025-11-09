// HSP Experimental functionality

class HSPExperimental {
    constructor() {
        console.log('[HSP Experimental] Constructor called');
        this.currentExperiment = null;
        this.solventTests = [];
        this.availableSolvents = [];
        this.table = null;  // SolventTableManager instance
        // Calculation settings
        this.calculationSettings = {
            loss_function: 'optimize_radius_only',
            size_factor: 0.0
        };
        this.init();
    }

    async init() {
        const initStart = performance.now();
        console.log('[HSP Experimental] Init started');

        // Load saved calculation settings
        const settingsStart = performance.now();
        this.loadCalculationSettings();
        console.log(`[HSP Experimental] Settings loaded: ${(performance.now() - settingsStart).toFixed(2)}ms`);

        const listenersStart = performance.now();
        this.setupEventListeners();
        console.log(`[HSP Experimental] Event listeners setup: ${(performance.now() - listenersStart).toFixed(2)}ms`);

        // Load available solvents first (must complete before table initialization)
        const solventsStart = performance.now();
        await this.loadAvailableSolvents();
        console.log(`[HSP Experimental] Solvents loaded: ${(performance.now() - solventsStart).toFixed(2)}ms`);

        const tableStart = performance.now();
        this.initializeSolventTable();
        console.log(`[HSP Experimental] Table initialized: ${(performance.now() - tableStart).toFixed(2)}ms`);

        // Make globally available AFTER initialization is complete
        window.hspExperimental = this;

        // Check for solvent set to load from session storage
        const sessionStart = performance.now();
        this.checkForSolventSetToLoad();
        console.log(`[HSP Experimental] Session check: ${(performance.now() - sessionStart).toFixed(2)}ms`);

        // Initialize button states
        const buttonStart = performance.now();
        this.updateAnalyzeButtonState();
        console.log(`[HSP Experimental] Button states: ${(performance.now() - buttonStart).toFixed(2)}ms`);

        console.log(`[HSP Experimental] Total init time: ${(performance.now() - initStart).toFixed(2)}ms`);
    }

    checkForSolventSetToLoad() {
        const loadSetId = sessionStorage.getItem('loadSolventSetId');
        if (loadSetId) {
            sessionStorage.removeItem('loadSolventSetId');

            // Wait for everything to be ready, then load the set
            setTimeout(() => {
                const solventSetManager = window.solventSetManager;
                if (solventSetManager) {
                    const solventSet = solventSetManager.getSolventSetById(loadSetId);
                    if (solventSet) {
                        solventSetManager.loadSolventSet(solventSet);
                    }
                }
            }, 500);
        }

        // Check if we need to load a specific experimental result from session storage
        const loadResultId = sessionStorage.getItem('loadExperimentalResultId');
        if (loadResultId) {
            sessionStorage.removeItem('loadExperimentalResultId');
            console.log('Loading experimental result from session storage:', loadResultId);

            setTimeout(() => {
                this.loadExperimentalResultData(loadResultId);
            }, 500);
        }
    }

    setupEventListeners() {
        // Visualization tab switching
        const vizTabs = document.querySelectorAll('.viz-tab');
        vizTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                this.switchVisualizationView(view);
            });
        });

        // Load data button
        const loadDataBtn = document.querySelector('#load-data-btn');
        if (loadDataBtn) {
            loadDataBtn.addEventListener('click', () => this.showLoadDataModal());
        }

        // Calculate button
        const calculateBtn = document.querySelector('#calculate-btn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.calculateHSP());
        }

        // Save data button
        const saveDataBtn = document.querySelector('#save-data-btn');
        if (saveDataBtn) {
            saveDataBtn.addEventListener('click', () => this.saveExperiment());
        }

        // Export data button
        const exportDataBtn = document.querySelector('#export-data-btn');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => this.exportExperiment());
        }

        // Add solvent button
        const addSolventBtn = document.querySelector('#add-solvent-btn');
        if (addSolventBtn) {
            addSolventBtn.addEventListener('click', () => this.addSolventRow());
        }

        // Calculation settings button
        const settingsBtn = document.querySelector('#calculation-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showCalculationSettings());
        }

        // Save calculation settings button
        const saveSettingsBtn = document.querySelector('#save-calculation-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveCalculationSettings());
        }

        // Set up data change listeners
        this.setupDataChangeListeners();
    }

    setupDataChangeListeners() {
        // Listen for changes in table data
        document.addEventListener('input', (e) => {
            if (e.target.closest('.solvent-table')) {
                console.log('Data changed (input):', e.target.tagName, e.target.type, e.target.value);
                this.resetCalculationResults();
            }
            // Update Analyze button state when sample name changes
            if (e.target.id === 'sample-name') {
                this.updateAnalyzeButtonState();
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.closest('.solvent-table')) {
                console.log('Data changed (change):', e.target.tagName, e.target.type, e.target.value);
                this.resetCalculationResults();
                this.updateAnalyzeButtonState();
            }
        });
    }

    updateAnalyzeButtonState() {
        const calculateBtn = document.querySelector('#calculate-btn');
        if (!calculateBtn) return;

        const sampleName = document.querySelector('#sample-name').value.trim();
        const tableRows = document.querySelectorAll('#solvent-table-body tr');
        const hasData = tableRows.length > 0;

        if (!sampleName) {
            calculateBtn.disabled = true;
            calculateBtn.title = 'Please enter a sample name';
        } else if (!hasData) {
            calculateBtn.disabled = true;
            calculateBtn.title = 'Please add at least one solvent test';
        } else {
            calculateBtn.disabled = false;
            calculateBtn.title = 'Calculate HSP values and generate visualization';
        }
    }

    resetCalculationResults() {
        console.log('Resetting calculation results...');

        // Clear HSP values
        document.querySelector('#delta-d').textContent = '-';
        document.querySelector('#delta-p').textContent = '-';
        document.querySelector('#delta-h').textContent = '-';
        document.querySelector('#ra').textContent = '-';

        // Hide action buttons
        const infoBtn = document.querySelector('#details-info-btn');
        if (infoBtn) {
            infoBtn.style.display = 'none';
        }
        const copyBtn = document.querySelector('#copy-hsp-btn');
        if (copyBtn) {
            copyBtn.style.display = 'none';
        }

        // Hide result action buttons
        const saveResultBtn = document.querySelector('#save-result-btn');
        if (saveResultBtn) {
            saveResultBtn.disabled = true;
            saveResultBtn.title = 'Calculate HSP first to enable saving';
        }
        const exportPackageBtn = document.querySelector('#export-package-btn');
        if (exportPackageBtn) {
            exportPackageBtn.disabled = true;
            exportPackageBtn.title = 'Calculate HSP first to enable export';
        }

        // Clear visualization
        const plotlyDiv = document.querySelector('#plotly-visualization');
        if (plotlyDiv) {
            const placeholder = `
                <div class="visualization-placeholder">
                    <p>Calculate HSP to display 3D Hansen sphere</p>
                    <small>Interactive 3D visualization will appear after calculation</small>
                </div>
            `;
            plotlyDiv.innerHTML = placeholder;
            console.log('Hansen sphere visualization cleared');
        }

        // Show recalculation message
        const statusDiv = document.querySelector('#calculation-status');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: #f59e0b;">⚠ Recalculation needed</span>';
            statusDiv.style.display = 'block';
        }
    }

    async loadAvailableSolvents() {
        const start = performance.now();
        console.log('[HSP Experimental] Loading available solvents...');

        try {
            const fetchStart = performance.now();
            const response = await fetch('/api/hsp-experimental/solvents');
            console.log(`[HSP Experimental] Fetch completed: ${(performance.now() - fetchStart).toFixed(2)}ms`);

            if (response.ok) {
                const parseStart = performance.now();
                this.availableSolvents = await response.json();
                console.log(`[HSP Experimental] JSON parsed: ${(performance.now() - parseStart).toFixed(2)}ms, count: ${this.availableSolvents.length}`);

                const updateStart = performance.now();
                this.updateSolventDropdowns();
                console.log(`[HSP Experimental] Dropdowns updated: ${(performance.now() - updateStart).toFixed(2)}ms`);
            } else {
                console.error('Failed to load available solvents');
            }
        } catch (error) {
            console.error('Error loading solvents:', error);
        }

        console.log(`[HSP Experimental] loadAvailableSolvents total: ${(performance.now() - start).toFixed(2)}ms`);
    }

    initializeSolventTable() {
        const start = performance.now();
        console.log('[HSP Experimental] Initializing solvent table...');

        const containerStart = performance.now();
        const tableContainer = document.querySelector('#solvent-table-container');
        if (!tableContainer) {
            console.warn('[HSP Experimental] Table container not found!');
            return;
        }
        console.log(`[HSP Experimental] Container found: ${(performance.now() - containerStart).toFixed(2)}ms`);

        // Create header, table wrapper, and footer structure
        const htmlStart = performance.now();
        tableContainer.innerHTML = `
            <div class="solvent-table-header">
                <h3>Solvent Tests</h3>
                <div class="solvent-set-controls">
                    <select id="solvent-set-selector" class="solvent-set-select">
                        <option value="">Select saved solvent set...</option>
                    </select>
                    <button id="load-solvent-set-btn" class="btn btn-secondary btn-small" disabled>Load</button>
                    <div class="save-set-group">
                        <input type="text" id="new-set-name" class="set-name-input" placeholder="Set name">
                        <button id="save-solvent-set-btn" class="btn btn-primary btn-small">Save</button>
                    </div>
                    <button id="new-experiment-btn" class="btn btn-secondary btn-small" title="Start a new experiment">New Experiment</button>
                </div>
            </div>
            <div class="table-wrapper" id="table-wrapper">
                <div id="solvent-table-body"></div>
            </div>
            <div class="table-footer">
                <button id="add-solvent-btn" class="btn btn-secondary">Add Solvent</button>
            </div>
        `;
        console.log(`[HSP Experimental] HTML set: ${(performance.now() - htmlStart).toFixed(2)}ms`);

        // Initialize SolventTableManager
        const tableManagerStart = performance.now();
        this.table = new SolventTableManager({
            containerId: 'solvent-table-body',
            datalistOptions: this.availableSolvents,
            datalistId: 'experimental-solvent-datalist',
            columns: [
                {
                    key: 'solvent',
                    label: 'Solvent Name',
                    type: 'text-autocomplete',
                    placeholder: 'Enter solvent name',
                    defaultValue: ''
                },
                {
                    key: 'delta_d',
                    label: '&delta;D<br>(MPa<sup>0.5</sup>)',
                    type: 'readonly-hsp'
                },
                {
                    key: 'delta_p',
                    label: '&delta;P<br>(MPa<sup>0.5</sup>)',
                    type: 'readonly-hsp'
                },
                {
                    key: 'delta_h',
                    label: '&delta;H<br>(MPa<sup>0.5</sup>)',
                    type: 'readonly-hsp'
                },
                {
                    key: 'solubility',
                    label: 'Solubility',
                    type: 'solubility-select',
                    defaultValue: ''
                },
                {
                    key: 'notes',
                    label: 'Notes',
                    type: 'text',
                    placeholder: 'Notes',
                    defaultValue: ''
                },
                {
                    key: 'actions',
                    label: 'Actions',
                    type: 'actions-with-mode'
                }
            ],
            onDataChange: () => {
                this.updateSolventTestData();
                this.updateAnalyzeButtonState();
            },
            onSolventLookup: async (row, solventName) => {
                await this.lookupSolvent(row, solventName);
            },
            onRowRemove: () => {
                this.updateSolventTestData();
                this.updateAnalyzeButtonState();
            },
            onModeToggle: (row, newMode) => {
                this.handleModeToggle(row, newMode);
            }
        });
        console.log(`[HSP Experimental] TableManager created: ${(performance.now() - tableManagerStart).toFixed(2)}ms`);

        // Add initial row
        const addRowStart = performance.now();
        this.table.addRow();
        console.log(`[HSP Experimental] Initial row added: ${(performance.now() - addRowStart).toFixed(2)}ms`);

        // Re-attach event listener for add button
        const attachStart = performance.now();
        const addBtn = document.querySelector('#add-solvent-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addSolventRow());
        }

        // Re-attach event listener for new experiment button
        const newExpBtn = document.querySelector('#new-experiment-btn');
        if (newExpBtn) {
            newExpBtn.addEventListener('click', () => this.startNewExperiment());
        }
        console.log(`[HSP Experimental] Event listeners attached: ${(performance.now() - attachStart).toFixed(2)}ms`);

        // Dispatch event to notify other components that the table is ready
        const eventStart = performance.now();
        document.dispatchEvent(new CustomEvent('hspExperimentalReady'));
        console.log(`[HSP Experimental] Ready event dispatched: ${(performance.now() - eventStart).toFixed(2)}ms`);

        console.log(`[HSP Experimental] initializeSolventTable total: ${(performance.now() - start).toFixed(2)}ms`);
        console.log('HSP Experimental table initialized and ready');
    }

    addSolventRow(autoScroll = true) {
        if (!this.table) return;

        this.table.addRow();

        // Auto-scroll to the new row only if requested (e.g., manual addition)
        if (autoScroll) {
            setTimeout(() => {
                const tableWrapper = document.querySelector('#table-wrapper');
                if (tableWrapper) {
                    const rows = tableWrapper.querySelectorAll('tr');
                    const newRow = rows[rows.length - 1];
                    if (newRow) {
                        newRow.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest'
                        });
                    }
                }
            }, 100);
        }
    }

    /**
     * Lookup solvent HSP from database (callback for SolventTableManager)
     */
    async lookupSolvent(row, solventName) {
        if (!solventName) return;

        // Only auto-lookup in auto mode
        const currentMode = row.mode || 'auto';
        if (currentMode === 'manual') return;

        // Validate: only lookup if solvent name exists in available solvents list (exact match)
        const solventExists = this.availableSolvents.some(
            s => s.toLowerCase() === solventName.toLowerCase()
        );

        if (!solventExists) {
            // Clear HSP values if solvent doesn't exist in list
            this.table.updateRow(row.id, {
                delta_d: null,
                delta_p: null,
                delta_h: null,
                source_url: null
            });
            return;
        }

        try {
            const response = await fetch(`/api/hsp-experimental/solvents/${encodeURIComponent(solventName)}`);
            if (response.ok) {
                const solventData = await response.json();
                // Update row data with HSP values
                this.table.updateRow(row.id, {
                    delta_d: solventData.delta_d,
                    delta_p: solventData.delta_p,
                    delta_h: solventData.delta_h,
                    source_url: solventData.source_url
                });
            } else {
                // Solvent not found, clear HSP values
                this.table.updateRow(row.id, {
                    delta_d: null,
                    delta_p: null,
                    delta_h: null,
                    source_url: null
                });
            }
        } catch (error) {
            console.error('Error fetching solvent data:', error);
            this.table.updateRow(row.id, {
                delta_d: null,
                delta_p: null,
                delta_h: null,
                source_url: null
            });
        }
    }

    /**
     * Handle mode toggle (callback for SolventTableManager)
     */
    handleModeToggle(row, newMode) {
        if (newMode === 'manual') {
            // Switch to manual mode: clear HSP values
            this.table.updateRow(row.id, {
                delta_d: null,
                delta_p: null,
                delta_h: null
            });
        } else {
            // Switch to auto mode: clear and try to reload from database
            this.table.updateRow(row.id, {
                delta_d: null,
                delta_p: null,
                delta_h: null
            });

            if (row.solvent) {
                this.lookupSolvent(row, row.solvent);
            }
        }
    }

    updateSolventTestData() {
        if (!this.table) return;

        const rows = this.table.getData();
        this.solventTests = [];

        rows.forEach(row => {
            const solventName = row.solvent ? row.solvent.trim() : '';
            if (!solventName) return;

            const testData = {
                solvent_name: solventName,
                solubility: row.solubility || 'insoluble',
                notes: row.notes || null
            };

            // Add HSP values if available
            if (row.delta_d !== null && row.delta_p !== null && row.delta_h !== null) {
                if (row.mode === 'manual') {
                    testData.manual_delta_d = row.delta_d;
                    testData.manual_delta_p = row.delta_p;
                    testData.manual_delta_h = row.delta_h;
                }
                // Don't send solvent_data in experiment creation
                // Let the server handle database lookup
            }

            this.solventTests.push(testData);
        });
    }

    async calculateHSP() {
        if (this.solventTests.length === 0) {
            this.showNotification('Please add at least one solvent test before calculating HSP values', 'error');
            return;
        }

        const sampleName = document.querySelector('#sample-name').value.trim();
        if (!sampleName) {
            this.showNotification('Please enter a sample name before calculating HSP values', 'error');
            return;
        }

        try {
            // Show loading state on button
            const calculateBtn = document.querySelector('#calculate-btn');
            const originalText = calculateBtn.textContent;
            calculateBtn.textContent = 'Calculating...';
            calculateBtn.disabled = true;

            // Update solvent test data
            this.updateSolventTestData();

            // Save or update the experiment with current data
            if (!this.currentExperiment) {
                // Create new experiment
                await this.saveExperiment();
                if (!this.currentExperiment) {
                    this.showNotification('Failed to create experiment', 'error');
                    return;
                }
            } else {
                // Update existing experiment with latest data
                try {
                    await this.updateExperiment();
                    console.log('Experiment updated with latest table data');
                } catch (error) {
                    this.showNotification(`Failed to update experiment: ${error.message}`, 'error');
                    return;
                }
            }

            this.showNotification('🔬 Calculating HSP values...', 'info');

            // Call the HSP calculation API with calculation settings
            const response = await fetch(`/api/hsp-experimental/experiments/${this.currentExperiment}/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    loss_function: this.calculationSettings.loss_function,
                    size_factor: this.calculationSettings.size_factor
                })
            });

            if (response.ok) {
                const result = await response.json();

                this.showNotification('📊 Updating visualization...', 'info');

                // Show calculation results and details, load visualization simultaneously
                await Promise.all([
                    this.showCalculationResults(result),
                    this.showCalculationDetails(result),
                    new Promise(resolve => {
                        setTimeout(() => {
                            this.loadHansenSphereVisualization();
                            resolve();
                        }, 100);
                    })
                ]);

                this.showNotification(
                    `✓ HSP calculation completed: δD=${Utils.formatHSPValue(result.delta_d)}, δP=${Utils.formatHSPValue(result.delta_p)}, δH=${Utils.formatHSPValue(result.delta_h)}`,
                    'success'
                );

                // Clear calculation status after successful completion
                const statusDiv = document.querySelector('#calculation-status');
                statusDiv.style.display = 'none';

            } else {
                const error = await response.json();
                console.error('HSP calculation error:', error);
                const errorDetail = typeof error.detail === 'object' ? JSON.stringify(error.detail) : error.detail;
                this.showNotification(`❌ HSP calculation failed: ${errorDetail}`, 'error');
            }

            // Restore button
            calculateBtn.textContent = originalText;
            calculateBtn.disabled = false;

        } catch (error) {
            console.error('Error calculating HSP:', error);
            this.showNotification('❌ Error calculating HSP values', 'error');

            // Restore button in case of error
            const calculateBtn = document.querySelector('#calculate-btn');
            calculateBtn.textContent = 'Calculate HSP';
            calculateBtn.disabled = false;
        }
    }

    showCalculationResults(result) {
        // Update HSP values in header
        document.getElementById('delta-d').textContent = Utils.formatHSPValue(result.delta_d);
        document.getElementById('delta-p').textContent = Utils.formatHSPValue(result.delta_p);
        document.getElementById('delta-h').textContent = Utils.formatHSPValue(result.delta_h);
        document.getElementById('ra').textContent = Utils.formatHSPValue(result.radius);
    }

    showCalculationDetails(result) {
        // Store calculation details for modal
        this.calculationDetails = result;

        // Show info button
        const infoBtn = document.querySelector('#details-info-btn');
        infoBtn.style.display = 'block';

        // Remove existing event listener and add new one
        const newInfoBtn = infoBtn.cloneNode(true);
        infoBtn.parentNode.replaceChild(newInfoBtn, infoBtn);

        newInfoBtn.addEventListener('click', () => {
            this.showCalculationDetailsModal(result);
        });

        // Show and setup copy button
        const copyBtn = document.querySelector('#copy-hsp-btn');
        copyBtn.style.display = 'block';

        // Remove existing event listener and add new one
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);

        newCopyBtn.addEventListener('click', () => {
            this.copyHSPDataToClipboard(result);
        });

        // Enable and setup result action buttons
        this.enableResultActionButtons(result);
    }

    enableResultActionButtons(result) {
        // Store result data for save/export operations
        this.currentCalculationResult = result;

        // Enable save result button
        const saveResultBtn = document.querySelector('#save-result-btn');
        if (saveResultBtn) {
            saveResultBtn.disabled = false;
            saveResultBtn.title = 'Save HSP calculation results to local storage';

            // Remove existing event listener and add new one
            const newSaveResultBtn = saveResultBtn.cloneNode(true);
            saveResultBtn.parentNode.replaceChild(newSaveResultBtn, saveResultBtn);

            newSaveResultBtn.addEventListener('click', () => {
                this.saveExperimentalResult();
            });
        }

        // Enable export package button
        const exportPackageBtn = document.querySelector('#export-package-btn');
        if (exportPackageBtn) {
            exportPackageBtn.disabled = false;
            exportPackageBtn.title = 'Export visualization graphs and data as ZIP package';

            // Remove existing event listener and add new one
            const newExportPackageBtn = exportPackageBtn.cloneNode(true);
            exportPackageBtn.parentNode.replaceChild(newExportPackageBtn, exportPackageBtn);

            newExportPackageBtn.addEventListener('click', () => {
                this.exportGraphsAsZip();
            });
        }
    }

    async copyHSPDataToClipboard(result) {
        try {
            // Get sample name
            const sampleNameInput = document.querySelector('#sample-name');
            const sampleName = sampleNameInput ? sampleNameInput.value.trim() : '';
            const displayName = sampleName || 'Unknown Sample';

            // Use original (unrounded) values if available, otherwise display values
            const deltaD = result.original_delta_d !== undefined ? result.original_delta_d : result.delta_d;
            const deltaP = result.original_delta_p !== undefined ? result.original_delta_p : result.delta_p;
            const deltaH = result.original_delta_h !== undefined ? result.original_delta_h : result.delta_h;
            const ra = result.original_radius !== undefined ? result.original_radius : result.radius;

            // Create tab-separated data for Excel
            const header = 'Sample Name\tδD\tδP\tδH\tRa';
            const dataRow = `${displayName}\t${deltaD}\t${deltaP}\t${deltaH}\t${ra}`;
            const copyText = `${header}\n${dataRow}`;

            // Copy to clipboard using modern API
            await navigator.clipboard.writeText(copyText);

            // Show success notification
            this.showNotification('HSP data copied to clipboard for Excel', 'success');

            // Temporary visual feedback
            const copyBtn = document.querySelector('#copy-hsp-btn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓';
            copyBtn.style.color = '#10b981';

            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.color = '';
            }, 1500);

        } catch (error) {
            console.error('Failed to copy HSP data:', error);

            // Fallback for older browsers
            try {
                this.fallbackCopyToClipboard(result);
            } catch (fallbackError) {
                console.error('Fallback copy also failed:', fallbackError);
                this.showNotification('Failed to copy HSP data to clipboard', 'error');
            }
        }
    }

    fallbackCopyToClipboard(result) {
        // Get sample name
        const sampleNameInput = document.querySelector('#sample-name');
        const sampleName = sampleNameInput ? sampleNameInput.value.trim() : '';
        const displayName = sampleName || 'Unknown Sample';

        // Use original values if available
        const deltaD = result.original_delta_d !== undefined ? result.original_delta_d : result.delta_d;
        const deltaP = result.original_delta_p !== undefined ? result.original_delta_p : result.delta_p;
        const deltaH = result.original_delta_h !== undefined ? result.original_delta_h : result.delta_h;
        const ra = result.original_radius !== undefined ? result.original_radius : result.radius;

        // Create tab-separated data
        const header = 'Sample Name\tδD\tδP\tδH\tRa';
        const dataRow = `${displayName}\t${deltaD}\t${deltaP}\t${deltaH}\t${ra}`;
        const copyText = `${header}\n${dataRow}`;

        // Create temporary textarea for fallback copy
        const textArea = document.createElement('textarea');
        textArea.value = copyText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        if (document.execCommand('copy')) {
            this.showNotification('HSP data copied to clipboard for Excel', 'success');
        } else {
            throw new Error('execCommand failed');
        }

        document.body.removeChild(textArea);
    }

    saveExperimentalResult() {
        try {
            // Get sample name
            const sampleNameInput = document.querySelector('#sample-name');
            const sampleName = sampleNameInput ? sampleNameInput.value.trim() : '';

            if (!sampleName) {
                alert('Please enter a sample name before saving the result.');
                if (sampleNameInput) {
                    sampleNameInput.focus();
                    sampleNameInput.style.borderColor = '#ef4444';
                    setTimeout(() => {
                        sampleNameInput.style.borderColor = '';
                    }, 2000);
                }
                return;
            }

            if (!this.currentCalculationResult) {
                this.showNotification('No calculation result available to save', 'error');
                return;
            }

            // Update solvent test data to get current state
            this.updateSolventTestData();

            // Check if experimental results manager is available
            if (!window.experimentalResultsManager) {
                this.showNotification('Experimental results manager not available', 'error');
                return;
            }

            // Save the result using the experimental results manager
            window.experimentalResultsManager.saveExperimentalResult(
                sampleName,
                this.currentCalculationResult,
                this.solventTests,
                '' // notes - could be added later
            ).then(() => {
                // Success handled by the results manager
                console.log('Experimental result saved successfully');
            }).catch(error => {
                console.error('Failed to save experimental result:', error);
                this.showNotification('Failed to save experimental result', 'error');
            });

        } catch (error) {
            console.error('Error saving experimental result:', error);
            this.showNotification('Failed to save experimental result', 'error');
        }
    }

    exportCurrentResult() {
        try {
            // Get sample name
            const sampleNameInput = document.querySelector('#sample-name');
            const sampleName = sampleNameInput ? sampleNameInput.value.trim() : '';
            const displayName = sampleName || 'Unknown Sample';

            if (!this.currentCalculationResult) {
                this.showNotification('No calculation result available to export', 'error');
                return;
            }

            // Update solvent test data to get current state
            this.updateSolventTestData();

            // Create export data structure
            const exportData = {
                version: '1.0',
                exported: Utils.formatISO(),
                sample_name: displayName,
                hsp_result: this.currentCalculationResult,
                solvents: this.solventTests,
                metadata: {
                    solvent_count: this.solventTests.length,
                    calculation_method: 'experimental',
                    export_type: 'single_result'
                }
            };

            // Create and download file
            const filename = `hsp-result-${displayName.replace(/[^a-zA-Z0-9]/g, '_')}-${Utils.formatISO().split('T')[0]}.json`;
            Utils.downloadJSON(exportData, filename);

            Notification.success(`Result exported: ${displayName}`);

        } catch (error) {
            console.error('Error exporting result:', error);
            this.showNotification('Failed to export result', 'error');
        }
    }

    async loadExperimentalResultData(resultId) {
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

            console.log('Loading experimental result:', result.sample_name);
            console.log('Result data structure:', result);

            // Clear existing data
            this.clearSolventTable();

            // Load sample name
            const sampleNameInput = document.querySelector('#sample-name');
            if (sampleNameInput) {
                sampleNameInput.value = result.sample_name;
            }

            // Convert saved data to table format
            const tableData = result.solvents.map((solventData, index) => {
                console.log(`Processing solvent ${index}:`, solventData);

                const rowData = {
                    solvent: solventData.solvent_name,
                    delta_d: null,
                    delta_p: null,
                    delta_h: null,
                    solubility: solventData.solubility || '',
                    notes: solventData.notes || '',
                    mode: solventData.mode || 'auto',
                    source_url: null
                };

                // Set HSP values based on mode
                if (solventData.mode === 'manual' && solventData.manual_values) {
                    rowData.delta_d = solventData.manual_values.delta_d;
                    rowData.delta_p = solventData.manual_values.delta_p;
                    rowData.delta_h = solventData.manual_values.delta_h;
                    console.log(`  Manual mode HSP values loaded for ${solventData.solvent_name}`);
                } else if (solventData.auto_values) {
                    console.log(`  auto_values object for ${solventData.solvent_name}:`, solventData.auto_values);

                    // Try different property names (backward compatibility)
                    rowData.delta_d = solventData.auto_values.delta_d || solventData.auto_values.δD || null;
                    rowData.delta_p = solventData.auto_values.delta_p || solventData.auto_values.δP || null;
                    rowData.delta_h = solventData.auto_values.delta_h || solventData.auto_values.δH || null;
                    rowData.source_url = solventData.auto_values.source_url || null;

                    console.log(`  Extracted HSP values: δD=${rowData.delta_d}, δP=${rowData.delta_p}, δH=${rowData.delta_h}`);
                } else {
                    console.log(`  No HSP values found for ${solventData.solvent_name}`);
                }

                return rowData;
            });

            // Set all data at once
            this.table.setData(tableData);

            // For auto mode rows without HSP values, trigger lookup
            // This handles both new data and legacy data (Phase 2実装前)
            const rows = this.table.getData();
            for (const row of rows) {
                if (row.mode === 'auto' && row.delta_d === null && row.solvent) {
                    console.log(`  Re-fetching HSP for ${row.solvent} (legacy data or missing values)`);
                    await this.lookupSolvent(row, row.solvent);
                }
            }

            // Render table with updated data
            this.table.render();

            // Update solvent test data
            this.updateSolventTestData();

            // Create experiment
            await this.saveExperiment();
            if (!this.currentExperiment) {
                this.showNotification('Failed to create experiment', 'error');
                return;
            }

            // Calculate HSP to store in backend and generate visualization
            const calculateResponse = await fetch(`/api/hsp-experimental/experiments/${this.currentExperiment}/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    loss_function: this.calculationSettings.loss_function,
                    size_factor: this.calculationSettings.size_factor
                })
            });

            if (!calculateResponse.ok) {
                this.showNotification('Failed to calculate HSP', 'error');
                return;
            }

            // Get recalculated result with current settings
            const recalculatedResult = await calculateResponse.json();

            // Display recalculated HSP results (instead of stored result.hsp_result)
            this.showCalculationResults(recalculatedResult);
            this.showCalculationDetails(recalculatedResult);

            // Load visualization (3D and 2D)
            await this.loadHansenSphereVisualization();

            // Scroll to top to show HSP results
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

            this.showNotification(`Loaded: ${result.sample_name}`, 'success');

        } catch (error) {
            console.error('Error loading experimental result:', error);
            this.showNotification('Failed to load experimental result', 'error');
        }
    }

    clearSolventTable() {
        if (this.table) {
            this.table.setData([]);
        }
    }

    showCalculationDetailsModal(result) {
        const modal = document.querySelector('#calculation-details-modal');
        const modalBody = document.querySelector('#modal-calculation-details');

        modalBody.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <label>Method:</label>
                    <span>${result.method}</span>
                </div>
                <div class="detail-item">
                    <label>Accuracy:</label>
                    <span>${(result.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div class="detail-item">
                    <label>Error:</label>
                    <span>${result.error.toFixed(6)}</span>
                </div>
                <div class="detail-item">
                    <label>Data Fit:</label>
                    <span>${(result.data_fit * 100).toFixed(1)}%</span>
                </div>
                <div class="detail-item">
                    <label>Good Solvents:</label>
                    <span>${result.good_solvents}</span>
                </div>
                <div class="detail-item">
                    <label>Total Solvents:</label>
                    <span>${result.solvent_count}</span>
                </div>
                <div class="detail-item">
                    <label>Total δ:</label>
                    <span>${Math.sqrt(result.delta_d**2 + result.delta_p**2 + result.delta_h**2).toFixed(1)}</span>
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        // Close modal functionality
        const closeBtn = modal.querySelector('.modal-close');
        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
    }

    async saveExperiment() {
        const sampleName = document.querySelector('#sample-name').value.trim();
        if (!sampleName) {
            alert('Please enter a sample name before saving.');
            return;
        }

        if (this.solventTests.length === 0) {
            alert('Please add at least one solvent test before saving.');
            return;
        }

        try {
            this.updateSolventTestData();

            const experimentData = {
                sample_name: sampleName,
                description: null,
                solvent_tests: this.solventTests,
                experimenter: null,
                notes: null,
                tags: []
            };

            const response = await fetch('/api/hsp-experimental/experiments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(experimentData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showNotification(`Experiment saved with ID: ${result.id}`, 'success');
                this.currentExperiment = result.id;
            } else {
                const error = await response.json();
                this.showNotification(`Error saving experiment: ${error.detail}`, 'error');
            }

        } catch (error) {
            console.error('Error saving experiment:', error);
            this.showNotification('Error saving experiment', 'error');
        }
    }

    async updateExperiment() {
        if (!this.currentExperiment) {
            throw new Error('No experiment to update');
        }

        const sampleName = document.querySelector('#sample-name').value.trim();
        if (!sampleName) {
            throw new Error('Please enter a sample name before updating');
        }

        if (this.solventTests.length === 0) {
            throw new Error('Please add at least one solvent test before updating');
        }

        try {
            this.updateSolventTestData();

            const experimentData = {
                sample_name: sampleName,
                description: null,
                solvent_tests: this.solventTests,
                experimenter: null,
                notes: null,
                tags: []
            };

            const response = await fetch(`/api/hsp-experimental/experiments/${this.currentExperiment}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(experimentData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`Experiment updated: ${result.message}`);
                return true;
            } else {
                const error = await response.json();
                throw new Error(`Failed to update experiment: ${error.detail}`);
            }

        } catch (error) {
            console.error('Error updating experiment:', error);
            throw error;
        }
    }

    async exportExperiment() {
        if (!this.currentExperiment) {
            alert('Please save the experiment first before exporting.');
            return;
        }

        try {
            const response = await fetch(`/api/hsp-experimental/experiments/${this.currentExperiment}/export`);
            if (response.ok) {
                const data = await response.json();
                this.downloadJSON(data, `experiment_${this.currentExperiment}.json`);
                this.showNotification('Experiment exported successfully', 'success');
            } else {
                this.showNotification('Error exporting experiment', 'error');
            }
        } catch (error) {
            console.error('Error exporting experiment:', error);
            this.showNotification('Error exporting experiment', 'error');
        }
    }

    downloadJSON(data, filename) {
        Utils.downloadJSON(data, filename);
    }

    showLoadDataModal() {
        const resultsManager = window.experimentalResultsManager;
        if (!resultsManager) {
            Notification.error('Experimental results manager not available');
            return;
        }

        const results = resultsManager.getExperimentalResults();
        const modal = document.querySelector('#load-data-modal');
        const resultsList = document.querySelector('#results-list');
        const searchInput = document.querySelector('#result-search');

        if (!modal || !resultsList) {
            Notification.error('Modal elements not found');
            return;
        }

        // Display results
        this.displayLoadDataResults(results, resultsList);

        // Setup search functionality
        searchInput.value = '';
        searchInput.oninput = Utils.debounce((e) => {
            const query = e.target.value.toLowerCase();
            const filtered = results.filter(r =>
                r.sample_name.toLowerCase().includes(query)
            );
            this.displayLoadDataResults(filtered, resultsList);
        }, 300);

        // Show modal
        modal.style.display = 'flex';

        // Setup modal close handlers
        this.setupLoadDataModalListeners(modal);
    }

    displayLoadDataResults(results, container) {
        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-results">
                    <p><strong>No saved results found</strong></p>
                    <p>Save calculation results to load them later</p>
                </div>
            `;
            return;
        }

        const resultsHTML = results.map(result => `
            <div class="result-item" data-result-id="${result.id}">
                <div class="result-header">
                    <span class="result-name">${Utils.escapeHtml(result.sample_name)}</span>
                    <span class="result-date">${Utils.formatDate(result.created)}</span>
                </div>
                <div class="result-hsp">
                    <span class="hsp-item"><strong>δD:</strong> ${Utils.formatHSPValue(result.hsp_result.delta_d)}</span>
                    <span class="hsp-item"><strong>δP:</strong> ${Utils.formatHSPValue(result.hsp_result.delta_p)}</span>
                    <span class="hsp-item"><strong>δH:</strong> ${Utils.formatHSPValue(result.hsp_result.delta_h)}</span>
                    <span class="hsp-item"><strong>R0:</strong> ${Utils.formatHSPValue(result.hsp_result.radius)}</span>
                </div>
                <div class="result-meta">
                    <span>${result.metadata.solvent_count} solvents</span>
                    ${result.last_modified && result.last_modified !== result.created ?
                        `<span>Modified: ${Utils.formatDate(result.last_modified)}</span>` : ''}
                </div>
            </div>
        `).join('');

        container.innerHTML = resultsHTML;

        // Add click handlers to result items
        container.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                const resultId = item.dataset.resultId;
                this.loadResultFromModal(resultId);
            });
        });
    }

    loadResultFromModal(resultId) {
        const modal = document.querySelector('#load-data-modal');
        modal.style.display = 'none';

        this.loadExperimentalResultData(resultId);
    }

    setupLoadDataModalListeners(modal) {
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('#cancel-load-data');

        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;

        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };

        // Escape key to close
        const escapeHandler = (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    async loadHansenSphereVisualization() {
        if (!this.currentExperiment) {
            console.log('No current experiment for visualization');
            return;
        }

        try {
            // Get container size for dynamic sizing
            const container = document.querySelector('#plotly-visualization');
            const containerRect = container ? container.getBoundingClientRect() : { width: 1000, height: 700 };
            const width = Math.round(Math.min(1200, Math.max(800, containerRect.width)));
            const height = Math.round(Math.min(800, Math.max(600, containerRect.height)));

            const response = await fetch(`/api/hsp-experimental/experiments/${this.currentExperiment}/visualization?width=${width}&height=${height}`);

            if (response.ok) {
                const data = await response.json();
                console.log('Visualization API response:', data);
                console.log('projections_2d available:', !!data.projections_2d);

                this.displayPlotlyVisualization(data.plotly_config);

                // Render 2D projections if available
                if (data.projections_2d) {
                    console.log('Calling render2DProjections with:', data.projections_2d);
                    this.render2DProjections(data.projections_2d);
                } else {
                    console.warn('No projections_2d in API response');
                }

                // Show refresh button
                const refreshBtn = document.querySelector('#refresh-visualization-btn');
                if (refreshBtn) {
                    refreshBtn.style.display = 'block';
                    refreshBtn.onclick = () => this.loadHansenSphereVisualization();
                }

                this.showNotification('Hansen sphere visualization loaded', 'success');
            } else {
                const error = await response.json();
                console.error('Visualization error:', error);
                this.showVisualizationError(error.detail || 'Failed to load visualization');
            }
        } catch (error) {
            console.error('Error loading visualization:', error);
            this.showVisualizationError('Network error loading visualization');
        }
    }

    displayPlotlyVisualization(plotlyConfig) {
        const container = document.querySelector('#plotly-visualization');
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Create Plotly plot
        const plotDiv = document.createElement('div');
        plotDiv.style.width = '100%';
        plotDiv.style.height = '100%';
        plotDiv.style.minHeight = '350px';
        container.appendChild(plotDiv);

        // Configure Plotly
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['autoScale2d', 'resetScale2d'],
            displaylogo: false,
            toImageButtonOptions: {
                format: 'png',
                filename: 'hansen_sphere',
                height: 600,
                width: 800,
                scale: 1
            }
        };

        // Create plot
        Plotly.newPlot(plotDiv, plotlyConfig.data, plotlyConfig.layout, config);
    }

    showVisualizationError(message) {
        const container = document.querySelector('#plotly-visualization');
        if (!container) return;

        container.innerHTML = `
            <div class="visualization-placeholder">
                <p style="color: #ef4444;">❌ Visualization Error</p>
                <small>${message}</small>
                <br><br>
                <small>Please ensure HSP has been calculated successfully</small>
            </div>
        `;
    }

    updateSolventDropdowns() {
        const datalists = document.querySelectorAll('#solvent-datalist');
        const optionsHTML = Utils.createDatalistOptions(this.availableSolvents);
        datalists.forEach(datalist => {
            datalist.innerHTML = optionsHTML;
        });
    }

    switchVisualizationView(view) {
        // Update tab states
        const tabs = document.querySelectorAll('.viz-tab');
        tabs.forEach(tab => {
            if (tab.dataset.view === view) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update panel visibility
        const view3d = document.querySelector('#view-3d');
        const view2d = document.querySelector('#view-2d');

        if (view === 'view-3d') {
            if (view3d) {
                view3d.classList.add('active');
                view3d.style.display = '';
            }
            if (view2d) {
                view2d.classList.remove('active');
                view2d.style.display = 'none';
            }
        } else if (view === 'view-2d') {
            if (view3d) {
                view3d.classList.remove('active');
                view3d.style.display = 'none';
            }
            if (view2d) {
                view2d.classList.add('active');
                view2d.style.display = '';
            }
        }
    }

    render2DProjections(projections) {
        console.log('render2DProjections called with:', projections);

        if (!projections) {
            console.warn('No projections data provided');
            return;
        }

        // Use unified subplot container
        const containerId = 'plot-2d-subplots';
        const element = document.getElementById(containerId);

        if (!element) {
            console.warn(`Container #${containerId} not found`);
            return;
        }

        // Prepare all traces with subplot assignments
        // Draw lines (ellipses) first, then markers (points) so points appear on top
        const allTraces = [];
        const lineTraces = [];
        const markerTraces = [];

        // δD vs δP (subplot 1)
        if (projections.dd_dp) {
            projections.dd_dp.data.forEach(trace => {
                const newTrace = {...trace, xaxis: 'x', yaxis: 'y'};
                if (trace.mode === 'lines' || trace.type === 'scatter' && !trace.mode?.includes('markers')) {
                    lineTraces.push(newTrace);
                } else {
                    markerTraces.push(newTrace);
                }
            });
        }

        // δD vs δH (subplot 2)
        if (projections.dd_dh) {
            projections.dd_dh.data.forEach(trace => {
                const newTrace = {...trace, xaxis: 'x2', yaxis: 'y2'};
                if (trace.mode === 'lines' || trace.type === 'scatter' && !trace.mode?.includes('markers')) {
                    lineTraces.push(newTrace);
                } else {
                    markerTraces.push(newTrace);
                }
            });
        }

        // δP vs δH (subplot 3)
        if (projections.dp_dh) {
            projections.dp_dh.data.forEach(trace => {
                const newTrace = {...trace, xaxis: 'x3', yaxis: 'y3'};
                if (trace.mode === 'lines' || trace.type === 'scatter' && !trace.mode?.includes('markers')) {
                    lineTraces.push(newTrace);
                } else {
                    markerTraces.push(newTrace);
                }
            });
        }

        // Add line traces first, then marker traces
        allTraces.push(...lineTraces, ...markerTraces);

        // Calculate max values for each axis from data
        const getMaxFromTraces = (traces, axis) => {
            let max = 0;
            traces.forEach(trace => {
                if (trace[axis] && Array.isArray(trace[axis])) {
                    const traceMax = Math.max(...trace[axis]);
                    if (traceMax > max) max = traceMax;
                }
            });
            return max;
        };

        // Get max values for each parameter
        const maxD = Math.max(
            getMaxFromTraces(projections.dd_dp.data, 'x'),
            getMaxFromTraces(projections.dd_dh.data, 'x')
        );
        const maxP = Math.max(
            getMaxFromTraces(projections.dd_dp.data, 'y'),
            getMaxFromTraces(projections.dp_dh.data, 'x')
        );
        const maxH = Math.max(
            getMaxFromTraces(projections.dd_dh.data, 'y'),
            getMaxFromTraces(projections.dp_dh.data, 'y')
        );

        // Apply 1.1x margin to max values
        const rangeD = [0, maxD * 1.1];
        const rangeP = [0, maxP * 1.1];
        const rangeH = [0, maxH * 1.1];

        console.log('Calculated axis ranges:', {
            δD: rangeD,
            δP: rangeP,
            δH: rangeH
        });

        // Create layout with 3 subplots in a row
        const layout = {
            grid: {rows: 1, columns: 3, pattern: 'independent', subplots: [['xy'], ['x2y2'], ['x3y3']]},
            showlegend: false,
            margin: {l: 50, r: 50, t: 30, b: 50},

            // Subplot 1: δD vs δP
            xaxis: {
                range: rangeD,
                domain: [0, 0.28],
                title: {text: 'δD (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'y'
            },
            yaxis: {
                range: rangeP,
                domain: [0, 1],
                title: {text: 'δP (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'x'
            },

            // Subplot 2: δD vs δH
            xaxis2: {
                range: rangeD,
                domain: [0.37, 0.65],
                title: {text: 'δD (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'y2'
            },
            yaxis2: {
                range: rangeH,
                domain: [0, 1],
                title: {text: 'δH (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'x2'
            },

            // Subplot 3: δP vs δH
            xaxis3: {
                range: rangeP,
                domain: [0.72, 1],
                title: {text: 'δP (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'y3'
            },
            yaxis3: {
                range: rangeH,
                domain: [0, 1],
                title: {text: 'δH (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'x3'
            }
        };

        // Render all subplots in one plot
        Plotly.newPlot(containerId, allTraces, layout, {
            responsive: true,
            displayModeBar: true,
            displaylogo: false
        });

        console.log('2D projections rendered successfully with subplots');
    }

    async exportGraphsAsZip() {
        try {
            if (!this.currentExperiment) {
                this.showNotification('No experiment available to export', 'error');
                return;
            }

            const sampleNameInput = document.querySelector('#sample-name');
            const sampleName = sampleNameInput ? sampleNameInput.value.trim() : 'sample';

            this.showNotification('Generating graphs package...', 'info');

            // Call backend API to generate ZIP
            const response = await fetch(`/api/hsp-experimental/experiments/${this.currentExperiment}/export-graphs`);

            if (!response.ok) {
                const error = await response.json();
                this.showNotification(`Export failed: ${error.detail}`, 'error');
                return;
            }

            // Download the ZIP file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Generate filename with sample name and date
            const date = new Date().toISOString().split('T')[0];
            a.download = `${sampleName}_hansen_${date}.zip`;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showNotification('Graphs exported successfully', 'success');

        } catch (error) {
            console.error('Error exporting graphs:', error);
            this.showNotification('Failed to export graphs', 'error');
        }
    }

    showNotification(message, type = 'info') {
        Notification.show(message, type);
    }

    showCalculationSettings() {
        // Populate current settings
        const lossFunctionSelect = document.getElementById('loss-function-select');
        const sizeFactorInput = document.getElementById('size-factor-input');

        if (lossFunctionSelect) {
            lossFunctionSelect.value = this.calculationSettings.loss_function;
        }
        if (sizeFactorInput) {
            sizeFactorInput.value = this.calculationSettings.size_factor;
        }

        // Show modal
        const modal = document.getElementById('calculation-settings-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    saveCalculationSettings() {
        const lossFunctionSelect = document.getElementById('loss-function-select');
        const sizeFactorInput = document.getElementById('size-factor-input');

        if (lossFunctionSelect) {
            this.calculationSettings.loss_function = lossFunctionSelect.value;
        }
        if (sizeFactorInput) {
            const sizeFactor = parseFloat(sizeFactorInput.value);
            this.calculationSettings.size_factor = isNaN(sizeFactor) ? 0.0 : sizeFactor;
        }

        // Save to localStorage for persistence
        localStorage.setItem('hsp_calculation_settings', JSON.stringify(this.calculationSettings));

        // Hide modal
        const modal = document.getElementById('calculation-settings-modal');
        if (modal) {
            modal.style.display = 'none';
        }

        this.showNotification(
            `Settings saved: ${this.calculationSettings.loss_function}, size_factor=${this.calculationSettings.size_factor}`,
            'success'
        );

        console.log('Calculation settings updated:', this.calculationSettings);
    }

    loadCalculationSettings() {
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('hsp_calculation_settings');
        if (savedSettings) {
            try {
                this.calculationSettings = JSON.parse(savedSettings);
                console.log('Loaded calculation settings:', this.calculationSettings);
            } catch (error) {
                console.error('Failed to load calculation settings:', error);
            }
        }
    }

    hasUnsavedChanges() {
        // Check if there's any data that might not be saved
        const sampleName = document.querySelector('#sample-name');
        const hasSampleName = sampleName && sampleName.value.trim() !== '';
        const hasSolventData = this.solventTests && this.solventTests.length > 0;

        return hasSampleName || hasSolventData;
    }

    startNewExperiment() {
        // Check if there are unsaved changes
        if (this.hasUnsavedChanges()) {
            const confirmMessage = 'You have unsaved data. Starting a new experiment will clear all current data.\n\nDo you want to continue?';
            if (!confirm(confirmMessage)) {
                return;
            }
        }

        // Clear all experiment data
        this.clearExperimentData();

        this.showNotification('New experiment started', 'success');
    }

    clearExperimentData() {
        // Clear sample name
        const sampleNameInput = document.querySelector('#sample-name');
        if (sampleNameInput) {
            sampleNameInput.value = '';
        }

        // Clear solvent tests array
        this.solventTests = [];

        // Clear current experiment reference
        this.currentExperiment = null;

        // Clear current calculation result
        this.currentCalculationResult = null;

        // Clear the table body
        const tableBody = document.querySelector('#solvent-table-body');
        if (tableBody) {
            tableBody.innerHTML = '';
        }

        // Clear visualization
        const vizContainer = document.querySelector('#hsp-visualization');
        if (vizContainer) {
            vizContainer.innerHTML = '<div class="empty-state"><p>No visualization data available. Run calculation to generate visualization.</p></div>';
        }

        // Clear results panel
        const resultsPanel = document.querySelector('#results-panel');
        if (resultsPanel) {
            resultsPanel.style.display = 'none';
        }

        // Disable buttons that require data
        const saveResultBtn = document.querySelector('#save-result-btn');
        if (saveResultBtn) {
            saveResultBtn.disabled = true;
        }

        const exportPackageBtn = document.querySelector('#export-package-btn');
        if (exportPackageBtn) {
            exportPackageBtn.disabled = true;
        }

        // Clear solvent set selector
        const setSelector = document.querySelector('#solvent-set-selector');
        if (setSelector) {
            setSelector.value = '';
        }

        const setNameInput = document.querySelector('#new-set-name');
        if (setNameInput) {
            setNameInput.value = '';
        }

        // Add one empty row to start fresh
        this.addSolventRow(false);

        // Update button states
        this.updateAnalyzeButtonState();

        console.log('Experiment data cleared - ready for new experiment');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('[HSP Experimental] DOMContentLoaded event fired');
    if (document.getElementById('hsp-experimental')) {
        console.log('[HSP Experimental] #hsp-experimental element found, creating instance');
        // Note: window.hspExperimental will be set by init() after async initialization completes
        new HSPExperimental();
    } else {
        console.log('[HSP Experimental] #hsp-experimental element not found');
    }
});
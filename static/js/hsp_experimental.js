// HSP Experimental functionality

class HSPExperimental {
    constructor() {
        this.currentExperiment = null;
        this.solventTests = [];
        this.availableSolvents = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadAvailableSolvents();
        this.initializeSolventTable();

        // Check for solvent set to load from session storage
        this.checkForSolventSetToLoad();
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

        // Set up data change listeners
        this.setupDataChangeListeners();

        // Make this instance globally available for solvent set manager
        window.hspExperimental = this;
    }

    setupDataChangeListeners() {
        // Listen for changes in table data
        document.addEventListener('input', (e) => {
            if (e.target.closest('.solvent-table')) {
                console.log('Data changed (input):', e.target.tagName, e.target.type, e.target.value);
                this.resetCalculationResults();
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.closest('.solvent-table')) {
                console.log('Data changed (change):', e.target.tagName, e.target.type, e.target.value);
                this.resetCalculationResults();
            }
        });
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
        }
        const exportResultBtn = document.querySelector('#export-result-btn');
        if (exportResultBtn) {
            exportResultBtn.disabled = true;
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
        try {
            const response = await fetch('/api/hsp-experimental/solvents');
            if (response.ok) {
                this.availableSolvents = await response.json();
                this.updateSolventDropdowns();
            } else {
                console.error('Failed to load available solvents');
            }
        } catch (error) {
            console.error('Error loading solvents:', error);
        }
    }

    initializeSolventTable() {
        const tableContainer = document.querySelector('#solvent-table-container');
        if (!tableContainer) return;

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
                </div>
            </div>
            <div class="table-wrapper" id="table-wrapper">
                <table class="solvent-table" id="solvent-table">
                    <thead>
                        <tr>
                            <th>Solvent Name</th>
                            <th>&delta;D (MPa<sup>0.5</sup>)</th>
                            <th>&delta;P (MPa<sup>0.5</sup>)</th>
                            <th>&delta;H (MPa<sup>0.5</sup>)</th>
                            <th>Solubility</th>
                            <th>Notes</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="solvent-table-body">
                        <!-- Rows will be added dynamically -->
                    </tbody>
                </table>
            </div>
            <div class="table-footer">
                <button id="add-solvent-btn" class="btn btn-secondary">Add Solvent</button>
            </div>
        `;

        // Re-attach event listener for add button
        const addBtn = document.querySelector('#add-solvent-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addSolventRow());
        }

        // Add initial row
        this.addSolventRow();

        // Dispatch event to notify other components that the table is ready
        document.dispatchEvent(new CustomEvent('hspExperimentalReady'));
        console.log('HSP Experimental table initialized and ready');
    }

    addSolventRow() {
        const tableBody = document.querySelector('#solvent-table-body');
        if (!tableBody) return;

        const rowId = `solvent-row-${Date.now()}`;
        const row = document.createElement('tr');
        row.id = rowId;

        row.innerHTML = `
            <td>
                <div class="solvent-input-container">
                    <input type="text"
                           class="solvent-name-input"
                           placeholder="Enter solvent name"
                           list="solvent-datalist">
                    <datalist id="solvent-datalist">
                        ${this.availableSolvents.map(name =>
                            `<option value="${name}">`
                        ).join('')}
                    </datalist>
                </div>
            </td>
            <td>
                <input type="number"
                       class="hsp-input delta-d"
                       placeholder="δD"
                       step="0.1"
                       min="0"
                       readonly>
            </td>
            <td>
                <input type="number"
                       class="hsp-input delta-p"
                       placeholder="δP"
                       step="0.1"
                       min="0"
                       readonly>
            </td>
            <td>
                <input type="number"
                       class="hsp-input delta-h"
                       placeholder="δH"
                       step="0.1"
                       min="0"
                       readonly>
            </td>
            <td>
                <div class="solubility-input-group">
                    <select class="solubility-select" required>
                        <option value="">Choose solubility level</option>
                        <option value="soluble">Soluble (1.0)</option>
                        <option value="partial">Partial (0.5)</option>
                        <option value="insoluble">Insoluble (0.0)</option>
                        <option value="custom">Custom...</option>
                    </select>
                    <input type="number"
                           class="custom-solubility-input"
                           min="0"
                           max="1"
                           step="0.1"
                           placeholder="0.0-1.0"
                           style="display: none;">
                </div>
            </td>
            <td>
                <input type="text"
                       class="notes-input"
                       placeholder="Notes">
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-small btn-secondary mode-btn"
                            title="Toggle input mode">Auto</button>
                    <button class="btn-small btn-danger remove-btn"
                            title="Remove row">×</button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);

        // Auto-scroll to the new row
        setTimeout(() => {
            const tableWrapper = document.querySelector('#table-wrapper');
            if (tableWrapper) {
                row.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }, 100);

        // Set initial mode to auto
        this.setRowMode(row, 'auto');

        // Add event listeners for this row
        this.setupRowEventListeners(row);
    }

    setupRowEventListeners(row) {
        // Solvent name input
        const nameInput = row.querySelector('.solvent-name-input');
        nameInput.addEventListener('input', (e) => this.onSolventNameChange(e, row));
        nameInput.addEventListener('blur', (e) => this.onSolventNameBlur(e, row));

        // Solubility select dropdown
        const solubilitySelect = row.querySelector('.solubility-select');
        solubilitySelect.addEventListener('change', (e) => this.onSolubilitySelectChange(e, row));

        // Mode toggle button
        const modeBtn = row.querySelector('.mode-btn');
        modeBtn.addEventListener('click', () => this.toggleInputMode(row));

        // Remove button
        const removeBtn = row.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => this.removeSolventRow(row));

        // HSP inputs change listener
        const hspInputs = row.querySelectorAll('.hsp-input');
        hspInputs.forEach(input => {
            input.addEventListener('change', () => this.updateSolventTestData());
        });
    }

    onSolubilitySelectChange(event, row) {
        const selectValue = event.target.value;
        const customInput = row.querySelector('.custom-solubility-input');

        if (selectValue === 'custom') {
            // Show custom input field
            customInput.style.display = 'block';
            customInput.focus();
        } else {
            // Hide custom input field
            customInput.style.display = 'none';
            customInput.value = '';
        }

        this.updateSolventTestData();
    }

    async onSolventNameChange(event, row) {
        const solventName = event.target.value.trim();
        const currentMode = row.dataset.mode || 'auto';

        if (!solventName || currentMode === 'manual') return;

        // Only auto-lookup in auto mode
        try {
            const response = await fetch(`/api/hsp-experimental/solvents/${encodeURIComponent(solventName)}`);
            if (response.ok) {
                const solventData = await response.json();
                this.populateRowWithSolventData(row, solventData);
                // Stay in auto mode
            } else {
                // Solvent not found, clear values but stay in auto mode
                this.clearRowHSPValues(row);
            }
        } catch (error) {
            console.error('Error fetching solvent data:', error);
            this.clearRowHSPValues(row);
        }
    }

    onSolventNameBlur(event, row) {
        this.updateSolventTestData();
    }

    populateRowWithSolventData(row, solventData) {
        // Use !== undefined to handle zero values correctly
        row.querySelector('.delta-d').value = solventData.delta_d !== undefined ? solventData.delta_d : '';
        row.querySelector('.delta-p').value = solventData.delta_p !== undefined ? solventData.delta_p : '';
        row.querySelector('.delta-h').value = solventData.delta_h !== undefined ? solventData.delta_h : '';

        // Store solvent data in row for reference
        row.dataset.solventData = JSON.stringify(solventData);
    }

    clearRowHSPValues(row) {
        row.querySelector('.delta-d').value = '';
        row.querySelector('.delta-p').value = '';
        row.querySelector('.delta-h').value = '';
        delete row.dataset.solventData;
    }

    setRowMode(row, mode) {
        const hspInputs = row.querySelectorAll('.hsp-input');
        const nameInput = row.querySelector('.solvent-name-input');
        const modeBtn = row.querySelector('.mode-btn');

        if (mode === 'auto') {
            // Auto mode: database lookup enabled, HSP inputs readonly
            nameInput.disabled = false;
            nameInput.classList.remove('manual-mode');
            hspInputs.forEach(input => {
                input.readOnly = true;
                input.classList.remove('manual-entry');
            });
            modeBtn.textContent = 'Auto';
            modeBtn.classList.remove('active');
            modeBtn.title = 'Currently in auto mode - click to switch to manual';
        } else if (mode === 'manual') {
            // Manual mode: database lookup disabled, HSP inputs editable
            nameInput.disabled = true;
            nameInput.classList.add('manual-mode');
            hspInputs.forEach(input => {
                input.readOnly = false;
                input.classList.add('manual-entry');
            });
            modeBtn.textContent = 'Manual';
            modeBtn.classList.add('active');
            modeBtn.title = 'Currently in manual mode - click to switch to auto';
        }

        row.dataset.mode = mode;
    }

    toggleInputMode(row) {
        const currentMode = row.dataset.mode || 'auto';

        if (currentMode === 'auto') {
            // Switch to manual mode
            this.setRowMode(row, 'manual');
            this.clearRowHSPValues(row);
        } else {
            // Switch to auto mode
            this.setRowMode(row, 'auto');
            this.clearRowHSPValues(row);

            // Try to reload from database if solvent name exists
            const nameInput = row.querySelector('.solvent-name-input');
            if (nameInput.value.trim()) {
                this.onSolventNameChange({ target: nameInput }, row);
            }
        }
    }

    removeSolventRow(row) {
        row.remove();
        this.updateSolventTestData();
    }

    updateSolventTestData() {
        const rows = document.querySelectorAll('#solvent-table-body tr');
        this.solventTests = [];

        rows.forEach(row => {
            const nameInput = row.querySelector('.solvent-name-input');
            const deltaD = row.querySelector('.delta-d');
            const deltaP = row.querySelector('.delta-p');
            const deltaH = row.querySelector('.delta-h');
            const solubility = row.querySelector('.solubility-select');
            const notes = row.querySelector('.notes-input');

            const solventName = nameInput.value.trim();
            if (!solventName) return;

            // Get solubility value (either from dropdown or custom input)
            let solubilityValue;
            if (solubility.value === 'custom') {
                const customInput = row.querySelector('.custom-solubility-input');
                solubilityValue = parseFloat(customInput.value) || 0.5;
            } else {
                solubilityValue = solubility.value || 'insoluble';
            }

            const testData = {
                solvent_name: solventName,
                solubility: solubilityValue,
                notes: notes.value || null
            };

            // Add HSP values if available
            if (deltaD.value && deltaP.value && deltaH.value) {
                if (row.dataset.mode === 'manual') {
                    testData.manual_delta_d = parseFloat(deltaD.value);
                    testData.manual_delta_p = parseFloat(deltaP.value);
                    testData.manual_delta_h = parseFloat(deltaH.value);
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

            // Call the HSP calculation API
            const response = await fetch(`/api/hsp-experimental/experiments/${this.currentExperiment}/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
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
                    `✓ HSP calculation completed: δD=${result.delta_d.toFixed(1)}, δP=${result.delta_p.toFixed(1)}, δH=${result.delta_h.toFixed(1)}`,
                    'success'
                );

                // Clear calculation status after successful completion
                const statusDiv = document.querySelector('#calculation-status');
                statusDiv.style.display = 'none';

            } else {
                const error = await response.json();
                this.showNotification(`❌ HSP calculation failed: ${error.detail}`, 'error');
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
        document.getElementById('delta-d').textContent = result.delta_d.toFixed(1);
        document.getElementById('delta-p').textContent = result.delta_p.toFixed(1);
        document.getElementById('delta-h').textContent = result.delta_h.toFixed(1);
        document.getElementById('ra').textContent = result.radius.toFixed(1);
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

            // Remove existing event listener and add new one
            const newSaveResultBtn = saveResultBtn.cloneNode(true);
            saveResultBtn.parentNode.replaceChild(newSaveResultBtn, saveResultBtn);

            newSaveResultBtn.addEventListener('click', () => {
                this.saveExperimentalResult();
            });
        }

        // Enable export result button
        const exportResultBtn = document.querySelector('#export-result-btn');
        if (exportResultBtn) {
            exportResultBtn.disabled = false;

            // Remove existing event listener and add new one
            const newExportResultBtn = exportResultBtn.cloneNode(true);
            exportResultBtn.parentNode.replaceChild(newExportResultBtn, exportResultBtn);

            newExportResultBtn.addEventListener('click', () => {
                this.exportCurrentResult();
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

    loadExperimentalResultData(resultId) {
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

            // Clear existing data
            this.clearSolventTable();

            // Load sample name
            const sampleNameInput = document.querySelector('#sample-name');
            if (sampleNameInput) {
                sampleNameInput.value = result.sample_name;
            }

            // Load solvent data
            result.solvents.forEach(solventData => {
                this.addSolventRow();
                const rows = document.querySelectorAll('#solvent-table-body tr');
                const newRow = rows[rows.length - 1];
                this.populateRowWithExperimentalResultData(newRow, solventData);
            });

            // Display HSP results immediately
            this.displayHSPResults(result.hsp_result);
            this.showCalculationDetails(result.hsp_result);

            // Update visualization if available
            if (result.hsp_result && result.solvents.length > 0) {
                this.updateSolventTestData();
                this.generateVisualization();
            }

            this.showNotification(`Loaded experimental result: ${result.sample_name}`, 'success');

        } catch (error) {
            console.error('Error loading experimental result:', error);
            this.showNotification('Failed to load experimental result', 'error');
        }
    }

    populateRowWithExperimentalResultData(row, solventData) {
        try {
            // Set solvent name
            const nameInput = row.querySelector('.solvent-name-input');
            if (nameInput) {
                nameInput.value = solventData.solvent_name;
            }

            // Set mode and HSP values
            if (solventData.mode === 'manual' && solventData.manual_values) {
                // Manual mode
                const deltaD = row.querySelector('.delta-d');
                const deltaP = row.querySelector('.delta-p');
                const deltaH = row.querySelector('.delta-h');

                if (deltaD) deltaD.value = solventData.manual_values.delta_d;
                if (deltaP) deltaP.value = solventData.manual_values.delta_p;
                if (deltaH) deltaH.value = solventData.manual_values.delta_h;

                this.setRowMode(row, 'manual');
            } else {
                // Auto mode
                this.setRowMode(row, 'auto');
                // Trigger solvent name lookup for auto mode
                if (nameInput) {
                    this.onSolventNameChange({ target: nameInput }, row);
                }
            }

            // Set solubility
            const solubilitySelect = row.querySelector('.solubility-select');
            if (solubilitySelect && solventData.solubility) {
                if (typeof solventData.solubility === 'number') {
                    // Custom numerical value
                    solubilitySelect.value = 'custom';
                    const customInput = row.querySelector('.custom-solubility-input');
                    if (customInput) {
                        customInput.style.display = 'inline-block';
                        customInput.value = solventData.solubility;
                    }
                } else {
                    // Standard categorical value
                    solubilitySelect.value = solventData.solubility;
                }
            }

            // Set notes
            const notesInput = row.querySelector('.notes-input');
            if (notesInput && solventData.notes) {
                notesInput.value = solventData.notes;
            }

        } catch (error) {
            console.error('Error populating row with experimental result data:', error);
        }
    }

    clearSolventTable() {
        const tbody = document.querySelector('#solvent-table-body');
        if (tbody) {
            tbody.innerHTML = '';
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
                    <span class="hsp-item"><strong>δD:</strong> ${result.hsp_result.delta_d.toFixed(1)}</span>
                    <span class="hsp-item"><strong>δP:</strong> ${result.hsp_result.delta_p.toFixed(1)}</span>
                    <span class="hsp-item"><strong>δH:</strong> ${result.hsp_result.delta_h.toFixed(1)}</span>
                    <span class="hsp-item"><strong>Ra:</strong> ${result.hsp_result.radius.toFixed(1)}</span>
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
                this.displayPlotlyVisualization(data.plotly_config);

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
        datalists.forEach(datalist => {
            datalist.innerHTML = this.availableSolvents.map(name =>
                `<option value="${name}">`
            ).join('');
        });
    }

    showNotification(message, type = 'info') {
        Notification.show(message, type);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('hsp-experimental')) {
        window.hspExperimental = new HSPExperimental();
    }
});
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
                console.log('🔄 Data changed (input):', e.target.tagName, e.target.type, e.target.value);
                this.resetCalculationResults();
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.closest('.solvent-table')) {
                console.log('🔄 Data changed (change):', e.target.tagName, e.target.type, e.target.value);
                this.resetCalculationResults();
            }
        });
    }

    resetCalculationResults() {
        console.log('🔄 Resetting calculation results...');

        // Clear HSP values
        document.querySelector('#delta-d').textContent = '-';
        document.querySelector('#delta-p').textContent = '-';
        document.querySelector('#delta-h').textContent = '-';
        document.querySelector('#ra').textContent = '-';

        // Hide info button
        const infoBtn = document.querySelector('#details-info-btn');
        if (infoBtn) {
            infoBtn.style.display = 'none';
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
            console.log('✅ Hansen sphere visualization cleared');
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
                        <option value="">Select saved set...</option>
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
        console.log('📡 HSP Experimental table initialized and ready');
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
                        <option value="insoluble">Insoluble (0.0)</option>
                        <option value="partial">Partial (0.5)</option>
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
                    console.log('🔄 Experiment updated with latest table data');
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
                console.log(`✅ Experiment updated: ${result.message}`);
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
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showLoadDataModal() {
        // TODO: Implement load data modal
        this.showNotification('Load data functionality will be implemented', 'info');
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
        // Simple notification system
        console.log(`${type.toUpperCase()}: ${message}`);

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('hsp-experimental')) {
        window.hspExperimental = new HSPExperimental();
    }
});
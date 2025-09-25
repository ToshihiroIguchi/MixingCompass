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
                <select class="solubility-select" required>
                    <option value="">Choose solubility level</option>
                    <option value="soluble">Soluble</option>
                    <option value="insoluble">Insoluble</option>
                    <option value="partial">Partial</option>
                    <option value="unknown">Unknown</option>
                </select>
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
                            title="Remove row">Remove</button>
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

        // Solubility change listener
        const solubilitySelect = row.querySelector('.solubility-select');
        solubilitySelect.addEventListener('change', () => this.updateSolventTestData());
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

            const testData = {
                solvent_name: solventName,
                solubility: solubility.value || 'unknown',
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
            // Update solvent test data
            this.updateSolventTestData();

            // First, save the experiment if not already saved
            if (!this.currentExperiment) {
                await this.saveExperiment();
                if (!this.currentExperiment) {
                    this.showNotification('Please save the experiment first', 'error');
                    return;
                }
            }

            this.showNotification('Calculating HSP values...', 'info');

            // Call the HSP calculation API
            const response = await fetch(`/api/hsp-experimental/experiments/${this.currentExperiment}/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();

                // Show calculation results
                this.showCalculationResults(result);

                this.showNotification(
                    `HSP calculation completed: δD=${result.delta_d.toFixed(1)}, δP=${result.delta_p.toFixed(1)}, δH=${result.delta_h.toFixed(1)}`,
                    'success'
                );

                // Show calculation details
                this.showCalculationDetails(result);

                // Load Hansen sphere visualization
                setTimeout(() => {
                    this.loadHansenSphereVisualization();
                }, 500);

            } else {
                const error = await response.json();
                this.showNotification(`HSP calculation failed: ${error.detail}`, 'error');
            }

        } catch (error) {
            console.error('Error calculating HSP:', error);
            this.showNotification('Error calculating HSP values', 'error');
        }
    }

    showCalculationResults(result) {
        document.getElementById('delta-d').textContent = result.delta_d.toFixed(1);
        document.getElementById('delta-p').textContent = result.delta_p.toFixed(1);
        document.getElementById('delta-h').textContent = result.delta_h.toFixed(1);
        document.getElementById('ra').textContent = result.radius.toFixed(1);
    }

    showCalculationDetails(result) {
        // Create calculation details section if it doesn't exist
        let detailsSection = document.getElementById('calculation-details');
        if (!detailsSection) {
            detailsSection = document.createElement('div');
            detailsSection.id = 'calculation-details';
            detailsSection.className = 'calculation-details';

            const resultsSection = document.querySelector('.results-section');
            resultsSection.appendChild(detailsSection);
        }

        detailsSection.innerHTML = `
            <h4>Calculation Details</h4>
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
                    <label>Total d:</label>
                    <span>${Math.sqrt(result.delta_d**2 + result.delta_p**2 + result.delta_h**2).toFixed(1)}</span>
                </div>
            </div>
        `;

        // デフォルトで折りたたみ状態にする
        detailsSection.classList.add('collapsed');

        // クリックイベントを追加
        const h4Element = detailsSection.querySelector('h4');
        h4Element.addEventListener('click', () => {
            detailsSection.classList.toggle('collapsed');
        });
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
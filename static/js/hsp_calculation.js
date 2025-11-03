/**
 * HSP Calculation - Solvent Mixture Calculator
 */

class HSPCalculation {
    constructor() {
        this.components = [];
        this.componentIdCounter = 0;
        this.solventNames = [];
        this.solventDataCache = new Map();
        this.savedMixturesTable = null;
        this.currentCalculatedHSP = null;

        this.STORAGE_KEY = 'mixingcompass_saved_mixtures';
    }

    async init() {
        console.log('Initializing HSP Calculation...');

        // Load solvent names for autocomplete
        await this.loadSolventNames();

        // Setup event listeners
        this.setupEventListeners();

        // Load saved mixtures table
        this.loadSavedMixturesTable();

        console.log('HSP Calculation initialized');
    }

    async loadSolventNames() {
        try {
            // Use solvent search API to get solvent names
            const response = await fetch('/api/solvent-search/solvents');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.solventNames = data.solvents.map(s => s.name).sort();

            console.log(`Loaded ${this.solventNames.length} solvent names`);
        } catch (error) {
            console.error('Error loading solvent names:', error);
            Notification.error('Failed to load solvent database');
        }
    }

    setupEventListeners() {
        // Add component button
        document.getElementById('add-component-btn').addEventListener('click', () => {
            this.addComponent();
        });

        // Calculate button
        document.getElementById('calculate-mixture-btn').addEventListener('click', () => {
            this.calculateMixture();
        });

        // Save mixture button
        document.getElementById('save-mixture-btn').addEventListener('click', () => {
            this.saveMixture();
        });

        // Mixture name input
        document.getElementById('mixture-name').addEventListener('input', () => {
            this.validateInputs();
        });
    }

    addComponent() {
        const componentId = this.componentIdCounter++;
        const component = {
            id: componentId,
            solvent: '',
            volume: 0
        };

        this.components.push(component);
        this.renderComponents();
        this.validateInputs();
    }

    removeComponent(componentId) {
        this.components = this.components.filter(c => c.id !== componentId);
        this.renderComponents();
        this.validateInputs();
    }

    renderComponents() {
        const container = document.getElementById('mixture-components-container');

        if (this.components.length === 0) {
            container.innerHTML = '<div class="empty-state">Click "+ Add Solvent" to start creating a mixture</div>';
            return;
        }

        container.innerHTML = this.components.map(component => `
            <div class="component-row" data-component-id="${component.id}">
                <div class="component-solvent">
                    <input
                        type="text"
                        class="solvent-input"
                        placeholder="Enter solvent name"
                        value="${component.solvent}"
                        list="solvent-datalist"
                        data-component-id="${component.id}"
                    >
                </div>
                <div class="component-volume">
                    <input
                        type="number"
                        class="volume-input"
                        placeholder="0"
                        min="0"
                        max="100"
                        step="0.1"
                        value="${component.volume || ''}"
                        data-component-id="${component.id}"
                    >
                    <span class="volume-unit">%</span>
                </div>
                <button class="remove-component-btn" data-component-id="${component.id}" title="Remove">×</button>
            </div>
        `).join('');

        // Add datalist for autocomplete
        if (!document.getElementById('solvent-datalist')) {
            const datalist = document.createElement('datalist');
            datalist.id = 'solvent-datalist';
            datalist.innerHTML = this.solventNames.map(name =>
                `<option value="${name}"></option>`
            ).join('');
            container.appendChild(datalist);
        }

        // Attach event listeners to newly created elements
        container.querySelectorAll('.solvent-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const componentId = parseInt(e.target.dataset.componentId);
                const component = this.components.find(c => c.id === componentId);
                if (component) {
                    component.solvent = e.target.value;
                    this.validateInputs();
                }
            });
        });

        container.querySelectorAll('.volume-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const componentId = parseInt(e.target.dataset.componentId);
                const component = this.components.find(c => c.id === componentId);
                if (component) {
                    component.volume = parseFloat(e.target.value) || 0;
                    this.updateTotalVolume();
                    this.validateInputs();
                }
            });
        });

        container.querySelectorAll('.remove-component-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const componentId = parseInt(e.target.dataset.componentId);
                this.removeComponent(componentId);
            });
        });

        this.updateTotalVolume();
    }

    updateTotalVolume() {
        const total = this.components.reduce((sum, c) => sum + (c.volume || 0), 0);
        const totalElement = document.getElementById('total-volume');
        totalElement.textContent = `Total: ${total.toFixed(1)}%`;

        // Color code based on total
        if (Math.abs(total - 100) < 0.01) {
            totalElement.style.color = '#10b981'; // Green
        } else {
            totalElement.style.color = '#ef4444'; // Red
        }
    }

    validateInputs() {
        const mixtureName = document.getElementById('mixture-name').value.trim();
        const hasComponents = this.components.length > 0;
        const allSolventsValid = this.components.every(c => c.solvent.trim() !== '');
        const allVolumesValid = this.components.every(c => c.volume > 0);
        const totalVolume = this.components.reduce((sum, c) => sum + (c.volume || 0), 0);
        const totalIs100 = Math.abs(totalVolume - 100) < 0.01;

        const isValid = mixtureName && hasComponents && allSolventsValid &&
                       allVolumesValid && totalIs100;

        document.getElementById('calculate-mixture-btn').disabled = !isValid;
    }

    async calculateMixture() {
        try {
            // Fetch all solvents if not already cached
            if (this.solventDataCache.size === 0) {
                const response = await fetch('/api/solvent-search/solvents');
                if (!response.ok) {
                    throw new Error(`Failed to fetch solvent database`);
                }

                const data = await response.json();
                // Cache all solvents
                data.solvents.forEach(solvent => {
                    this.solventDataCache.set(solvent.name.toLowerCase(), {
                        name: solvent.name,
                        delta_d: parseFloat(solvent.delta_d),
                        delta_p: parseFloat(solvent.delta_p),
                        delta_h: parseFloat(solvent.delta_h)
                    });
                });
            }

            // Get HSP data for each component
            const solventDataList = this.components.map((component) => {
                const solventData = this.solventDataCache.get(component.solvent.toLowerCase());

                if (!solventData) {
                    throw new Error(`Solvent "${component.solvent}" not found in database`);
                }

                return solventData;
            });

            // Calculate volume-weighted average HSP
            let weightedDeltaD = 0;
            let weightedDeltaP = 0;
            let weightedDeltaH = 0;

            this.components.forEach((component, index) => {
                const fraction = component.volume / 100.0;
                const solventData = solventDataList[index];

                weightedDeltaD += solventData.delta_d * fraction;
                weightedDeltaP += solventData.delta_p * fraction;
                weightedDeltaH += solventData.delta_h * fraction;
            });

            // Store calculated HSP
            this.currentCalculatedHSP = {
                delta_d: weightedDeltaD,
                delta_p: weightedDeltaP,
                delta_h: weightedDeltaH
            };

            // Display results
            this.displayResults(this.currentCalculatedHSP);

            Notification.success('Mixture HSP calculated successfully');

        } catch (error) {
            console.error('Error calculating mixture:', error);
            Notification.error(`Calculation failed: ${error.message}`);
        }
    }

    displayResults(hsp) {
        document.getElementById('mixture-delta-d').textContent = hsp.delta_d.toFixed(1);
        document.getElementById('mixture-delta-p').textContent = hsp.delta_p.toFixed(1);
        document.getElementById('mixture-delta-h').textContent = hsp.delta_h.toFixed(1);

        // Show result section and save button
        document.getElementById('mixture-result-section').style.display = 'block';
    }

    saveMixture() {
        if (!this.currentCalculatedHSP) {
            Notification.error('Please calculate HSP first');
            return;
        }

        const mixtureName = document.getElementById('mixture-name').value.trim();
        if (!mixtureName) {
            Notification.error('Please enter a mixture name');
            return;
        }

        // Create mixture object
        const mixture = {
            id: Date.now(),
            name: mixtureName,
            components: this.components.map(c => ({
                solvent: c.solvent,
                volume: c.volume
            })),
            hsp: {
                delta_d: this.currentCalculatedHSP.delta_d,
                delta_p: this.currentCalculatedHSP.delta_p,
                delta_h: this.currentCalculatedHSP.delta_h
            },
            created_at: new Date().toISOString()
        };

        // Load existing mixtures
        const savedMixtures = Storage.get(this.STORAGE_KEY, []);

        // Check for duplicate names
        const existingIndex = savedMixtures.findIndex(m => m.name === mixtureName);
        if (existingIndex >= 0) {
            if (!confirm(`A mixture named "${mixtureName}" already exists. Overwrite?`)) {
                return;
            }
            // Replace existing
            savedMixtures[existingIndex] = mixture;
        } else {
            // Add new
            savedMixtures.push(mixture);
        }

        // Save to storage
        Storage.set(this.STORAGE_KEY, savedMixtures);

        // Reload table
        this.loadSavedMixturesTable();

        // Clear form
        this.clearForm();

        Notification.success(`Mixture "${mixtureName}" saved successfully`);
    }

    clearForm() {
        document.getElementById('mixture-name').value = '';
        this.components = [];
        this.componentIdCounter = 0;
        this.currentCalculatedHSP = null;
        this.renderComponents();
        document.getElementById('mixture-result-section').style.display = 'none';
        this.validateInputs();
    }

    loadSavedMixturesTable() {
        const savedMixtures = Storage.get(this.STORAGE_KEY, []);

        // Update count badge
        document.getElementById('saved-mixtures-count').textContent =
            `${savedMixtures.length} mixture${savedMixtures.length !== 1 ? 's' : ''}`;

        // Prepare data for Tabulator
        const tableData = savedMixtures.map(mixture => ({
            id: mixture.id,
            name: mixture.name,
            delta_d: mixture.hsp.delta_d,
            delta_p: mixture.hsp.delta_p,
            delta_h: mixture.hsp.delta_h,
            composition: mixture.components.map(c =>
                `${c.solvent} (${c.volume}%)`
            ).join(', '),
            components: mixture.components,
            created_at: mixture.created_at
        }));

        // Create or update Tabulator
        if (!this.savedMixturesTable) {
            this.savedMixturesTable = new Tabulator('#saved-mixtures-table', {
                data: tableData,
                layout: 'fitColumns',
                responsiveLayout: 'collapse',
                pagination: true,
                paginationSize: 10,
                paginationSizeSelector: [10, 20, 50],
                initialSort: [{column: 'name', dir: 'asc'}],
                columns: [
                    {
                        title: 'Name',
                        field: 'name',
                        minWidth: 150,
                        headerFilter: 'input',
                        headerFilterPlaceholder: 'Filter...'
                    },
                    {
                        title: 'δD',
                        field: 'delta_d',
                        width: 80,
                        formatter: (cell) => cell.getValue().toFixed(1),
                        sorter: 'number'
                    },
                    {
                        title: 'δP',
                        field: 'delta_p',
                        width: 80,
                        formatter: (cell) => cell.getValue().toFixed(1),
                        sorter: 'number'
                    },
                    {
                        title: 'δH',
                        field: 'delta_h',
                        width: 80,
                        formatter: (cell) => cell.getValue().toFixed(1),
                        sorter: 'number'
                    },
                    {
                        title: 'Composition',
                        field: 'composition',
                        minWidth: 300,
                        tooltip: true
                    },
                    {
                        title: 'Actions',
                        field: 'actions',
                        width: 100,
                        hozAlign: 'center',
                        headerSort: false,
                        formatter: () => {
                            return '<button class="action-btn delete-btn" title="Delete">Delete</button>';
                        },
                        cellClick: (e, cell) => {
                            if (e.target.classList.contains('delete-btn')) {
                                this.deleteMixture(cell.getRow().getData().id);
                            }
                        }
                    }
                ]
            });
        } else {
            this.savedMixturesTable.setData(tableData);
        }
    }

    deleteMixture(mixtureId) {
        const savedMixtures = Storage.get(this.STORAGE_KEY, []);
        const mixture = savedMixtures.find(m => m.id === mixtureId);

        if (!mixture) {
            Notification.error('Mixture not found');
            return;
        }

        if (!confirm(`Delete mixture "${mixture.name}"?`)) {
            return;
        }

        // Remove from storage
        const updatedMixtures = savedMixtures.filter(m => m.id !== mixtureId);
        Storage.set(this.STORAGE_KEY, updatedMixtures);

        // Reload table
        this.loadSavedMixturesTable();

        Notification.success(`Mixture "${mixture.name}" deleted`);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const hspCalculationSection = document.getElementById('hsp-calculation');
    if (hspCalculationSection) {
        window.hspCalculation = new HSPCalculation();
        window.hspCalculation.init();
    }
});

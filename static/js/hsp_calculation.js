/**
 * HSP Calculation - Solvent Mixture Calculator
 * Refactored to use shared SolventTableManager
 */

class HSPCalculation {
    constructor() {
        this.solventNames = [];
        this.solventDataCache = new Map();
        this.currentCalculatedHSP = null;
        this.table = null;

        this.STORAGE_KEY = 'mixingcompass_saved_mixtures';
    }

    async init() {
        console.log('Initializing HSP Calculation...');

        // Load solvent names for autocomplete
        await this.loadSolventNames();

        // Initialize table manager
        this.initializeTable();

        // Setup event listeners
        this.setupEventListeners();

        // Check if there's a mixture to load from session storage
        this.checkAndLoadMixture();

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

            // Cache solvent data for lookup
            data.solvents.forEach(solvent => {
                this.solventDataCache.set(solvent.name.toLowerCase(), {
                    name: solvent.name,
                    delta_d: parseFloat(solvent.delta_d),
                    delta_p: parseFloat(solvent.delta_p),
                    delta_h: parseFloat(solvent.delta_h),
                    source_url: solvent.source_url || null
                });
            });

            console.log(`Loaded ${this.solventNames.length} solvent names`);
        } catch (error) {
            console.error('Error loading solvent names:', error);
            Notification.error('Failed to load solvent database');
        }
    }

    initializeTable() {
        this.table = new SolventTableManager({
            containerId: 'mixture-components-container',
            datalistOptions: this.solventNames,
            datalistId: 'mixture-solvent-datalist',
            emptyMessage: 'Click "+ Add Solvent" to start creating a mixture',
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
                    label: 'δD',
                    type: 'readonly-hsp'
                },
                {
                    key: 'delta_p',
                    label: 'δP',
                    type: 'readonly-hsp'
                },
                {
                    key: 'delta_h',
                    label: 'δH',
                    type: 'readonly-hsp'
                },
                {
                    key: 'volume',
                    label: 'Volume Ratio',
                    type: 'number',
                    placeholder: '0',
                    min: 0,
                    step: 0.1,
                    defaultValue: 0
                },
                {
                    key: 'actions',
                    label: 'Actions',
                    type: 'actions'
                }
            ],
            onDataChange: () => {
                this.updateTotalRatio();
                this.validateInputs();
            },
            onSolventLookup: async (row, solventName) => {
                await this.lookupSolvent(row, solventName);
            },
            onRowRemove: () => {
                this.updateTotalRatio();
                this.validateInputs();
            }
        });

        this.table.render();
    }

    async lookupSolvent(row, solventName) {
        if (!solventName.trim()) {
            row.delta_d = null;
            row.delta_p = null;
            row.delta_h = null;
            row.source_url = null;
            return;
        }

        // Get HSP values for this solvent from cache
        const solventData = this.solventDataCache.get(solventName.toLowerCase());
        if (solventData) {
            row.delta_d = solventData.delta_d;
            row.delta_p = solventData.delta_p;
            row.delta_h = solventData.delta_h;
            row.source_url = solventData.source_url;
        } else {
            row.delta_d = null;
            row.delta_p = null;
            row.delta_h = null;
            row.source_url = null;
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
        this.table.addRow();
    }

    updateTotalRatio() {
        const components = this.table.getData();
        const total = components.reduce((sum, c) => sum + (c.volume || 0), 0);
        const totalElement = document.getElementById('total-volume');
        totalElement.textContent = `Total Ratio: ${total.toFixed(2)}`;
        totalElement.style.color = '#333'; // Remove color coding
    }

    validateInputs() {
        const mixtureName = document.getElementById('mixture-name').value.trim();
        const components = this.table.getData();
        const hasComponents = components.length > 0;
        const allSolventsValid = components.every(c => c.solvent.trim() !== '');
        const allVolumesValid = components.every(c => c.volume > 0);
        const allHSPValid = components.every(c =>
            c.delta_d !== null && c.delta_p !== null && c.delta_h !== null
        );

        const isValid = mixtureName && hasComponents && allSolventsValid &&
                       allVolumesValid && allHSPValid;

        document.getElementById('calculate-mixture-btn').disabled = !isValid;
    }

    async calculateMixture() {
        try {
            const components = this.table.getData();

            // Calculate total ratio for normalization
            const totalRatio = components.reduce((sum, c) => sum + c.volume, 0);

            if (totalRatio === 0) {
                throw new Error('Total volume ratio cannot be zero');
            }

            // Calculate volume-weighted average HSP
            let weightedDeltaD = 0;
            let weightedDeltaP = 0;
            let weightedDeltaH = 0;

            components.forEach((component) => {
                // Normalize the fraction
                const fraction = component.volume / totalRatio;

                weightedDeltaD += component.delta_d * fraction;
                weightedDeltaP += component.delta_p * fraction;
                weightedDeltaH += component.delta_h * fraction;
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
        document.getElementById('mixture-delta-d').textContent = Utils.formatHSPValue(hsp.delta_d);
        document.getElementById('mixture-delta-p').textContent = Utils.formatHSPValue(hsp.delta_p);
        document.getElementById('mixture-delta-h').textContent = Utils.formatHSPValue(hsp.delta_h);

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

        const components = this.table.getData();

        // Create mixture object
        const mixture = {
            id: Date.now(),
            name: mixtureName,
            components: components.map(c => ({
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

        // Notify Data List to reload
        if (window.dataListManager) {
            window.dataListManager.loadSavedMixtures();
        }

        // Clear form
        this.clearForm();

        Notification.success(`Mixture "${mixtureName}" saved successfully. View it in the Data List tab.`);
    }

    clearForm() {
        document.getElementById('mixture-name').value = '';
        this.table.clear();
        this.currentCalculatedHSP = null;
        document.getElementById('mixture-result-section').style.display = 'none';
        this.validateInputs();
    }

    checkAndLoadMixture() {
        const mixtureId = sessionStorage.getItem('loadMixtureId');
        if (!mixtureId) {
            return;
        }

        // Clear the session storage
        sessionStorage.removeItem('loadMixtureId');

        // Load the mixture
        const savedMixtures = Storage.get(this.STORAGE_KEY, []);
        const mixture = savedMixtures.find(m => m.id === parseInt(mixtureId));

        if (!mixture) {
            Notification.error('Mixture not found');
            return;
        }

        // Load mixture name
        document.getElementById('mixture-name').value = mixture.name;

        // Load components using table manager
        const componentsData = mixture.components.map(comp => ({
            solvent: comp.solvent,
            volume: comp.volume,
            delta_d: null,
            delta_p: null,
            delta_h: null,
            source_url: null
        }));

        this.table.setData(componentsData);

        // Update HSP values for all components
        const tableData = this.table.getData();
        tableData.forEach(async (row) => {
            if (row.solvent) {
                await this.lookupSolvent(row, row.solvent);
            }
        });

        // Trigger re-render after async lookups
        setTimeout(() => {
            this.table.render();
            this.validateInputs();
        }, 500);

        Notification.success(`Loaded mixture: ${mixture.name}`);
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

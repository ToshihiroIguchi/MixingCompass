/**
 * HSP Calculation - Solvent Mixture Calculator
 * Refactored to use shared SolventTableManager
 */

class HSPCalculation {
    constructor() {
        this.solventNames = [];
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
            // Use shared solvent cache
            await window.sharedSolventCache.ensureLoaded();
            this.solventNames = window.sharedSolventCache.getNames();

            console.log(`[HSP Calculation] Using shared cache with ${this.solventNames.length} solvents`);
        } catch (error) {
            console.error('[HSP Calculation] Error loading solvent names:', error);
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
                    key: 'volume',
                    label: 'Volume Ratio',
                    type: 'number',
                    placeholder: '0',
                    min: 0,
                    step: 'any',
                    defaultValue: 0
                },
                {
                    key: 'actions',
                    label: 'Actions',
                    type: 'actions-with-mode'
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

        // Add initial row for better UX
        this.table.addRow();
    }

    async lookupSolvent(row, solventName) {
        if (!solventName.trim()) {
            this.table.updateRow(row.id, {
                delta_d: null,
                delta_p: null,
                delta_h: null,
                source_url: null
            });
            return;
        }

        // Only auto-lookup in auto mode
        const currentMode = row.mode || 'auto';
        if (currentMode === 'manual') {
            // In manual mode, don't lookup - allow arbitrary solvent names
            return;
        }

        // Get solvent data from shared cache
        const solventData = window.sharedSolventCache.get(solventName);

        if (solventData) {
            this.table.updateRow(row.id, {
                delta_d: solventData.delta_d,
                delta_p: solventData.delta_p,
                delta_h: solventData.delta_h,
                source_url: solventData.source_url
            });
        } else {
            // Clear HSP values if solvent doesn't exist in cache
            this.table.updateRow(row.id, {
                delta_d: null,
                delta_p: null,
                delta_h: null,
                source_url: null
            });
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

        // Reload shared solvent cache to make saved mixture available in dropdowns
        if (window.sharedSolventCache) {
            window.sharedSolventCache.reload();
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

    async checkAndLoadMixture() {
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

        // Load components with HSP values pre-fetched
        const componentsData = mixture.components.map(comp => {
            const solventData = window.sharedSolventCache.get(comp.solvent);
            return {
                solvent: comp.solvent,
                volume: comp.volume,
                delta_d: solventData?.delta_d || null,
                delta_p: solventData?.delta_p || null,
                delta_h: solventData?.delta_h || null,
                source_url: solventData?.source_url || null
            };
        });

        // Set data and render
        this.table.setData(componentsData);
        this.validateInputs();

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

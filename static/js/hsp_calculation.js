/**
 * HSP Calculation - Solvent Mixture Calculator
 */

class HSPCalculation {
    constructor() {
        this.components = [];
        this.componentIdCounter = 0;
        this.solventNames = [];
        this.solventDataCache = new Map();
        this.currentCalculatedHSP = null;

        this.STORAGE_KEY = 'mixingcompass_saved_mixtures';
    }

    async init() {
        console.log('Initializing HSP Calculation...');

        // Load solvent names for autocomplete
        await this.loadSolventNames();

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
            volume: 0,
            delta_d: null,
            delta_p: null,
            delta_h: null,
            source_url: null
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

        // Create datalist options HTML (same for all rows)
        const datalistOptionsHTML = this.solventNames.map(name =>
            `<option value="${name}">`
        ).join('');

        // Create table structure
        const tableHTML = `
            <div class="mixture-table-wrapper">
                <table class="mixture-table">
                    <thead>
                        <tr>
                            <th>Solvent</th>
                            <th>δD</th>
                            <th>δP</th>
                            <th>δH</th>
                            <th>Volume Ratio</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.components.map(component => `
                            <tr data-component-id="${component.id}">
                                <td class="solvent-cell">
                                    <div class="solvent-input-container ${component.delta_d === null && component.solvent ? 'solvent-not-found' : ''}">
                                        <input
                                            type="text"
                                            class="solvent-input"
                                            placeholder="Enter solvent name"
                                            value="${component.solvent}"
                                            list="mixture-solvent-datalist"
                                            data-component-id="${component.id}"
                                        >
                                        <datalist id="mixture-solvent-datalist">
                                            ${datalistOptionsHTML}
                                        </datalist>
                                        ${component.delta_d === null && component.solvent ?
                                            '<span class="error-icon" title="Solvent not found in database">⚠️</span>' : ''}
                                        ${component.source_url ?
                                            `<a href="${component.source_url}" class="ref-link" title="View source" target="_blank" rel="noopener noreferrer">🔗</a>` : ''}
                                    </div>
                                </td>
                                <td class="hsp-value">${component.delta_d !== null ? component.delta_d.toFixed(1) : '-'}</td>
                                <td class="hsp-value">${component.delta_p !== null ? component.delta_p.toFixed(1) : '-'}</td>
                                <td class="hsp-value">${component.delta_h !== null ? component.delta_h.toFixed(1) : '-'}</td>
                                <td class="ratio-cell">
                                    <input
                                        type="number"
                                        class="volume-input"
                                        placeholder="0"
                                        min="0"
                                        step="0.1"
                                        value="${component.volume || ''}"
                                        data-component-id="${component.id}"
                                    >
                                </td>
                                <td class="action-cell">
                                    <button class="remove-component-btn" data-component-id="${component.id}" title="Remove">×</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHTML;

        // Attach event listeners to newly created elements
        container.querySelectorAll('.solvent-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const componentId = parseInt(e.target.dataset.componentId);
                const component = this.components.find(c => c.id === componentId);
                if (component) {
                    component.solvent = e.target.value;
                    // Don't call updateComponentHSP here - it causes re-render and breaks datalist dropdown
                    this.validateInputs();
                }
            });

            input.addEventListener('blur', (e) => {
                const componentId = parseInt(e.target.dataset.componentId);
                const component = this.components.find(c => c.id === componentId);
                if (component) {
                    this.updateComponentHSP(component);
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
                    this.updateTotalRatio();
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

        this.updateTotalRatio();
    }

    async updateComponentHSP(component) {
        if (!component.solvent.trim()) {
            component.delta_d = null;
            component.delta_p = null;
            component.delta_h = null;
            this.renderComponents();
            return;
        }

        // Fetch all solvents if not already cached
        if (this.solventDataCache.size === 0) {
            try {
                const response = await fetch('/api/solvent-search/solvents');
                if (response.ok) {
                    const data = await response.json();
                    data.solvents.forEach(solvent => {
                        this.solventDataCache.set(solvent.name.toLowerCase(), {
                            name: solvent.name,
                            delta_d: parseFloat(solvent.delta_d),
                            delta_p: parseFloat(solvent.delta_p),
                            delta_h: parseFloat(solvent.delta_h),
                            source_url: solvent.source_url || null
                        });
                    });
                }
            } catch (error) {
                console.error('Error fetching solvent database:', error);
            }
        }

        // Get HSP values for this solvent
        const solventData = this.solventDataCache.get(component.solvent.toLowerCase());
        if (solventData) {
            component.delta_d = solventData.delta_d;
            component.delta_p = solventData.delta_p;
            component.delta_h = solventData.delta_h;
            component.source_url = solventData.source_url;
            this.renderComponents();
        } else {
            component.delta_d = null;
            component.delta_p = null;
            component.delta_h = null;
            component.source_url = null;
            this.renderComponents();
        }
    }

    updateTotalRatio() {
        const total = this.components.reduce((sum, c) => sum + (c.volume || 0), 0);
        const totalElement = document.getElementById('total-volume');
        totalElement.textContent = `Total Ratio: ${total.toFixed(2)}`;
        totalElement.style.color = '#333'; // Remove color coding
    }

    validateInputs() {
        const mixtureName = document.getElementById('mixture-name').value.trim();
        const hasComponents = this.components.length > 0;
        const allSolventsValid = this.components.every(c => c.solvent.trim() !== '');
        const allVolumesValid = this.components.every(c => c.volume > 0);
        const allHSPValid = this.components.every(c =>
            c.delta_d !== null && c.delta_p !== null && c.delta_h !== null
        );

        const isValid = mixtureName && hasComponents && allSolventsValid &&
                       allVolumesValid && allHSPValid;

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

            // Calculate total ratio for normalization
            const totalRatio = this.components.reduce((sum, c) => sum + c.volume, 0);

            if (totalRatio === 0) {
                throw new Error('Total volume ratio cannot be zero');
            }

            // Calculate volume-weighted average HSP
            let weightedDeltaD = 0;
            let weightedDeltaP = 0;
            let weightedDeltaH = 0;

            this.components.forEach((component) => {
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
        this.components = [];
        this.componentIdCounter = 0;
        this.currentCalculatedHSP = null;
        this.renderComponents();
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

        // Load components
        this.components = [];
        this.componentIdCounter = 0;

        mixture.components.forEach((comp) => {
            const component = {
                id: this.componentIdCounter++,
                solvent: comp.solvent,
                volume: comp.volume,
                delta_d: null,
                delta_p: null,
                delta_h: null,
                source_url: null
            };
            this.components.push(component);
        });

        // Render components (will fetch HSP values)
        this.renderComponents();

        // Update HSP values for all components
        this.components.forEach(component => {
            this.updateComponentHSP(component);
        });

        // Validate inputs
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

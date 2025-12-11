/**
 * HSP Calculation - Solvent Mixture Calculator
 * Refactored to use shared SolventTableManager
 * Extended with mixture optimization feature
 */

class HSPCalculation {
    constructor() {
        this.solventNames = [];
        this.currentCalculatedHSP = null;
        this.table = null;
        this.currentMode = 'calculate'; // 'calculate' or 'optimize'
        this.optimizeTargetSource = 'polymer'; // 'polymer', 'solvent', or 'custom'
        this.lastOptimizeResult = null;
        this.lastOptimizeTarget = null; // Store target HSP for export

        this.STORAGE_KEY = 'mixingcompass_saved_mixtures';
    }

    async init() {
        console.log('Initializing HSP Calculation...');

        // Load solvent names for autocomplete
        await this.loadSolventNames();

        // Load polymer data using shared cache
        await window.sharedPolymerCache.ensureLoaded();

        // Initialize table manager
        this.initializeTable();

        // Setup event listeners
        this.setupEventListeners();

        // Initialize optimize target content
        this.updateOptimizeTargetContent('polymer');

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
                this.validateCurrentMode();
            },
            onSolventLookup: async (row, solventName) => {
                await this.lookupSolvent(row, solventName);
            },
            onRowRemove: () => {
                this.updateTotalRatio();
                this.validateCurrentMode();
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

        // Mode toggle buttons
        const modeToggle = document.getElementById('mix-mode-toggle');
        if (modeToggle) {
            modeToggle.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    modeToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.switchMode(e.target.dataset.mode);
                });
            });
        }

        // Optimize source toggle buttons
        const sourceToggle = document.getElementById('optimize-source-toggle');
        if (sourceToggle) {
            sourceToggle.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    sourceToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.optimizeTargetSource = e.target.dataset.source;
                    this.updateOptimizeTargetContent(e.target.dataset.source);
                    this.validateOptimizeInputs();
                });
            });
        }

        // Optimize button
        const optimizeBtn = document.getElementById('optimize-mixture-btn');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', () => {
                this.optimizeMixture();
            });
        }

        // Save optimized mixture button (reuse saveMixture with prompt for name)
        const saveOptBtn = document.getElementById('save-optimized-mixture-btn');
        if (saveOptBtn) {
            saveOptBtn.addEventListener('click', () => {
                this.saveOptimizedMixture();
            });
        }

        // Export mixture package buttons
        const exportMixtureBtn = document.getElementById('export-mixture-package-btn');
        if (exportMixtureBtn) {
            exportMixtureBtn.addEventListener('click', () => {
                this.exportMixturePackage();
            });
        }

        const exportOptMixtureBtn = document.getElementById('export-optimized-mixture-package-btn');
        if (exportOptMixtureBtn) {
            exportOptMixtureBtn.addEventListener('click', () => {
                this.exportOptimizedMixturePackage();
            });
        }

        // Copy mixture buttons
        const copyMixtureBtn = document.getElementById('copy-mixture-btn');
        if (copyMixtureBtn) {
            copyMixtureBtn.addEventListener('click', () => {
                this.copyMixtureData();
            });
        }

        const copyOptMixtureBtn = document.getElementById('copy-optimized-mixture-btn');
        if (copyOptMixtureBtn) {
            copyOptMixtureBtn.addEventListener('click', () => {
                this.copyOptimizedMixtureData();
            });
        }
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

    validateCurrentMode() {
        if (this.currentMode === 'calculate') {
            this.validateInputs();
        } else {
            this.validateOptimizeInputs();
        }
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

        // Show result section and buttons
        document.getElementById('mixture-result-section').style.display = 'block';

        // Show export button
        const exportBtn = document.getElementById('export-mixture-package-btn');
        if (exportBtn) {
            exportBtn.style.display = 'inline-block';
        }

        // Show copy button
        const copyBtn = document.getElementById('copy-mixture-btn');
        if (copyBtn) {
            copyBtn.style.display = '';
        }
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

        this.saveMixtureToStorage(mixtureName, this.currentCalculatedHSP);
        this.clearForm();
    }

    saveOptimizedMixture() {
        if (!this.lastOptimizeResult) {
            Notification.error('Please run optimization first');
            return;
        }

        const mixtureName = prompt('Enter mixture name:');
        if (!mixtureName || !mixtureName.trim()) {
            return;
        }

        const hsp = {
            delta_d: this.lastOptimizeResult.mixture_hsp.delta_d,
            delta_p: this.lastOptimizeResult.mixture_hsp.delta_p,
            delta_h: this.lastOptimizeResult.mixture_hsp.delta_h
        };

        this.saveMixtureToStorage(mixtureName.trim(), hsp);
    }

    saveMixtureToStorage(mixtureName, hsp) {
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
                delta_d: hsp.delta_d,
                delta_p: hsp.delta_p,
                delta_h: hsp.delta_h
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

        // Dispatch event for data list manager
        window.dispatchEvent(new CustomEvent('savedMixturesUpdated'));

        // Reload shared solvent cache to make saved mixture available in dropdowns
        if (window.sharedSolventCache) {
            window.sharedSolventCache.reload();
        }

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

    // ========== Optimize Mode Methods ==========

    switchMode(mode) {
        this.currentMode = mode;

        const mixtureName = document.getElementById('mixture-name-section');
        const optimizeTarget = document.getElementById('optimize-target-section');
        const calculateActions = document.getElementById('calculate-actions');
        const optimizeActions = document.getElementById('optimize-actions');
        const calculateResults = document.getElementById('mixture-result-section');
        const optimizeResults = document.getElementById('optimize-result-section');
        const totalVolume = document.getElementById('total-volume');

        if (mode === 'calculate') {
            mixtureName.style.display = 'flex';
            optimizeTarget.style.display = 'none';
            calculateActions.style.display = 'block';
            optimizeActions.style.display = 'none';
            optimizeResults.style.display = 'none';
            totalVolume.style.display = 'inline';
            this.validateInputs();
        } else {
            mixtureName.style.display = 'none';
            optimizeTarget.style.display = 'block';
            calculateActions.style.display = 'none';
            optimizeActions.style.display = 'block';
            calculateResults.style.display = 'none';
            totalVolume.style.display = 'none';
            this.validateOptimizeInputs();
        }
    }

    updateOptimizeTargetContent(source) {
        const contentDiv = document.getElementById('optimize-target-content');
        if (!contentDiv) return;

        switch (source) {
            case 'custom':
                contentDiv.innerHTML = HSPSelectorUtils.generateCustomHTML({
                    idPrefix: 'opt-target',
                    includeR0: false,
                    includeName: false
                });
                HSPSelectorUtils.attachCustomInputListeners(
                    'opt-target',
                    () => this.validateOptimizeInputs()
                );
                break;

            case 'polymer':
                const polymerNames = window.sharedPolymerCache.getNames();
                contentDiv.innerHTML = HSPSelectorUtils.generateSelectorHTML({
                    inputId: 'opt-target-polymer-input',
                    datalistId: 'opt-polymer-datalist',
                    displayId: 'opt-target-hsp-display',
                    placeholder: 'Type to search polymer...',
                    dataOptions: polymerNames,
                    includeR0: false,
                    displayIdPrefix: 'opt-display'
                });

                HSPSelectorUtils.attachDebouncedListener(
                    'opt-target-polymer-input',
                    () => this.updateOptimizeTargetDisplay(),
                    {
                        debounceDelay: 500,
                        onInput: () => this.validateOptimizeInputs()
                    }
                );
                break;

            case 'solvent':
                contentDiv.innerHTML = HSPSelectorUtils.generateSelectorHTML({
                    inputId: 'opt-target-solvent-input',
                    datalistId: 'opt-solvent-datalist',
                    displayId: 'opt-target-solvent-display',
                    placeholder: 'Type to search solvent...',
                    dataOptions: this.solventNames,
                    includeR0: false,
                    displayIdPrefix: 'opt-solvent'
                });

                HSPSelectorUtils.attachDebouncedListener(
                    'opt-target-solvent-input',
                    () => this.updateOptimizeSolventDisplay(),
                    {
                        debounceDelay: 300,
                        onInput: () => this.validateOptimizeInputs()
                    }
                );
                break;
        }
    }

    async updateOptimizeTargetDisplay() {
        await HSPSelectorUtils.updateHSPDisplay({
            inputId: 'opt-target-polymer-input',
            displayId: 'opt-target-hsp-display',
            mode: 'polymer',
            displayOptions: {
                includeR0: false,
                cellIdPrefix: 'opt-display'
            }
        });
    }

    async updateOptimizeSolventDisplay() {
        await HSPSelectorUtils.updateHSPDisplay({
            inputId: 'opt-target-solvent-input',
            displayId: 'opt-target-solvent-display',
            mode: 'solvent',
            displayOptions: {
                includeR0: false,
                cellIdPrefix: 'opt-solvent'
            }
        });
    }

    validateOptimizeInputs() {
        const optimizeBtn = document.getElementById('optimize-mixture-btn');
        if (!optimizeBtn) return;

        const components = this.table.getData();
        const hasEnoughComponents = components.length >= 2;
        const allSolventsValid = components.every(c => c.solvent.trim() !== '');
        const allHSPValid = components.every(c =>
            c.delta_d !== null && c.delta_p !== null && c.delta_h !== null
        );

        let targetValid = false;

        if (this.optimizeTargetSource === 'custom') {
            const deltaD = document.getElementById('opt-target-delta-d')?.value;
            const deltaP = document.getElementById('opt-target-delta-p')?.value;
            const deltaH = document.getElementById('opt-target-delta-h')?.value;
            targetValid = deltaD && deltaP && deltaH;
        } else if (this.optimizeTargetSource === 'polymer') {
            const polymerInput = document.getElementById('opt-target-polymer-input')?.value;
            targetValid = polymerInput && polymerInput.trim() !== '';
        } else if (this.optimizeTargetSource === 'solvent') {
            const solventInput = document.getElementById('opt-target-solvent-input')?.value;
            targetValid = solventInput && solventInput.trim() !== '';
        }

        const isValid = hasEnoughComponents && allSolventsValid && allHSPValid && targetValid;
        optimizeBtn.disabled = !isValid;
    }

    async getOptimizeTargetHSP() {
        if (this.optimizeTargetSource === 'custom') {
            return {
                delta_d: parseFloat(document.getElementById('opt-target-delta-d').value),
                delta_p: parseFloat(document.getElementById('opt-target-delta-p').value),
                delta_h: parseFloat(document.getElementById('opt-target-delta-h').value)
            };
        }

        if (this.optimizeTargetSource === 'polymer') {
            const polymerName = document.getElementById('opt-target-polymer-input')?.value.trim();
            if (!polymerName) return null;

            // Check experimental results
            const allResults = window.experimentalResultsManager ?
                window.experimentalResultsManager.getExperimentalResults() : [];
            const expResult = allResults.find(r => r.sample_name === polymerName);

            if (expResult) {
                return {
                    delta_d: expResult.hsp_result.delta_d,
                    delta_p: expResult.hsp_result.delta_p,
                    delta_h: expResult.hsp_result.delta_h
                };
            }

            // Fetch from polymer API
            try {
                const response = await fetch(`/api/polymer-data/polymer/${encodeURIComponent(polymerName)}`);
                if (response.ok) {
                    const data = await response.json();
                    return {
                        delta_d: data.delta_d,
                        delta_p: data.delta_p,
                        delta_h: data.delta_h
                    };
                }
            } catch (error) {
                console.error('Error fetching polymer HSP:', error);
            }
            return null;
        }

        if (this.optimizeTargetSource === 'solvent') {
            const solventName = document.getElementById('opt-target-solvent-input')?.value.trim();
            const solventData = window.sharedSolventCache.get(solventName);
            if (solventData) {
                return {
                    delta_d: solventData.delta_d,
                    delta_p: solventData.delta_p,
                    delta_h: solventData.delta_h
                };
            }
            return null;
        }

        return null;
    }

    async optimizeMixture() {
        try {
            const components = this.table.getData();
            const targetHSP = await this.getOptimizeTargetHSP();

            if (!targetHSP) {
                Notification.error('Failed to get target HSP values');
                return;
            }

            const requestBody = {
                solvents: components.map(c => ({
                    name: c.solvent,
                    delta_d: c.delta_d,
                    delta_p: c.delta_p,
                    delta_h: c.delta_h
                })),
                target_delta_d: targetHSP.delta_d,
                target_delta_p: targetHSP.delta_p,
                target_delta_h: targetHSP.delta_h,
                min_ratio: 0
            };

            const response = await fetch('/api/solvent-search/optimize-mixture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (!result.success) {
                Notification.error(result.error || 'Optimization failed');
                return;
            }

            this.lastOptimizeResult = result;
            this.lastOptimizeTarget = targetHSP; // Store target for export
            this.displayOptimizeResults(result);
            this.applyOptimalRatios(); // Auto-apply to table

        } catch (error) {
            console.error('Error optimizing mixture:', error);
            Notification.error(`Optimization failed: ${error.message}`);
        }
    }

    displayOptimizeResults(result) {
        document.getElementById('opt-mixture-delta-d').textContent = Utils.formatHSPValue(result.mixture_hsp.delta_d);
        document.getElementById('opt-mixture-delta-p').textContent = Utils.formatHSPValue(result.mixture_hsp.delta_p);
        document.getElementById('opt-mixture-delta-h').textContent = Utils.formatHSPValue(result.mixture_hsp.delta_h);
        document.getElementById('opt-ra').textContent = result.ra.toFixed(3);

        document.getElementById('optimize-result-section').style.display = 'block';

        // Show export button
        const exportBtn = document.getElementById('export-optimized-mixture-package-btn');
        if (exportBtn) {
            exportBtn.style.display = 'inline-block';
        }

        // Show copy button
        const copyBtn = document.getElementById('copy-optimized-mixture-btn');
        if (copyBtn) {
            copyBtn.style.display = '';
        }
    }

    applyOptimalRatios() {
        if (!this.lastOptimizeResult) {
            Notification.error('No optimization result to apply');
            return;
        }

        const currentData = this.table.getData();
        const optimizedSolvents = this.lastOptimizeResult.solvents;

        // Update volume ratios while keeping original order
        const updatedData = currentData.map(row => {
            const optimized = optimizedSolvents.find(s => s.name === row.solvent);
            if (optimized) {
                return {
                    ...row,
                    volume: optimized.ratio * 100 // Convert fraction to percentage-like ratio
                };
            }
            return row;
        });

        this.table.setData(updatedData);
        this.updateTotalRatio();
        Notification.success('Optimal ratios applied to table');
    }

    async exportMixturePackage() {
        if (!this.currentCalculatedHSP) {
            Notification.error('Please calculate mixture first');
            return;
        }

        const mixtureName = document.getElementById('mixture-name').value.trim() || 'Custom_Mixture';
        const components = this.table.getData();

        if (components.length === 0) {
            Notification.error('No components to export');
            return;
        }

        try {
            Notification.info('Generating package...');

            const exportData = {
                mixture_name: mixtureName,
                components: components.map(c => ({
                    solvent: c.solvent,
                    volume: c.volume || 0
                })),
                delta_d: this.currentCalculatedHSP.delta_d,
                delta_p: this.currentCalculatedHSP.delta_p,
                delta_h: this.currentCalculatedHSP.delta_h,
                mode: 'calculate'
            };

            const response = await fetch('/api/solvent-search/export-mixture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(exportData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Export failed');
            }

            // Download ZIP file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'mixture_package.zip';
            if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            Notification.success('Package exported successfully');

        } catch (error) {
            console.error('Export error:', error);
            Notification.error(error.message || 'Failed to export package');
        }
    }

    async exportOptimizedMixturePackage() {
        if (!this.lastOptimizeResult) {
            Notification.error('Please run optimization first');
            return;
        }

        const mixtureName = prompt('Enter mixture name:', 'Optimized_Mixture');
        if (!mixtureName || !mixtureName.trim()) {
            return;
        }

        const components = this.table.getData();

        if (components.length === 0) {
            Notification.error('No components to export');
            return;
        }

        try {
            Notification.info('Generating package...');

            const exportData = {
                mixture_name: mixtureName.trim(),
                components: components.map(c => ({
                    solvent: c.solvent,
                    volume: c.volume || 0
                })),
                delta_d: this.lastOptimizeResult.mixture_hsp.delta_d,
                delta_p: this.lastOptimizeResult.mixture_hsp.delta_p,
                delta_h: this.lastOptimizeResult.mixture_hsp.delta_h,
                mode: 'optimize',
                target_delta_d: this.lastOptimizeTarget.delta_d,
                target_delta_p: this.lastOptimizeTarget.delta_p,
                target_delta_h: this.lastOptimizeTarget.delta_h,
                ra: this.lastOptimizeResult.ra
            };

            const response = await fetch('/api/solvent-search/export-mixture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(exportData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Export failed');
            }

            // Download ZIP file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'mixture_package.zip';
            if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            Notification.success('Package exported successfully');

        } catch (error) {
            console.error('Export error:', error);
            Notification.error(error.message || 'Failed to export package');
        }
    }

    async copyMixtureData() {
        if (!this.currentCalculatedHSP) {
            Notification.error('Please calculate mixture first');
            return;
        }

        const mixtureName = document.getElementById('mixture-name').value.trim() || 'Mixture';
        const components = this.table.getData();

        try {
            // Create tab-separated data for Excel
            const header = 'Mixture Name\tδD\tδP\tδH';
            const dataRow = `${mixtureName}\t${this.currentCalculatedHSP.delta_d.toFixed(2)}\t${this.currentCalculatedHSP.delta_p.toFixed(2)}\t${this.currentCalculatedHSP.delta_h.toFixed(2)}`;

            let copyText = `${header}\n${dataRow}\n\n`;

            // Add composition
            copyText += 'Component\tVolume Ratio\n';
            components.forEach(c => {
                copyText += `${c.solvent}\t${c.volume || 0}\n`;
            });

            await navigator.clipboard.writeText(copyText);

            Notification.success('Mixture data copied to clipboard');

            // Visual feedback
            const copyBtn = document.getElementById('copy-mixture-btn');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            }

        } catch (error) {
            console.error('Copy error:', error);
            Notification.error('Failed to copy mixture data');
        }
    }

    async copyOptimizedMixtureData() {
        if (!this.lastOptimizeResult) {
            Notification.error('Please run optimization first');
            return;
        }

        const components = this.table.getData();

        try {
            // Create tab-separated data for Excel
            const header = 'Mixture δD\tMixture δP\tMixture δH\tRa (Distance)';
            const dataRow = `${this.lastOptimizeResult.mixture_hsp.delta_d.toFixed(2)}\t${this.lastOptimizeResult.mixture_hsp.delta_p.toFixed(2)}\t${this.lastOptimizeResult.mixture_hsp.delta_h.toFixed(2)}\t${this.lastOptimizeResult.ra.toFixed(3)}`;

            let copyText = `${header}\n${dataRow}\n\n`;

            // Add target HSP
            if (this.lastOptimizeTarget) {
                copyText += 'Target δD\tTarget δP\tTarget δH\n';
                copyText += `${this.lastOptimizeTarget.delta_d.toFixed(2)}\t${this.lastOptimizeTarget.delta_p.toFixed(2)}\t${this.lastOptimizeTarget.delta_h.toFixed(2)}\n\n`;
            }

            // Add composition
            copyText += 'Component\tVolume Ratio\n';
            components.forEach(c => {
                copyText += `${c.solvent}\t${c.volume || 0}\n`;
            });

            await navigator.clipboard.writeText(copyText);

            Notification.success('Mixture data copied to clipboard');

            // Visual feedback
            const copyBtn = document.getElementById('copy-optimized-mixture-btn');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            }

        } catch (error) {
            console.error('Copy error:', error);
            Notification.error('Failed to copy mixture data');
        }
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

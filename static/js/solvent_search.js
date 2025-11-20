/**
 * Solvent Search Module
 * Search for single solvents or solvent blends based on target HSP values
 */

// Min-Max Filter Editor for Tabulator (Vertical Layout)
function minMaxFilterEditor(cell, onRendered, success, cancel, editorParams) {
    const container = document.createElement("div");
    container.style.cssText = `
        display: flex !important;
        flex-direction: column !important;
        gap: 2px;
        width: 100%;
        min-height: 42px;
        height: auto;
    `;

    const minInput = document.createElement("input");
    minInput.setAttribute("type", "number");
    minInput.setAttribute("placeholder", "Min");
    minInput.style.cssText = `
        width: 100%;
        padding: 1px 2px;
        box-sizing: border-box;
        font-size: 0.65rem;
        height: 18px;
        margin: 0;
        display: block;
    `;

    const maxInput = document.createElement("input");
    maxInput.setAttribute("type", "number");
    maxInput.setAttribute("placeholder", "Max");
    maxInput.style.cssText = `
        width: 100%;
        padding: 1px 2px;
        box-sizing: border-box;
        font-size: 0.65rem;
        height: 18px;
        margin: 0;
        display: block;
    `;

    const buildValues = () => {
        return {
            start: minInput.value !== "" ? parseFloat(minInput.value) : null,
            end: maxInput.value !== "" ? parseFloat(maxInput.value) : null
        };
    };

    const update = () => {
        success(buildValues());
    };

    minInput.addEventListener("change", update);
    minInput.addEventListener("blur", update);
    maxInput.addEventListener("change", update);
    maxInput.addEventListener("blur", update);

    container.appendChild(minInput);
    container.appendChild(maxInput);

    return container;
}

// Min-Max Filter Function for Tabulator
function minMaxFilterFunction(headerValue, rowValue, rowData, filterParams) {
    if (!headerValue || (headerValue.start === null && headerValue.end === null)) {
        return true;
    }

    if (rowValue === null || rowValue === undefined || rowValue === 999) {
        return false;
    }

    if (headerValue.start !== null && headerValue.end !== null) {
        return rowValue >= headerValue.start && rowValue <= headerValue.end;
    }

    if (headerValue.start !== null) {
        return rowValue >= headerValue.start;
    }

    if (headerValue.end !== null) {
        return rowValue <= headerValue.end;
    }

    return true;
}

class SolventSearch {
    constructor() {
        this.searchResults = [];
        this.currentSort = 'distance';
        this.polymersData = [];
        this.experimentalResults = [];
        this.visualization = null;
        this.currentTarget1 = null;
        this.currentTarget2 = null;
        this.currentTarget3 = null;
        this.filteredResults = [];
        this.resultsTable = null; // Tabulator instance
        this.init();
    }

    async init() {
        // Initialize visualization module
        this.visualization = new HSPVisualization('search-plotly-visualization');
        this.visualization.showPlaceholder('Configure targets and search solvents to display visualization');

        // Load data before initializing UI
        await this.loadPolymersData();
        await this.loadExperimentalResults();

        this.setupEventListeners();
        this.setupPanelToggle(); // Setup panel collapse/expand
        this.updateTargetContent('target1', 'polymer'); // Initialize with polymer mode
        this.updateTargetContent('target2', 'polymer'); // Initialize with polymer mode
        this.updateTargetContent('target3', 'polymer'); // Initialize with polymer mode
        console.log('Solvent Search initialized');

        // Initialize Tabulator
        this.initializeResultsTable();

        // Log computed CSS styles for debugging
        this.logLayoutStyles();
    }

    logLayoutStyles() {
        const solventSection = document.querySelector('#solvent-search');
        const layout = document.querySelector('#solvent-search .split-layout');

        if (layout) {
            const computedStyle = window.getComputedStyle(layout);
            console.log('=== Split Layout CSS Debug ===');
            console.log('grid-template-columns:', computedStyle.gridTemplateColumns);
            console.log('display:', computedStyle.display);
            console.log('width:', computedStyle.width);
            console.log('gap:', computedStyle.gap);
            console.log('padding:', computedStyle.padding);

            // Check if there are any inline styles
            console.log('Inline style:', layout.getAttribute('style'));

            // Log screen width to check media query
            console.log('Screen width:', window.innerWidth);
            console.log('===========================');
        } else {
            console.warn('Split layout element not found');
        }
    }

    async loadPolymersData() {
        try {
            const response = await fetch('/api/polymer-data/polymer-names');
            if (response.ok) {
                this.polymersData = await response.json();
                console.log(`Loaded ${this.polymersData.length} polymer names`);
            } else {
                console.error('Failed to load polymer names');
                this.polymersData = [];
            }
        } catch (error) {
            console.error('Failed to load polymers data:', error);
            this.polymersData = [];
        }
    }

    async loadExperimentalResults() {
        try {
            // Wait for experimentalResultsManager to be initialized
            if (window.experimentalResultsManager) {
                const allResults = window.experimentalResultsManager.getExperimentalResults();
                // Extract unique solvent names from experimental results
                this.experimentalResults = allResults.map(result => result.sample_name);
                console.log(`Loaded ${this.experimentalResults.length} experimental result names`);
            } else {
                console.warn('ExperimentalResultsManager not yet initialized');
                this.experimentalResults = [];
            }
        } catch (error) {
            console.error('Failed to load experimental results:', error);
            this.experimentalResults = [];
        }
    }

    setupEventListeners() {
        // Target toggle buttons (common for both Target 1 and Target 2)
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const source = e.target.dataset.source;
                const target = e.target.dataset.target;

                // Update active state
                const parentToggle = e.target.closest('.source-toggle');
                parentToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Update content
                this.updateTargetContent(target, source);
                this.validateSearchButton();
            });
        });

        // Search button
        const searchBtn = document.querySelector('#search-solvents-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.performSearch());
        }

        // Sort selector
        const sortSelect = document.querySelector('#sort-results');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.sortAndDisplayResults();
            });
        }

        // Visualization tabs (3D/2D/RED switching)
        const tab3D = document.querySelector('#search-tab-3d');
        const tab2D = document.querySelector('#search-tab-2d');
        const tabRED = document.querySelector('#search-tab-red');

        if (tab3D) {
            tab3D.addEventListener('click', () => this.switchVisualizationTab('3d'));
        }
        if (tab2D) {
            tab2D.addEventListener('click', () => this.switchVisualizationTab('2d'));
        }
        if (tabRED) {
            tabRED.addEventListener('click', () => this.switchVisualizationTab('red'));
        }

        // CSV Export button
        const exportCsvBtn = document.querySelector('#export-csv-btn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                if (this.resultsTable) {
                    this.resultsTable.download("csv", "solvent_results.csv");
                }
            });
        }
    }

    switchVisualizationTab(tabName) {
        // Update tab states
        const tab3D = document.querySelector('#search-tab-3d');
        const tab2D = document.querySelector('#search-tab-2d');
        const tabRED = document.querySelector('#search-tab-red');
        const view3D = document.querySelector('#search-view-3d');
        const view2D = document.querySelector('#search-view-2d');
        const viewRED = document.querySelector('#search-view-red');

        // Remove all active states
        tab3D?.classList.remove('active');
        tab2D?.classList.remove('active');
        tabRED?.classList.remove('active');

        // Hide all views
        if (view3D) view3D.style.display = 'none';
        if (view2D) view2D.style.display = 'none';
        if (viewRED) viewRED.style.display = 'none';

        // Activate selected tab
        if (tabName === '3d') {
            tab3D?.classList.add('active');
            if (view3D) view3D.style.display = 'flex';
        } else if (tabName === '2d') {
            tab2D?.classList.add('active');
            if (view2D) view2D.style.display = 'flex';
        } else if (tabName === 'red') {
            tabRED?.classList.add('active');
            if (viewRED) viewRED.style.display = 'flex';
        }
    }

    updateTargetContent(targetId, dataSource) {
        const contentDiv = document.querySelector(`#${targetId}-content`);
        if (!contentDiv) return;

        switch (dataSource) {
            case 'custom':
                contentDiv.innerHTML = `
                    <div class="target-manual-inline">
                        <div class="inline-input-group">
                            <label>Name:</label>
                            <input type="text" id="${targetId}-name" placeholder="Sample">
                        </div>
                        <div class="inline-input-group">
                            <label>δD:</label>
                            <input type="number" id="${targetId}-delta-d" step="0.1" placeholder="15.5">
                        </div>
                        <div class="inline-input-group">
                            <label>δP:</label>
                            <input type="number" id="${targetId}-delta-p" step="0.1" placeholder="7.0">
                        </div>
                        <div class="inline-input-group">
                            <label>δH:</label>
                            <input type="number" id="${targetId}-delta-h" step="0.1" placeholder="8.0">
                        </div>
                        <div class="inline-input-group">
                            <label>R0:</label>
                            <input type="number" id="${targetId}-r0" step="0.1" placeholder="5.0" value="5.0">
                        </div>
                    </div>
                `;
                // Add input listeners for validation
                ['delta-d', 'delta-p', 'delta-h'].forEach(param => {
                    const input = document.querySelector(`#${targetId}-${param}`);
                    if (input) {
                        input.addEventListener('input', () => this.validateSearchButton());
                    }
                });
                break;

            case 'polymer':
                const allNames = [...this.polymersData, ...this.experimentalResults];
                contentDiv.innerHTML = `
                    <div class="target-solute-search">
                        <input type="text"
                               id="${targetId}-solute-input"
                               class="solute-search-input"
                               placeholder="Type to search polymer..."
                               list="${targetId}-solute-datalist"
                               autocomplete="off">
                        <datalist id="${targetId}-solute-datalist">
                            ${allNames.map(name => `<option value="${name}">`).join('')}
                        </datalist>
                        <div id="${targetId}-hsp-display" class="solute-hsp-display" style="display: none;">
                            <div class="hsp-header">
                                <div>&delta;D (MPa<sup>0.5</sup>)</div>
                                <div>&delta;P (MPa<sup>0.5</sup>)</div>
                                <div>&delta;H (MPa<sup>0.5</sup>)</div>
                                <div>R0 (MPa<sup>0.5</sup>)</div>
                            </div>
                            <div class="hsp-values-row">
                                <div id="${targetId}-display-dd" class="hsp-cell">-</div>
                                <div id="${targetId}-display-dp" class="hsp-cell">-</div>
                                <div id="${targetId}-display-dh" class="hsp-cell">-</div>
                                <div id="${targetId}-display-r0" class="hsp-cell">-</div>
                            </div>
                        </div>
                    </div>
                `;

                const soluteInput = document.querySelector(`#${targetId}-solute-input`);
                if (soluteInput) {
                    let debounceTimer;
                    soluteInput.addEventListener('input', () => {
                        this.validateSearchButton();
                        // Debounce HSP display update (wait 500ms after user stops typing)
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            this.updateSoluteHSPDisplay(targetId);
                        }, 500);
                    });
                    soluteInput.addEventListener('blur', () => {
                        this.validateSearchButton();
                        clearTimeout(debounceTimer);
                        this.updateSoluteHSPDisplay(targetId);
                    });
                }
                break;
        }
    }

    validateSearchButton() {
        const searchBtn = document.querySelector('#search-solvents-btn');
        const target1Valid = this.isTargetValid('target1');
        const target2Valid = this.isTargetValid('target2');
        const target3Valid = this.isTargetValid('target3');

        // At least one target must be valid
        if (target1Valid || target2Valid || target3Valid) {
            searchBtn.disabled = false;
            searchBtn.title = 'Search for suitable solvents';
        } else {
            searchBtn.disabled = true;
            searchBtn.title = 'Please configure at least one target';
        }
    }

    isTargetValid(targetId) {
        // Get active source from toggle buttons
        const activeBtn = document.querySelector(`#${targetId}-source-toggle .toggle-btn.active`);
        if (!activeBtn) return false;

        const dataSource = activeBtn.dataset.source;

        if (dataSource === 'custom') {
            const deltaD = document.querySelector(`#${targetId}-delta-d`)?.value;
            const deltaP = document.querySelector(`#${targetId}-delta-p`)?.value;
            const deltaH = document.querySelector(`#${targetId}-delta-h`)?.value;
            return deltaD && deltaP && deltaH;
        }

        if (dataSource === 'polymer') {
            const soluteInput = document.querySelector(`#${targetId}-solute-input`)?.value;
            return soluteInput && soluteInput.trim() !== '';
        }

        return false;
    }

    async getTargetData(targetId) {
        if (!this.isTargetValid(targetId)) {
            return null;
        }

        // Get active source from toggle buttons
        const activeBtn = document.querySelector(`#${targetId}-source-toggle .toggle-btn.active`);
        if (!activeBtn) return null;

        const dataSource = activeBtn.dataset.source;

        if (dataSource === 'custom') {
            return {
                name: document.querySelector(`#${targetId}-name`)?.value || 'Target',
                delta_d: parseFloat(document.querySelector(`#${targetId}-delta-d`).value),
                delta_p: parseFloat(document.querySelector(`#${targetId}-delta-p`).value),
                delta_h: parseFloat(document.querySelector(`#${targetId}-delta-h`).value),
                r0: parseFloat(document.querySelector(`#${targetId}-r0`)?.value) || 5.0
            };
        }

        if (dataSource === 'polymer') {
            const soluteName = document.querySelector(`#${targetId}-solute-input`).value.trim();
            if (!soluteName) return null;

            // First check experimental results
            const allResults = window.experimentalResultsManager ?
                window.experimentalResultsManager.getExperimentalResults() : [];
            const expResult = allResults.find(r => r.sample_name === soluteName);

            if (expResult) {
                return {
                    name: expResult.sample_name,
                    delta_d: expResult.hsp_result.delta_d,
                    delta_p: expResult.hsp_result.delta_p,
                    delta_h: expResult.hsp_result.delta_h,
                    r0: expResult.hsp_result.radius
                };
            }

            // If not found in experimental results, fetch from polymer API
            try {
                const response = await fetch(`/api/polymer-data/polymer/${encodeURIComponent(soluteName)}`);
                if (response.ok) {
                    const polymerData = await response.json();
                    return {
                        name: polymerData.polymer,
                        delta_d: polymerData.delta_d,
                        delta_p: polymerData.delta_p,
                        delta_h: polymerData.delta_h,
                        r0: polymerData.ra
                    };
                }
            } catch (error) {
                console.error('Error fetching polymer data:', error);
            }

            return null;
        }

        return null;
    }

    async updateSoluteHSPDisplay(targetId) {
        const displayDiv = document.querySelector(`#${targetId}-hsp-display`);
        if (!displayDiv) return;

        const soluteName = document.querySelector(`#${targetId}-solute-input`)?.value.trim();

        if (!soluteName) {
            displayDiv.style.display = 'none';
            return;
        }

        try {
            // First check experimental results
            const allResults = window.experimentalResultsManager ?
                window.experimentalResultsManager.getExperimentalResults() : [];
            const expResult = allResults.find(r => r.sample_name === soluteName);

            if (expResult) {
                // Display experimental data
                document.querySelector(`#${targetId}-display-dd`).textContent = expResult.hsp_result.delta_d.toFixed(1);
                document.querySelector(`#${targetId}-display-dp`).textContent = expResult.hsp_result.delta_p.toFixed(1);
                document.querySelector(`#${targetId}-display-dh`).textContent = expResult.hsp_result.delta_h.toFixed(1);
                document.querySelector(`#${targetId}-display-r0`).textContent = expResult.hsp_result.radius.toFixed(1);
                displayDiv.style.display = 'block';
                return;
            }

            // If not found in experimental results, fetch from polymer API
            const response = await fetch(`/api/polymer-data/polymer/${encodeURIComponent(soluteName)}`);
            if (response.ok) {
                const polymerData = await response.json();
                document.querySelector(`#${targetId}-display-dd`).textContent = polymerData.delta_d.toFixed(1);
                document.querySelector(`#${targetId}-display-dp`).textContent = polymerData.delta_p.toFixed(1);
                document.querySelector(`#${targetId}-display-dh`).textContent = polymerData.delta_h.toFixed(1);
                document.querySelector(`#${targetId}-display-r0`).textContent = polymerData.ra.toFixed(1);
                displayDiv.style.display = 'block';
            } else {
                // Not found, hide display
                displayDiv.style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching HSP data:', error);
            displayDiv.style.display = 'none';
        }
    }

    async performSearch() {
        // Get target data (now async)
        const target1Data = await this.getTargetData('target1');
        const target2Data = await this.getTargetData('target2');
        const target3Data = await this.getTargetData('target3');

        // Store targets for RED calculations in results table
        this.currentTarget1 = target1Data;
        this.currentTarget2 = target2Data;
        this.currentTarget3 = target3Data;

        // Check if at least one target is configured
        if (!target1Data && !target2Data && !target3Data) {
            this.showError('Please configure at least one target.');
            return;
        }

        // Show loading
        const searchBtn = document.querySelector('#search-solvents-btn');
        const originalText = searchBtn.textContent;
        searchBtn.textContent = 'Searching...';
        searchBtn.disabled = true;

        try {
            // Use Target1 as primary target for search
            const primaryTarget = target1Data || target2Data || target3Data;

            const results = await this.searchSingleSolvents(
                primaryTarget.delta_d, primaryTarget.delta_p, primaryTarget.delta_h, primaryTarget.r0
            );

            // Add saved mixtures to results
            const savedMixtures = this.getSavedMixturesAsResults(
                primaryTarget.delta_d, primaryTarget.delta_p, primaryTarget.delta_h, primaryTarget.r0
            );

            this.searchResults = [...results.results, ...savedMixtures];
            this.filteredResults = [...this.searchResults]; // Initialize filtered results

            // Sort by distance
            this.searchResults.sort((a, b) => a.distance - b.distance);
            this.filteredResults.sort((a, b) => a.distance - b.distance);

            this.displayResults('single');
            this.updateResultsCount(this.searchResults.length);

            // Generate visualization with all targets
            this.generateVisualization(target1Data, target2Data, this.searchResults, target3Data);

            // Generate RED Plot if both targets are set
            const tabRED = document.querySelector('#search-tab-red');
            if (target1Data && target2Data) {
                this.generateREDPlot(target1Data, target2Data, this.searchResults);
                if (tabRED) tabRED.style.display = 'inline-block';
            } else {
                if (tabRED) tabRED.style.display = 'none';
            }

            // Populate right panel results table
            this.populateResultsTable();

        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            searchBtn.textContent = originalText;
            searchBtn.disabled = false;
        }
    }

    generateVisualization(target1Data, target2Data, solventResults, target3Data = null) {
        // Convert target data to format expected by visualization module
        if (!target1Data && !target2Data && !target3Data) {
            this.visualization.showPlaceholder('Configure targets and search solvents to display visualization');
            return;
        }

        // Prepare target data with proper field names
        const target1 = target1Data ? {
            name: target1Data.name,
            delta_d: target1Data.delta_d,
            delta_p: target1Data.delta_p,
            delta_h: target1Data.delta_h,
            radius: target1Data.r0
        } : null;

        const target2 = target2Data ? {
            name: target2Data.name,
            delta_d: target2Data.delta_d,
            delta_p: target2Data.delta_p,
            delta_h: target2Data.delta_h,
            radius: target2Data.r0
        } : null;

        const target3 = target3Data ? {
            name: target3Data.name,
            delta_d: target3Data.delta_d,
            delta_p: target3Data.delta_p,
            delta_h: target3Data.delta_h,
            radius: target3Data.r0
        } : null;

        // Prepare solvent data (all results for visualization, up to API limit)
        const solventsToVisualize = solventResults.map(s => ({
            name: s.name,
            delta_d: s.delta_d,
            delta_p: s.delta_p,
            delta_h: s.delta_h
        }));

        // Generate visualization - pass all targets
        if (target1 && !target2 && !target3) {
            // Single target visualization
            this.visualization.generateDualTargetVisualization(target1, null, solventsToVisualize, null);
        } else if (target1 && target2 && !target3) {
            // Dual target visualization
            this.visualization.generateDualTargetVisualization(target1, target2, solventsToVisualize, null);
        } else if (target1 && !target2 && target3) {
            // Target 1 and 3
            this.visualization.generateDualTargetVisualization(target1, target3, solventsToVisualize, null);
        } else if (!target1 && target2 && target3) {
            // Target 2 and 3
            this.visualization.generateDualTargetVisualization(target2, target3, solventsToVisualize, null);
        } else if (target1 && target2 && target3) {
            // All three targets
            this.visualization.generateDualTargetVisualization(target1, target2, solventsToVisualize, target3);
        } else if (target2 && !target3) {
            // Only target2 is set
            this.visualization.generateDualTargetVisualization(target2, null, solventsToVisualize, null);
        } else if (target3) {
            // Only target3 is set
            this.visualization.generateDualTargetVisualization(target3, null, solventsToVisualize, null);
        }
    }

    generateREDPlot(target1Data, target2Data, solventResults) {
        const containerId = 'search-plot-red-scatter';
        const element = document.getElementById(containerId);

        if (!element) {
            console.warn(`Container #${containerId} not found`);
            return;
        }

        // RED Plot requires both targets
        if (!target1Data || !target2Data) {
            element.innerHTML = '<div class="visualization-placeholder"><p>RED Plot requires both Target 1 and Target 2</p></div>';
            return;
        }

        // Prepare data
        const redX = [];
        const redY = [];
        const solventNames = [];
        const hoverTexts = [];
        const colors = [];

        solventResults.forEach(s => {
            const red1 = this.calculateRED(s, target1Data);
            const red2 = this.calculateRED(s, target2Data);

            if (red1 !== null && red2 !== null) {
                redX.push(red1);
                redY.push(red2);
                solventNames.push(s.name);

                // Determine solubility status
                let status = '';
                let color = '';
                if (red1 < 1.0 && red2 < 1.0) {
                    status = 'Both dissolve';
                    color = '#4CAF50'; // Material Green (both targets)
                } else if (red1 < 1.0) {
                    status = 'Target 1 only';
                    color = '#2196F3'; // Material Blue (matches Target 1 sphere)
                } else if (red2 < 1.0) {
                    status = 'Target 2 only';
                    color = '#FF9800'; // Material Orange (matches Target 2 sphere)
                } else {
                    status = 'Neither dissolve';
                    color = '#BDBDBD'; // Material Grey (neither target)
                }

                hoverTexts.push(
                    `<b>${s.name}</b><br>` +
                    `${target1Data.name} RED: ${red1.toFixed(2)}<br>` +
                    `${target2Data.name} RED: ${red2.toFixed(2)}<br>` +
                    `Status: ${status}`
                );
                colors.push(color);
            }
        });

        // Calculate axis range based on data
        const maxX = redX.length > 0 ? Math.max(...redX) : 1.5;
        const maxY = redY.length > 0 ? Math.max(...redY) : 1.5;
        const maxRED = Math.max(maxX, maxY, 1.5);
        const upperLimit = maxRED * 1.1; // Add 10% margin

        // Create traces
        const traces = [
            {
                type: 'scatter',
                mode: 'markers',
                x: redX,
                y: redY,
                marker: {
                    size: 6,
                    color: colors,
                    opacity: 0.7,
                    line: {
                        width: 1,
                        color: 'rgba(0,0,0,0.3)'
                    }
                },
                text: solventNames,
                hovertext: hoverTexts,
                hovertemplate: '%{hovertext}<extra></extra>',
                showlegend: false
            }
        ];

        // Layout with reference lines and quadrant shading
        const layout = {
            shapes: [
                // Vertical line at RED = 1.0
                {
                    type: 'line',
                    x0: 1.0,
                    y0: 0,
                    x1: 1.0,
                    y1: upperLimit,
                    line: {
                        color: '#ef4444',
                        width: 2,
                        dash: 'dash'
                    }
                },
                // Horizontal line at RED = 1.0
                {
                    type: 'line',
                    x0: 0,
                    y0: 1.0,
                    x1: upperLimit,
                    y1: 1.0,
                    line: {
                        color: '#ef4444',
                        width: 2,
                        dash: 'dash'
                    }
                },
                // Green shaded area (both dissolve)
                {
                    type: 'rect',
                    x0: 0,
                    y0: 0,
                    x1: 1.0,
                    y1: 1.0,
                    fillcolor: 'rgba(16, 185, 129, 0.1)',
                    line: {
                        width: 0
                    },
                    layer: 'below'
                }
            ],
            xaxis: {
                title: `${target1Data.name} RED`,
                range: [0, upperLimit],
                showgrid: true,
                zeroline: true
            },
            yaxis: {
                title: `${target2Data.name} RED`,
                range: [0, upperLimit],
                showgrid: true,
                zeroline: true
            },
            hovermode: 'closest',
            margin: {l: 60, r: 30, t: 30, b: 60}
        };

        // Render plot
        Plotly.newPlot(containerId, traces, layout, {
            responsive: true,
            displayModeBar: true,
            displaylogo: false
        });
    }

    async searchSingleSolvents(deltaD, deltaP, deltaH, radius) {
        const params = new URLSearchParams({
            target_delta_d: deltaD,
            target_delta_p: deltaP,
            target_delta_h: deltaH,
            max_results: 10000  // Request up to 10000 results for visualization
        });

        if (radius) params.append('target_radius', radius);

        const response = await fetch(`/api/solvent-search/search?${params}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Search request failed');
        }

        return await response.json();
    }

    async searchBlendSolvents(deltaD, deltaP, deltaH, radius) {
        const params = new URLSearchParams({
            target_delta_d: deltaD,
            target_delta_p: deltaP,
            target_delta_h: deltaH,
        });

        if (radius) params.append('target_radius', radius);

        const response = await fetch(`/api/solvent-search/blend-search?${params}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Blend search request failed');
        }

        return await response.json();
    }

    sortAndDisplayResults() {
        const searchMode = document.querySelector('input[name="search-mode"]:checked').value;

        // Sort results
        this.searchResults.sort((a, b) => {
            switch (this.currentSort) {
                case 'distance':
                    return a.distance - b.distance;
                case 'name':
                    const nameA = searchMode === 'single' ? a.name : a.solvent1.name;
                    const nameB = searchMode === 'single' ? b.name : b.solvent1.name;
                    return nameA.localeCompare(nameB);
                case 'bp':
                    if (searchMode === 'single') {
                        return (a.boiling_point || 999) - (b.boiling_point || 999);
                    }
                    return 0; // Blend mode doesn't have BP
                default:
                    return 0;
            }
        });

        this.displayResults(searchMode);
    }

    displayResults(searchMode) {
        // Results are now displayed in the right panel table via populateResultsTable()
        // This method is kept for compatibility but does nothing
        return;
    }

    createSolventCardHTML(solvent) {
        const redColor = this.getREDColor(solvent.red);

        return `
            <div class="solvent-result-card">
                <div class="result-card-header">
                    <h4>${this.escapeHtml(solvent.name)}</h4>
                    <span class="red-badge" style="background-color: ${redColor}">RED: ${solvent.red.toFixed(3)}</span>
                </div>
                <div class="result-card-content">
                    <div class="hsp-values">
                        <span>δD: ${solvent.delta_d.toFixed(1)}</span>
                        <span>δP: ${solvent.delta_p.toFixed(1)}</span>
                        <span>δH: ${solvent.delta_h.toFixed(1)}</span>
                    </div>
                    <div class="solvent-properties">
                        ${solvent.boiling_point ? `<span>BP: ${solvent.boiling_point.toFixed(1)}°C</span>` : ''}
                        ${solvent.density ? `<span>ρ: ${solvent.density.toFixed(3)} g/cm³</span>` : ''}
                    </div>
                    ${solvent.cas ? `<div class="solvent-cas">CAS: ${solvent.cas}</div>` : ''}
                </div>
            </div>
        `;
    }

    createBlendCardHTML(blend) {
        const redColor = this.getREDColor(blend.red);
        const ratio1 = Math.round(blend.ratio * 100);
        const ratio2 = 100 - ratio1;

        return `
            <div class="blend-result-card">
                <div class="result-card-header">
                    <h4>Blend: ${ratio1}:${ratio2}</h4>
                    <span class="red-badge" style="background-color: ${redColor}">RED: ${blend.red.toFixed(3)}</span>
                </div>
                <div class="result-card-content">
                    <div class="blend-components">
                        <div class="component">
                            <strong>${this.escapeHtml(blend.solvent1.name)}</strong> (${ratio1}%)
                            <div class="hsp-mini">
                                δD: ${blend.solvent1.delta_d.toFixed(1)},
                                δP: ${blend.solvent1.delta_p.toFixed(1)},
                                δH: ${blend.solvent1.delta_h.toFixed(1)}
                            </div>
                        </div>
                        <div class="component">
                            <strong>${this.escapeHtml(blend.solvent2.name)}</strong> (${ratio2}%)
                            <div class="hsp-mini">
                                δD: ${blend.solvent2.delta_d.toFixed(1)},
                                δP: ${blend.solvent2.delta_p.toFixed(1)},
                                δH: ${blend.solvent2.delta_h.toFixed(1)}
                            </div>
                        </div>
                    </div>
                    <div class="blend-result-hsp">
                        <strong>Blend HSP:</strong>
                        δD: ${blend.blend_hsp.delta_d.toFixed(1)},
                        δP: ${blend.blend_hsp.delta_p.toFixed(1)},
                        δH: ${blend.blend_hsp.delta_h.toFixed(1)}
                    </div>
                </div>
            </div>
        `;
    }

    getREDColor(red) {
        if (red < 0.8) return '#10b981'; // Green - good
        if (red < 1.2) return '#f59e0b'; // Orange - partial
        return '#ef4444'; // Red - poor
    }

    updateResultsCount(count) {
        const countDisplay = document.querySelector('#results-count-display');
        if (countDisplay) {
            countDisplay.textContent = `${count} result${count !== 1 ? 's' : ''}`;
        }
    }

    showError(message) {
        // Show error in right panel table
        const tbody = document.querySelector('#solvent-results-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-cell" style="color: #ef4444;">❌ ${message}</td>
                </tr>
            `;
        }
        this.updateResultsCountBadge(0);
    }

    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }

    /**
     * Get saved mixtures from localStorage and convert to search results format
     */
    getSavedMixturesAsResults(targetD, targetP, targetH, targetRadius) {
        try {
            const STORAGE_KEY = 'mixingcompass_saved_mixtures';
            const mixtures = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

            return mixtures.map(mixture => {
                const distance = Math.sqrt(
                    4 * Math.pow(mixture.hsp.delta_d - targetD, 2) +
                    Math.pow(mixture.hsp.delta_p - targetP, 2) +
                    Math.pow(mixture.hsp.delta_h - targetH, 2)
                );

                const red = targetRadius ? distance / targetRadius : distance;

                return {
                    name: `[Mixture] ${mixture.name}`,
                    delta_d: mixture.hsp.delta_d,
                    delta_p: mixture.hsp.delta_p,
                    delta_h: mixture.hsp.delta_h,
                    distance: red,
                    red: red,
                    source_file: 'saved_mixture',
                    cho: null,
                    boiling_point: null,
                    density: null,
                    molecular_weight: null,
                    cost: null,
                    cas: null,
                    wgk: null,
                    ghs: null,
                    source_url: null
                };
            });
        } catch (error) {
            console.warn('Could not load saved mixtures:', error);
            return [];
        }
    }

    /**
     * Calculate RED (Relative Energy Difference) between a solvent and target
     * RED = distance / R0
     */
    calculateDistance(solvent, target) {
        if (!target) return null;

        return Math.sqrt(
            4 * Math.pow(solvent.delta_d - target.delta_d, 2) +
            Math.pow(solvent.delta_p - target.delta_p, 2) +
            Math.pow(solvent.delta_h - target.delta_h, 2)
        );
    }

    calculateRED(solvent, target) {
        if (!target) return null;
        const distance = this.calculateDistance(solvent, target);
        return distance / target.r0;
    }

    /**
     * Get CSS class for RED value based on solubility
     */
    getREDClass(red) {
        if (red === null) return '';
        if (red < 0.8) return 'red-good';
        if (red < 1.2) return 'red-partial';
        return 'red-poor';
    }

    /**
     * Initialize Tabulator for results table
     */
    initializeResultsTable() {
        const container = document.querySelector('#solvent-results-table');
        if (!container) {
            console.error('Tabulator container not found');
            return;
        }

        // Tabulator configuration
        this.resultsTable = new Tabulator(container, {
            data: [],
            layout: "fitColumns",
            height: "100%",
            placeholder: "Search solvents to see results",

            columns: [
                {
                    title: "Solvent<br>Name",
                    field: "name",
                    sorter: "string",
                    headerFilter: "input",
                    headerFilterPlaceholder: "Filter...",
                    minWidth: 120,
                    widthGrow: 2,
                    formatter: (cell) => {
                        const data = cell.getRow().getData();
                        const sourceUrl = data.source_url;
                        const sourceFile = data.source_file;
                        const name = cell.getValue();
                        const cas = data.cas;

                        // Build Google search query
                        const searchQuery = cas
                            ? `${name} CAS ${cas}`
                            : name;
                        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

                        let html = `
                            <span style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
                                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;">${name}</span>
                                <span style="display: flex; gap: 4px;">`;

                        // Data source link
                        if (sourceUrl) {
                            html += `<a href="${sourceUrl}"
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       title="View original data source"
                                       class="source-link-icon"
                                       onclick="event.stopPropagation()">🔗</a>`;
                        }

                        // Google search link (always show)
                        html += `<a href="${googleUrl}"
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   title="Search on Google"
                                   class="google-search-icon"
                                   onclick="event.stopPropagation()">🔍</a>`;

                        html += `</span></span>`;
                        return html;
                    }
                },
                {
                    title: "Target 1<br>RED",
                    field: "red1_value",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (value === null || value === 999) return '—';
                        const redClass = this.getREDClass(value);
                        return `<span class="${redClass}">${value.toFixed(2)}</span>`;
                    },
                    headerTooltip: "Target 1: Relative Energy Difference",
                    width: 80,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "Target 2<br>RED",
                    field: "red2_value",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (value === null || value === 999) return '—';
                        const redClass = this.getREDClass(value);
                        return `<span class="${redClass}">${value.toFixed(2)}</span>`;
                    },
                    headerTooltip: "Target 2: Relative Energy Difference",
                    width: 80,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "Target 3<br>RED",
                    field: "red3_value",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (value === null || value === 999) return '—';
                        const redClass = this.getREDClass(value);
                        return `<span class="${redClass}">${value.toFixed(2)}</span>`;
                    },
                    headerTooltip: "Target 3: Relative Energy Difference",
                    width: 80,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "δD<br>(MPa<sup>0.5</sup>)",
                    field: "delta_d",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => cell.getValue().toFixed(1),
                    headerTooltip: "Dispersion parameter (δD) in MPa^0.5",
                    width: 80,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "δP<br>(MPa<sup>0.5</sup>)",
                    field: "delta_p",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => cell.getValue().toFixed(1),
                    headerTooltip: "Polar parameter (δP) in MPa^0.5",
                    width: 80,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "δH<br>(MPa<sup>0.5</sup>)",
                    field: "delta_h",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => cell.getValue().toFixed(1),
                    headerTooltip: "Hydrogen bonding parameter (δH) in MPa^0.5",
                    width: 80,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "C,H,O<br>Only",
                    field: "cho",
                    sorter: "boolean",
                    headerFilter: "tickCross",
                    headerFilterParams: {"tristate": true},
                    headerFilterEmptyCheck: (value) => value === null,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (value === true) {
                            return '<span class="cho-yes" title="Contains only C, H, O elements">✔</span>';
                        } else if (value === false) {
                            return '<span class="cho-no" title="Contains other elements">✘</span>';
                        }
                        return '—';
                    },
                    headerTooltip: "Contains only C, H, O elements",
                    width: 68,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "Tb<br>(°C)",
                    field: "boiling_point",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (value === null || value === undefined) {
                            return '—';
                        }
                        return value.toFixed(1);
                    },
                    headerTooltip: "Boiling point (Tb) in °C",
                    width: 70,
                    hozAlign: "center",
                    headerHozAlign: "center"
                }
            ],

            initialSort: [
                {column: "red1_value", dir: "asc"}
            ],

            // Row formatter for color-coding based on solubility
            rowFormatter: (row) => {
                const data = row.getData();
                const red1 = data.red1_value;
                const red2 = data.red2_value;

                // Only color-code when Target 2 is set
                if (red2 !== null && red2 !== 999) {
                    const element = row.getElement();

                    if (red1 < 1.0 && red2 < 1.0) {
                        // Both dissolve - Green
                        element.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
                    } else if (red1 < 1.0 && red2 >= 1.0) {
                        // Target 1 only - Blue
                        element.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
                    } else if (red1 >= 1.0 && red2 < 1.0) {
                        // Target 2 only - Orange
                        element.style.backgroundColor = "rgba(245, 158, 11, 0.1)";
                    } else {
                        // Neither dissolve - Light gray
                        element.style.backgroundColor = "rgba(156, 163, 175, 0.05)";
                    }
                } else {
                    // No color coding when Target 2 is not set
                    row.getElement().style.backgroundColor = "";
                }
            }
        });

        // Add dataFiltered event handler with debounce for visualization update
        let vizUpdateTimeout;
        this.resultsTable.on("dataFiltered", (filters, rows) => {
            // Update count badge with filtered count
            this.updateResultsCountBadge(rows.length);

            // Debounce visualization update (300ms delay)
            clearTimeout(vizUpdateTimeout);
            vizUpdateTimeout = setTimeout(() => {
                // Get filtered data from rows
                const filteredData = rows.map(row => {
                    const data = row.getData();
                    return {
                        name: data.name,
                        delta_d: data.delta_d,
                        delta_p: data.delta_p,
                        delta_h: data.delta_h
                    };
                });

                // Update visualization with filtered data
                this.generateVisualization(this.currentTarget1, this.currentTarget2, filteredData, this.currentTarget3);

                // Update RED Plot with filtered data if both targets are set
                if (this.currentTarget1 && this.currentTarget2) {
                    this.generateREDPlot(this.currentTarget1, this.currentTarget2, filteredData);
                }
            }, 300);
        });

        // Wait for table to be built before hiding columns
        this.resultsTable.on("tableBuilt", () => {
            // Initially hide Target 2 and Target 3 RED columns (will be shown when targets are set)
            this.resultsTable.hideColumn("red2_value");
            this.resultsTable.hideColumn("red3_value");
        });
    }

    /**
     * Populate the results table with solvent data (Tabulator version)
     */
    populateResultsTable() {
        if (!this.resultsTable) {
            console.error('Tabulator not initialized');
            return;
        }

        if (this.searchResults.length === 0) {
            this.resultsTable.setData([]);
            this.updateResultsCountBadge(0);
            // Hide CSV button
            const exportBtn = document.querySelector('#export-csv-btn');
            if (exportBtn) exportBtn.style.display = 'none';
            return;
        }

        // Prepare data for Tabulator (use searchResults instead of filteredResults)
        const tableData = this.searchResults.map(solvent => {
            const ra1 = this.calculateDistance(solvent, this.currentTarget1);
            const red1 = this.calculateRED(solvent, this.currentTarget1);
            const ra2 = this.calculateDistance(solvent, this.currentTarget2);
            const red2 = this.calculateRED(solvent, this.currentTarget2);
            const ra3 = this.calculateDistance(solvent, this.currentTarget3);
            const red3 = this.calculateRED(solvent, this.currentTarget3);

            return {
                name: solvent.name,
                cas: solvent.cas || '',
                ra1_value: ra1 !== null ? ra1 : 999,
                red1_value: red1 !== null ? red1 : 999,
                ra2_value: ra2 !== null ? ra2 : 999,
                red2_value: red2 !== null ? red2 : 999,
                ra3_value: ra3 !== null ? ra3 : 999,
                red3_value: red3 !== null ? red3 : 999,
                delta_d: solvent.delta_d,
                delta_p: solvent.delta_p,
                delta_h: solvent.delta_h,
                cho: solvent.cho,
                boiling_point: solvent.boiling_point,
                source_url: solvent.source_url || '',
                source_file: solvent.source_file || ''
            };
        });

        // Update table
        this.resultsTable.setData(tableData);
        this.updateResultsCountBadge(this.searchResults.length);

        // Show/hide Target 2 and Target 3 RED columns based on whether they are set
        if (this.currentTarget2) {
            this.resultsTable.showColumn("red2_value");
        } else {
            this.resultsTable.hideColumn("red2_value");
        }

        if (this.currentTarget3) {
            this.resultsTable.showColumn("red3_value");
        } else {
            this.resultsTable.hideColumn("red3_value");
        }

        // Show CSV button
        const exportBtn = document.querySelector('#export-csv-btn');
        if (exportBtn) exportBtn.style.display = 'inline-block';
    }

    /**
     * Update the results count badge
     */
    updateResultsCountBadge(count) {
        const badge = document.querySelector('#results-count-badge');
        if (badge) {
            badge.textContent = `${count} result${count !== 1 ? 's' : ''}`;
        }
    }

    setupPanelToggle() {
        const splitLayout = document.querySelector('#solvent-search .split-layout');
        const collapseBtn = document.getElementById('panel-collapse-btn');
        const boundaryBtn = document.getElementById('panel-boundary-btn');
        const expandBtn = document.getElementById('panel-expand-btn');

        if (!splitLayout || !collapseBtn || !boundaryBtn || !expandBtn) {
            console.warn('Panel toggle elements not found');
            return;
        }

        // Toggle function
        const togglePanel = () => {
            const isCollapsed = splitLayout.classList.contains('collapsed');

            if (isCollapsed) {
                // Expand
                splitLayout.classList.remove('collapsed');
                expandBtn.style.display = 'none';
                boundaryBtn.style.display = 'block';
                boundaryBtn.innerHTML = '◀';
            } else {
                // Collapse
                splitLayout.classList.add('collapsed');
                expandBtn.style.display = 'block';
                boundaryBtn.style.display = 'none';
            }
        };

        // Event listeners
        collapseBtn.addEventListener('click', togglePanel);
        boundaryBtn.addEventListener('click', togglePanel);
        expandBtn.addEventListener('click', togglePanel);

        console.log('Panel toggle setup complete');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('solvent-search')) {
        window.solventSearch = new SolventSearch();
    }
});

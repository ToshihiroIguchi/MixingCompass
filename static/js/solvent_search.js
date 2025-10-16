/**
 * Solvent Search Module
 * Search for single solvents or solvent blends based on target HSP values
 */

class SolventSearch {
    constructor() {
        this.searchResults = [];
        this.currentSort = 'distance';
        this.polymersData = [];
        this.experimentalResults = [];
        this.visualization = null;
        this.init();
    }

    init() {
        // Initialize visualization module
        this.visualization = new HSPVisualization('search-plotly-visualization');
        this.visualization.showPlaceholder('Configure targets and search solvents to display visualization');

        this.loadPolymersData();
        this.loadExperimentalResults();
        this.setupEventListeners();
        this.updateTargetContent('target1', 'manual'); // Initialize with manual mode
        console.log('Solvent Search initialized');

        // Log computed CSS styles for debugging
        this.logLayoutStyles();
    }

    logLayoutStyles() {
        const solventSection = document.querySelector('#solvent-search');
        const splitLayout = document.querySelector('#solvent-search .split-layout');

        if (splitLayout) {
            const computedStyle = window.getComputedStyle(splitLayout);
            console.log('=== Split Layout CSS Debug ===');
            console.log('grid-template-columns:', computedStyle.gridTemplateColumns);
            console.log('display:', computedStyle.display);
            console.log('width:', computedStyle.width);
            console.log('gap:', computedStyle.gap);
            console.log('padding:', computedStyle.padding);

            // Check if there are any inline styles
            console.log('Inline style:', splitLayout.getAttribute('style'));

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
        // Target1 dropdown
        const target1Select = document.querySelector('#target1-data-source');
        if (target1Select) {
            target1Select.addEventListener('change', (e) => {
                this.updateTargetContent('target1', e.target.value);
                this.validateSearchButton();
            });
        }

        // Target2 dropdown
        const target2Select = document.querySelector('#target2-data-source');
        if (target2Select) {
            target2Select.addEventListener('change', (e) => {
                this.updateTargetContent('target2', e.target.value);
                this.validateSearchButton();
            });
        }

        // Search button
        const searchBtn = document.querySelector('#search-solvents-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.performSearch());
        }

        // Toggle filters
        const toggleFiltersBtn = document.querySelector('#toggle-filters');
        if (toggleFiltersBtn) {
            toggleFiltersBtn.addEventListener('click', () => this.toggleFilters());
        }

        // Sort selector
        const sortSelect = document.querySelector('#sort-results');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.sortAndDisplayResults();
            });
        }

        // Visualization tabs (3D/2D switching)
        const tab3D = document.querySelector('#search-tab-3d');
        const tab2D = document.querySelector('#search-tab-2d');

        if (tab3D) {
            tab3D.addEventListener('click', () => this.switchVisualizationTab('3d'));
        }
        if (tab2D) {
            tab2D.addEventListener('click', () => this.switchVisualizationTab('2d'));
        }
    }

    switchVisualizationTab(tabName) {
        // Update tab states
        const tab3D = document.querySelector('#search-tab-3d');
        const tab2D = document.querySelector('#search-tab-2d');
        const view3D = document.querySelector('#search-view-3d');
        const view2D = document.querySelector('#search-view-2d');

        if (tabName === '3d') {
            tab3D?.classList.add('active');
            tab2D?.classList.remove('active');
            if (view3D) view3D.style.display = 'flex';
            if (view2D) view2D.style.display = 'none';
        } else {
            tab3D?.classList.remove('active');
            tab2D?.classList.add('active');
            if (view3D) view3D.style.display = 'none';
            if (view2D) view2D.style.display = 'flex';
        }
    }

    updateTargetContent(targetId, dataSource) {
        const contentDiv = document.querySelector(`#${targetId}-content`);
        if (!contentDiv) return;

        switch (dataSource) {
            case 'none':
                contentDiv.innerHTML = '';
                break;

            case 'manual':
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

            case 'solute':
                const allNames = [...this.polymersData, ...this.experimentalResults];
                contentDiv.innerHTML = `
                    <div class="target-solute-search">
                        <input type="text"
                               id="${targetId}-solute-input"
                               class="solute-search-input"
                               placeholder="Type to search solute..."
                               list="${targetId}-solute-datalist">
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
                    soluteInput.addEventListener('input', () => {
                        this.validateSearchButton();
                        this.updateSoluteHSPDisplay(targetId);
                    });
                    soluteInput.addEventListener('blur', () => {
                        this.validateSearchButton();
                        this.updateSoluteHSPDisplay(targetId);
                    });
                }
                break;

            case 'solute-user-only':
                contentDiv.innerHTML = `
                    <div class="target-solute-search">
                        <input type="text"
                               id="${targetId}-solute-input"
                               class="solute-search-input"
                               placeholder="Type to search user added solute..."
                               list="${targetId}-solute-datalist">
                        <datalist id="${targetId}-solute-datalist">
                            ${this.experimentalResults.map(name => `<option value="${name}">`).join('')}
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

                const userSoluteInput = document.querySelector(`#${targetId}-solute-input`);
                if (userSoluteInput) {
                    userSoluteInput.addEventListener('input', () => {
                        this.validateSearchButton();
                        this.updateSoluteHSPDisplay(targetId);
                    });
                    userSoluteInput.addEventListener('blur', () => {
                        this.validateSearchButton();
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

        // At least one target must be valid
        if (target1Valid || target2Valid) {
            searchBtn.disabled = false;
            searchBtn.title = 'Search for suitable solvents';
        } else {
            searchBtn.disabled = true;
            searchBtn.title = 'Please configure at least one target';
        }
    }

    isTargetValid(targetId) {
        const dataSource = document.querySelector(`#${targetId}-data-source`).value;

        if (dataSource === 'none') {
            return false;
        }

        if (dataSource === 'manual') {
            const deltaD = document.querySelector(`#${targetId}-delta-d`)?.value;
            const deltaP = document.querySelector(`#${targetId}-delta-p`)?.value;
            const deltaH = document.querySelector(`#${targetId}-delta-h`)?.value;
            return deltaD && deltaP && deltaH;
        }

        if (dataSource === 'solute' || dataSource === 'solute-user-only') {
            const soluteInput = document.querySelector(`#${targetId}-solute-input`)?.value;
            return soluteInput && soluteInput.trim() !== '';
        }

        return false;
    }

    async getTargetData(targetId) {
        const dataSource = document.querySelector(`#${targetId}-data-source`).value;

        if (dataSource === 'none' || !this.isTargetValid(targetId)) {
            return null;
        }

        if (dataSource === 'manual') {
            return {
                name: document.querySelector(`#${targetId}-name`)?.value || 'Target',
                delta_d: parseFloat(document.querySelector(`#${targetId}-delta-d`).value),
                delta_p: parseFloat(document.querySelector(`#${targetId}-delta-p`).value),
                delta_h: parseFloat(document.querySelector(`#${targetId}-delta-h`).value),
                r0: parseFloat(document.querySelector(`#${targetId}-r0`)?.value) || 5.0
            };
        }

        if (dataSource === 'solute' || dataSource === 'solute-user-only') {
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

    toggleFilters() {
        const filterOptions = document.querySelector('#filter-options');
        if (filterOptions) {
            filterOptions.style.display = filterOptions.style.display === 'none' ? 'block' : 'none';
        }
    }

    async performSearch() {
        // Get target data (now async)
        const target1Data = await this.getTargetData('target1');
        const target2Data = await this.getTargetData('target2');

        // Check if at least one target is configured
        if (!target1Data && !target2Data) {
            this.showError('Please configure at least one target.');
            return;
        }

        // Get filter values
        const bpMin = parseFloat(document.querySelector('#bp-min')?.value) || null;
        const bpMax = parseFloat(document.querySelector('#bp-max')?.value) || null;
        const costMin = parseFloat(document.querySelector('#cost-min')?.value) || null;
        const costMax = parseFloat(document.querySelector('#cost-max')?.value) || null;

        // Get WGK filter
        const wgkSelect = document.querySelector('#wgk-filter');
        const wgkFilter = wgkSelect ? Array.from(wgkSelect.selectedOptions).map(opt => opt.value) : [];

        // Show loading
        const searchBtn = document.querySelector('#search-solvents-btn');
        const originalText = searchBtn.textContent;
        searchBtn.textContent = 'Searching...';
        searchBtn.disabled = true;

        try {
            // Use Target1 as primary target for search
            const primaryTarget = target1Data || target2Data;

            const results = await this.searchSingleSolvents(
                primaryTarget.delta_d, primaryTarget.delta_p, primaryTarget.delta_h, primaryTarget.r0,
                bpMin, bpMax, costMin, costMax, wgkFilter
            );

            this.searchResults = results.results;
            this.displayResults('single');
            this.updateResultsCount(results.count);

            // Generate visualization with both targets
            this.generateVisualization(target1Data, target2Data, this.searchResults);

        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            searchBtn.textContent = originalText;
            searchBtn.disabled = false;
        }
    }

    generateVisualization(target1Data, target2Data, solventResults) {
        // Convert target data to format expected by visualization module
        if (!target1Data && !target2Data) {
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

        // Prepare solvent data (top 20 results for visualization clarity)
        const topSolvents = solventResults.slice(0, 20).map(s => ({
            name: s.name,
            delta_d: s.delta_d,
            delta_p: s.delta_p,
            delta_h: s.delta_h
        }));

        // Generate visualization
        if (target1 && !target2) {
            // Single target visualization
            this.visualization.generateDualTargetVisualization(target1, null, topSolvents);
        } else if (target1 && target2) {
            // Dual target visualization
            this.visualization.generateDualTargetVisualization(target1, target2, topSolvents);
        } else if (target2) {
            // Only target2 is set
            this.visualization.generateDualTargetVisualization(target2, null, topSolvents);
        }
    }

    async searchSingleSolvents(deltaD, deltaP, deltaH, radius, bpMin, bpMax, costMin, costMax, wgkFilter) {
        const params = new URLSearchParams({
            target_delta_d: deltaD,
            target_delta_p: deltaP,
            target_delta_h: deltaH,
        });

        if (radius) params.append('target_radius', radius);
        if (bpMin) params.append('bp_min', bpMin);
        if (bpMax) params.append('bp_max', bpMax);
        if (costMin) params.append('cost_min', costMin);
        if (costMax) params.append('cost_max', costMax);

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
                case 'cost':
                    if (searchMode === 'single') {
                        return (a.cost || 999) - (b.cost || 999);
                    }
                    return 0; // Blend mode doesn't have cost
                default:
                    return 0;
            }
        });

        this.displayResults(searchMode);
    }

    displayResults(searchMode) {
        const resultsList = document.querySelector('#search-results-list');

        if (this.searchResults.length === 0) {
            resultsList.innerHTML = `
                <div class="empty-state">
                    <p>No solvents found matching your criteria.</p>
                    <p>Try adjusting the search radius or removing some filters.</p>
                </div>
            `;
            return;
        }

        if (searchMode === 'single') {
            resultsList.innerHTML = this.searchResults.map(solvent => this.createSolventCardHTML(solvent)).join('');
        } else {
            resultsList.innerHTML = this.searchResults.map(blend => this.createBlendCardHTML(blend)).join('');
        }
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
                        ${solvent.cost !== null ? `<span>Cost: $${solvent.cost.toFixed(3)}/mL</span>` : ''}
                        ${solvent.wgk ? `<span>WGK: ${solvent.wgk}</span>` : ''}
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
        const resultsList = document.querySelector('#search-results-list');
        resultsList.innerHTML = `
            <div class="empty-state error">
                <p style="color: #ef4444;">❌ ${message}</p>
            </div>
        `;
    }

    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('solvent-search')) {
        window.solventSearch = new SolventSearch();
    }
});

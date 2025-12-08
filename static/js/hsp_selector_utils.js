/**
 * HSP Selector Utilities
 * Shared utilities for reducing duplication in polymer/solvent target selection
 * Used by: Solvent Search, HSP Calculation (Optimize mode)
 */

const HSPSelectorUtils = {
    /**
     * Generate autocomplete selector HTML for polymer or solvent selection
     * @param {Object} config - Configuration object
     * @param {string} config.inputId - Input element ID
     * @param {string} config.datalistId - Datalist element ID
     * @param {string} config.displayId - Display container ID
     * @param {string} config.placeholder - Input placeholder text
     * @param {Array<string>} config.dataOptions - Available options for datalist
     * @param {boolean} [config.includeR0=true] - Whether to include R0 field
     * @param {string} [config.displayIdPrefix] - Prefix for display cell IDs (default: displayId)
     * @returns {string} HTML string
     */
    generateSelectorHTML(config) {
        const {
            inputId,
            datalistId,
            displayId,
            placeholder,
            dataOptions,
            includeR0 = true,
            displayIdPrefix = null
        } = config;

        const prefix = displayIdPrefix || displayId;
        const r0Header = includeR0 ? '<div>R0 (MPa<sup>0.5</sup>)</div>' : '';
        const r0Cell = includeR0 ? `<div id="${prefix}-r0" class="hsp-cell">-</div>` : '';

        return `
            <div class="target-solute-search">
                <input type="text"
                       id="${inputId}"
                       class="solute-search-input"
                       placeholder="${placeholder}"
                       list="${datalistId}"
                       autocomplete="off">
                <datalist id="${datalistId}">
                    ${dataOptions.map(name => `<option value="${name}">`).join('')}
                </datalist>
                <div id="${displayId}" class="solute-hsp-display" style="display: none;">
                    <div class="selected-name-row" id="${prefix}-name-row" style="margin-bottom: 0.5rem; display: none;">
                        <span class="selected-name" id="${prefix}-name"></span>
                        <span class="name-icons" id="${prefix}-icons"></span>
                    </div>
                    <div class="hsp-header">
                        <div>&delta;D (MPa<sup>0.5</sup>)</div>
                        <div>&delta;P (MPa<sup>0.5</sup>)</div>
                        <div>&delta;H (MPa<sup>0.5</sup>)</div>
                        ${r0Header}
                    </div>
                    <div class="hsp-values-row">
                        <div id="${prefix}-dd" class="hsp-cell">-</div>
                        <div id="${prefix}-dp" class="hsp-cell">-</div>
                        <div id="${prefix}-dh" class="hsp-cell">-</div>
                        ${r0Cell}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Generate custom HSP input HTML
     * @param {Object} config - Configuration object
     * @param {string} config.idPrefix - Prefix for input element IDs
     * @param {boolean} [config.includeR0=true] - Whether to include R0 field
     * @param {boolean} [config.includeName=false] - Whether to include name field
     * @returns {string} HTML string
     */
    generateCustomHTML(config) {
        const { idPrefix, includeR0 = true, includeName = false } = config;

        const nameField = includeName ? `
            <div class="inline-input-group">
                <label>Name:</label>
                <input type="text" class="name-input" id="${idPrefix}-name" placeholder="Sample">
            </div>
        ` : '';

        const r0Field = includeR0 ? `
            <div class="inline-input-group">
                <label>R0:</label>
                <input type="number" id="${idPrefix}-r0" step="0.1" placeholder="5.0" value="5.0">
            </div>
        ` : '';

        return `
            <div class="target-manual-inline">
                ${nameField}
                <div class="inline-input-group">
                    <label>δD:</label>
                    <input type="number" id="${idPrefix}-delta-d" step="0.1" placeholder="15.5">
                </div>
                <div class="inline-input-group">
                    <label>δP:</label>
                    <input type="number" id="${idPrefix}-delta-p" step="0.1" placeholder="7.0">
                </div>
                <div class="inline-input-group">
                    <label>δH:</label>
                    <input type="number" id="${idPrefix}-delta-h" step="0.1" placeholder="8.0">
                </div>
                ${r0Field}
            </div>
        `;
    },

    /**
     * Attach debounced input listeners to an autocomplete input
     * @param {string} inputId - Input element ID
     * @param {Function} onUpdate - Callback function to execute
     * @param {Object} [options] - Options
     * @param {number} [options.debounceDelay=500] - Debounce delay in ms
     * @param {Function} [options.onInput] - Additional callback on input (before debounce)
     */
    attachDebouncedListener(inputId, onUpdate, options = {}) {
        const { debounceDelay = 500, onInput = null } = options;
        const input = document.getElementById(inputId);
        if (!input) return;

        let debounceTimer;
        input.addEventListener('input', () => {
            if (onInput) onInput();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(onUpdate, debounceDelay);
        });

        input.addEventListener('blur', () => {
            clearTimeout(debounceTimer);
            onUpdate();
        });
    },

    /**
     * Attach input listeners to custom HSP fields for validation
     * @param {string} idPrefix - Prefix for input element IDs
     * @param {Function} onInput - Callback function to execute on input
     */
    attachCustomInputListeners(idPrefix, onInput) {
        ['delta-d', 'delta-p', 'delta-h'].forEach(param => {
            const input = document.getElementById(`${idPrefix}-${param}`);
            if (input) {
                input.addEventListener('input', onInput);
            }
        });
    },

    /**
     * Lookup polymer HSP from experimental results or API
     * @param {string} name - Polymer name
     * @returns {Promise<Object|null>} HSP data or null if not found
     */
    async lookupPolymerHSP(name) {
        if (!name || !name.trim()) return null;

        // Check experimental results first
        const allResults = window.experimentalResultsManager?.getExperimentalResults() || [];
        const expResult = allResults.find(r => r.sample_name === name.trim());

        if (expResult) {
            return {
                delta_d: expResult.hsp_result.delta_d,
                delta_p: expResult.hsp_result.delta_p,
                delta_h: expResult.hsp_result.delta_h,
                r0: expResult.hsp_result.radius,
                source_url: null,  // Experimental results don't have source URL
                name: name.trim()
            };
        }

        // Fetch from polymer API
        try {
            const response = await fetch(`/api/polymer-data/polymer/${encodeURIComponent(name.trim())}`);
            if (response.ok) {
                const data = await response.json();
                return {
                    delta_d: data.delta_d,
                    delta_p: data.delta_p,
                    delta_h: data.delta_h,
                    r0: data.ra,
                    source_url: data.source_url || null,
                    name: name.trim()
                };
            }
        } catch (error) {
            console.error('Error fetching polymer data:', error);
        }

        return null;
    },

    /**
     * Lookup solvent HSP from cache
     * @param {string} name - Solvent name
     * @returns {Promise<Object|null>} HSP data or null if not found
     */
    async lookupSolventHSP(name) {
        if (!name || !name.trim()) return null;

        const solventData = window.sharedSolventCache?.get(name.trim());
        if (solventData) {
            return {
                delta_d: solventData.delta_d,
                delta_p: solventData.delta_p,
                delta_h: solventData.delta_h,
                r0: null,  // Solvents typically don't have R0
                source_url: solventData.source_url || null,
                name: name.trim()
            };
        }
        return null;
    },

    /**
     * Display HSP values in DOM
     * @param {string} displayId - Display container ID
     * @param {Object} hspData - HSP data object
     * @param {Object} [options] - Options
     * @param {boolean} [options.includeR0=true] - Whether to display R0
     * @param {string} [options.cellIdPrefix] - Prefix for cell IDs (default: displayId)
     */
    displayHSP(displayId, hspData, options = {}) {
        const { includeR0 = true, cellIdPrefix = null } = options;
        const displayDiv = document.getElementById(displayId);
        if (!displayDiv) return;

        const prefix = cellIdPrefix || displayId;

        // Display name with icons if available
        if (hspData.name) {
            const nameRow = document.getElementById(`${prefix}-name-row`);
            const nameSpan = document.getElementById(`${prefix}-name`);
            const iconsSpan = document.getElementById(`${prefix}-icons`);

            if (nameRow && nameSpan && iconsSpan) {
                // Hide name text to avoid duplication with input field
                nameSpan.style.display = 'none';

                // Build icons HTML
                let iconsHTML = '';
                if (hspData.source_url) {
                    iconsHTML += `<a href="${hspData.source_url}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View data source"
                                    class="source-link-icon">🔗</a>`;
                }
                // Always show Google search
                const googleQuery = encodeURIComponent(hspData.name + ' polymer HSP');
                iconsHTML += `<a href="https://www.google.com/search?q=${googleQuery}"
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Search on Google"
                                class="google-search-icon">🔍</a>`;

                iconsSpan.innerHTML = iconsHTML;
                nameRow.style.display = 'block';
            }
        }

        const ddCell = document.getElementById(`${prefix}-dd`);
        const dpCell = document.getElementById(`${prefix}-dp`);
        const dhCell = document.getElementById(`${prefix}-dh`);

        if (ddCell) ddCell.textContent = hspData.delta_d.toFixed(1);
        if (dpCell) dpCell.textContent = hspData.delta_p.toFixed(1);
        if (dhCell) dhCell.textContent = hspData.delta_h.toFixed(1);

        if (includeR0 && hspData.r0 !== null && hspData.r0 !== undefined) {
            const r0Cell = document.getElementById(`${prefix}-r0`);
            if (r0Cell) r0Cell.textContent = hspData.r0.toFixed(1);
        }

        displayDiv.style.display = 'block';
    },

    /**
     * Hide HSP display
     * @param {string} displayId - Display container ID
     */
    hideDisplay(displayId) {
        const displayDiv = document.getElementById(displayId);
        if (displayDiv) displayDiv.style.display = 'none';
    },

    /**
     * Generic HSP update handler (combines lookup and display)
     * @param {Object} config - Configuration object
     * @param {string} config.inputId - Input element ID
     * @param {string} config.displayId - Display container ID
     * @param {string} config.mode - 'polymer' or 'solvent'
     * @param {Object} [config.displayOptions] - Options for displayHSP
     * @returns {Promise<Object|null>} HSP data or null
     */
    async updateHSPDisplay(config) {
        const { inputId, displayId, mode, displayOptions = {} } = config;

        const input = document.getElementById(inputId);
        const name = input?.value.trim();

        if (!name) {
            this.hideDisplay(displayId);
            return null;
        }

        let hspData = null;
        if (mode === 'polymer') {
            hspData = await this.lookupPolymerHSP(name);
        } else if (mode === 'solvent') {
            hspData = await this.lookupSolventHSP(name);
        }

        if (hspData) {
            this.displayHSP(displayId, hspData, displayOptions);
        } else {
            this.hideDisplay(displayId);
        }

        return hspData;
    }
};

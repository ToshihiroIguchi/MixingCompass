/**
 * SMILES Prediction Module
 * Handles prediction of HSP and boiling point from SMILES
 */

(function() {
    'use strict';

    // State
    let lastPrediction = null;

    // DOM Elements
    const elements = {
        smilesInput: null,
        predictBtn: null,
        clearBtn: null,
        resultsSection: null,
        errorSection: null,
        errorMessage: null,
        predDd: null,
        predDp: null,
        predDh: null,
        predTv: null,
        predFormula: null,
        predCho: null,
        solventNameInput: null,
        saveBtn: null,
        copyBtn: null
    };

    /**
     * Initialize the module
     */
    function init() {
        // Get DOM elements
        elements.smilesInput = document.getElementById('smiles-input');
        elements.predictBtn = document.getElementById('predict-btn');
        elements.clearBtn = document.getElementById('clear-smiles-btn');
        elements.resultsSection = document.getElementById('prediction-results');
        elements.errorSection = document.getElementById('prediction-error');
        elements.errorMessage = document.getElementById('error-message');
        elements.predDd = document.getElementById('pred-dD');
        elements.predDp = document.getElementById('pred-dP');
        elements.predDh = document.getElementById('pred-dH');
        elements.predTv = document.getElementById('pred-Tv');
        elements.predFormula = document.getElementById('pred-formula');
        elements.predCho = document.getElementById('pred-cho');
        elements.solventNameInput = document.getElementById('solvent-name-input');
        elements.saveBtn = document.getElementById('save-prediction-btn');
        elements.copyBtn = document.getElementById('copy-prediction-btn');

        // Bind event listeners
        if (elements.predictBtn) {
            elements.predictBtn.addEventListener('click', handlePredict);
        }
        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', handleClear);
        }
        if (elements.smilesInput) {
            elements.smilesInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    handlePredict();
                }
            });
        }
        if (elements.solventNameInput) {
            elements.solventNameInput.addEventListener('input', updateSaveButtonState);
            elements.solventNameInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !elements.saveBtn.disabled) {
                    handleSave();
                }
            });
        }
        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', handleSave);
        }
        if (elements.copyBtn) {
            elements.copyBtn.addEventListener('click', handleCopyResults);
        }

        console.log('SMILES Prediction module initialized');
    }

    /**
     * Update save button state based on name input
     */
    function updateSaveButtonState() {
        if (elements.saveBtn && elements.solventNameInput) {
            const name = elements.solventNameInput.value.trim();
            elements.saveBtn.disabled = !name || !lastPrediction;
        }
    }

    /**
     * Handle prediction request
     */
    async function handlePredict() {
        const smiles = elements.smilesInput.value.trim();

        if (!smiles) {
            showError('Please enter a SMILES string');
            return;
        }

        // Show loading state
        elements.predictBtn.disabled = true;
        elements.predictBtn.textContent = 'Predicting...';
        hideError();
        hideResults();

        try {
            const response = await fetch('/api/predict/single', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ smiles: smiles })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Prediction failed');
            }

            if (!data.is_valid) {
                showError(data.error_message || 'Invalid SMILES or prediction failed');
                return;
            }

            // Store prediction and display results
            lastPrediction = data;
            displayResults(data);

        } catch (error) {
            console.error('Prediction error:', error);
            showError(error.message || 'Failed to connect to prediction service');
        } finally {
            elements.predictBtn.disabled = false;
            elements.predictBtn.textContent = 'Predict';
        }
    }

    /**
     * Display prediction results
     */
    function displayResults(data) {
        // HSP values
        elements.predDd.textContent = data.dD !== null ? data.dD.toFixed(2) : '-';
        elements.predDp.textContent = data.dP !== null ? data.dP.toFixed(2) : '-';
        elements.predDh.textContent = data.dH !== null ? data.dH.toFixed(2) : '-';
        elements.predTv.textContent = data.Tv !== null ? data.Tv.toFixed(1) : '-';

        // Molecular info
        if (elements.predFormula) {
            elements.predFormula.textContent = data.molecular_formula || '-';
        }

        // CHO badge
        if (elements.predCho) {
            if (data.CHO === true) {
                elements.predCho.textContent = 'CHO';
                elements.predCho.className = 'cho-badge cho-true';
                elements.predCho.title = 'Contains only Carbon, Hydrogen, and Oxygen';
            } else if (data.CHO === false) {
                elements.predCho.textContent = 'Non-CHO';
                elements.predCho.className = 'cho-badge cho-false';
                elements.predCho.title = 'Contains elements other than C, H, O';
            } else {
                elements.predCho.textContent = '-';
                elements.predCho.className = 'cho-badge';
                elements.predCho.title = '';
            }
        }

        // Reset and enable save section
        if (elements.solventNameInput) {
            elements.solventNameInput.value = '';
        }
        updateSaveButtonState();

        elements.resultsSection.style.display = 'block';

        // Animate the results
        elements.resultsSection.classList.add('fade-in');
        setTimeout(() => {
            elements.resultsSection.classList.remove('fade-in');
        }, 500);
    }

    /**
     * Handle clear button
     */
    function handleClear() {
        elements.smilesInput.value = '';
        if (elements.solventNameInput) {
            elements.solventNameInput.value = '';
        }
        hideResults();
        hideError();
        lastPrediction = null;
        updateSaveButtonState();
    }

    /**
     * Show error message
     */
    function showError(message) {
        elements.errorMessage.textContent = message;
        elements.errorSection.style.display = 'block';
        hideResults();
    }

    /**
     * Hide error message
     */
    function hideError() {
        elements.errorSection.style.display = 'none';
    }

    /**
     * Hide results section
     */
    function hideResults() {
        elements.resultsSection.style.display = 'none';
    }

    /**
     * Save prediction to user solvents database
     */
    function handleSave() {
        if (!lastPrediction) return;

        const solventName = elements.solventNameInput.value.trim();
        if (!solventName) {
            if (window.showNotification) {
                window.showNotification('Please enter a solvent name', 'error');
            }
            return;
        }

        // Calculate delta_total
        const deltaTotal = Math.sqrt(
            (lastPrediction.dD || 0) ** 2 +
            (lastPrediction.dP || 0) ** 2 +
            (lastPrediction.dH || 0) ** 2
        );

        // Prepare solvent data for userSolventsManager
        const solventData = {
            name: solventName,
            delta_d: lastPrediction.dD,
            delta_p: lastPrediction.dP,
            delta_h: lastPrediction.dH,
            delta_total: deltaTotal,
            boiling_point: lastPrediction.Tv,
            smiles: lastPrediction.smiles,
            molecular_formula: lastPrediction.molecular_formula,
            cho: lastPrediction.CHO,
            source: 'ML Prediction'
        };

        // Use userSolventsManager
        if (window.userSolventsManager) {
            const success = window.userSolventsManager.addSolvent(solventData);

            if (success) {
                if (window.showNotification) {
                    window.showNotification(`"${solventName}" saved to User Solvents`, 'success');
                }
                elements.solventNameInput.value = '';
                updateSaveButtonState();

                // Dispatch event for other modules to refresh
                window.dispatchEvent(new CustomEvent('userSolventsUpdated'));
            } else {
                if (window.showNotification) {
                    window.showNotification(`A solvent named "${solventName}" already exists`, 'error');
                }
            }
        } else {
            // Fallback: Store in localStorage directly
            const storageKey = 'user_added_solvents';
            const userSolvents = JSON.parse(localStorage.getItem(storageKey) || '[]');

            // Check for duplicate
            const exists = userSolvents.some(s =>
                s.name.toLowerCase() === solventName.toLowerCase()
            );

            if (exists) {
                if (window.showNotification) {
                    window.showNotification(`A solvent named "${solventName}" already exists`, 'error');
                }
                return;
            }

            userSolvents.push({
                ...solventData,
                added_at: new Date().toISOString()
            });
            localStorage.setItem(storageKey, JSON.stringify(userSolvents));

            if (window.showNotification) {
                window.showNotification(`"${solventName}" saved to User Solvents`, 'success');
            }
            elements.solventNameInput.value = '';
            updateSaveButtonState();

            // Dispatch event for other modules to refresh
            window.dispatchEvent(new CustomEvent('userSolventsUpdated'));
        }
    }

    /**
     * Copy results to clipboard
     */
    function handleCopyResults() {
        if (!lastPrediction) return;

        const lines = [
            `SMILES: ${lastPrediction.smiles}`,
            `Formula: ${lastPrediction.molecular_formula || '-'}`,
            `CHO: ${lastPrediction.CHO === true ? 'Yes' : lastPrediction.CHO === false ? 'No' : '-'}`,
            `dD: ${lastPrediction.dD} MPa^0.5`,
            `dP: ${lastPrediction.dP} MPa^0.5`,
            `dH: ${lastPrediction.dH} MPa^0.5`,
            `Tv: ${lastPrediction.Tv} C`
        ];

        const text = lines.join('\n');

        navigator.clipboard.writeText(text).then(() => {
            if (window.showNotification) {
                window.showNotification('Results copied to clipboard', 'success');
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            if (window.showNotification) {
                window.showNotification('Results copied to clipboard', 'success');
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for external use
    window.smilesPredict = {
        predict: handlePredict,
        clear: handleClear,
        getLastPrediction: () => lastPrediction
    };

})();

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
        addToDbBtn: null,
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
        elements.addToDbBtn = document.getElementById('add-to-database-btn');
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
        if (elements.addToDbBtn) {
            elements.addToDbBtn.addEventListener('click', handleAddToDatabase);
        }
        if (elements.copyBtn) {
            elements.copyBtn.addEventListener('click', handleCopyResults);
        }

        console.log('SMILES Prediction module initialized');
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
        elements.predDd.textContent = data.dD !== null ? data.dD.toFixed(2) : '-';
        elements.predDp.textContent = data.dP !== null ? data.dP.toFixed(2) : '-';
        elements.predDh.textContent = data.dH !== null ? data.dH.toFixed(2) : '-';
        elements.predTv.textContent = data.Tv !== null ? data.Tv.toFixed(1) : '-';

        elements.resultsSection.style.display = 'block';
        elements.addToDbBtn.disabled = false;

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
        hideResults();
        hideError();
        lastPrediction = null;
        elements.addToDbBtn.disabled = true;
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
     * Add prediction to user solvents database
     */
    function handleAddToDatabase() {
        if (!lastPrediction) return;

        // Prompt for solvent name
        const solventName = prompt('Enter a name for this solvent:', 'Custom Solvent');
        if (!solventName) return;

        // Use the user_solvents module if available
        if (window.userSolvents && typeof window.userSolvents.addSolvent === 'function') {
            window.userSolvents.addSolvent({
                Solvent: solventName,
                dD: lastPrediction.dD,
                dP: lastPrediction.dP,
                dH: lastPrediction.dH,
                'Tv': lastPrediction.Tv,
                Smiles: lastPrediction.smiles,
                Source: 'ML Prediction'
            });

            if (window.showNotification) {
                window.showNotification('Solvent added to user database', 'success');
            } else {
                alert('Solvent added to user database');
            }
        } else {
            // Fallback: Store in localStorage directly
            const userSolvents = JSON.parse(localStorage.getItem('userSolvents') || '[]');
            userSolvents.push({
                id: Date.now(),
                Solvent: solventName,
                dD: lastPrediction.dD,
                dP: lastPrediction.dP,
                dH: lastPrediction.dH,
                'Tv': lastPrediction.Tv,
                Smiles: lastPrediction.smiles,
                Source: 'ML Prediction'
            });
            localStorage.setItem('userSolvents', JSON.stringify(userSolvents));
            alert('Solvent added to user database');
        }
    }

    /**
     * Copy results to clipboard
     */
    function handleCopyResults() {
        if (!lastPrediction) return;

        const text = [
            `SMILES: ${lastPrediction.smiles}`,
            `dD: ${lastPrediction.dD} MPa^0.5`,
            `dP: ${lastPrediction.dP} MPa^0.5`,
            `dH: ${lastPrediction.dH} MPa^0.5`,
            `Tv: ${lastPrediction.Tv} C`
        ].join('\n');

        navigator.clipboard.writeText(text).then(() => {
            if (window.showNotification) {
                window.showNotification('Results copied to clipboard', 'success');
            } else {
                alert('Results copied to clipboard');
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
            alert('Results copied to clipboard');
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

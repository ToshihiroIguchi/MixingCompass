// HSP Visualization Module
// Shared visualization logic for Hansen Sphere rendering using Plotly

class HSPVisualization {
    constructor(containerId) {
        this.containerId = containerId;
        this.plotlyConfig = null;
        this.projections2D = null;
    }

    /**
     * Display 3D Plotly visualization
     */
    displayPlotly3D(plotlyConfig) {
        const container = document.querySelector(`#${this.containerId}`);
        if (!container) {
            console.error(`Container #${this.containerId} not found`);
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Create Plotly plot div
        const plotDiv = document.createElement('div');
        plotDiv.style.width = '100%';
        plotDiv.style.height = '100%';
        container.appendChild(plotDiv);

        // Configure Plotly (matching HSP Experimental settings)
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['autoScale2d', 'resetScale2d'],
            displaylogo: false,
            toImageButtonOptions: {
                format: 'png',
                filename: 'hansen_sphere',
                height: 600,
                width: 800,
                scale: 1
            }
        };

        // Create plot
        Plotly.newPlot(plotDiv, plotlyConfig.data, plotlyConfig.layout, config);

        // Store config
        this.plotlyConfig = plotlyConfig;
    }

    /**
     * Render 2D projections
     */
    render2DProjections(projections, containerPrefix = '') {
        if (!projections) {
            console.warn('No projections data provided');
            return;
        }

        const ddDpId = containerPrefix ? `${containerPrefix}-plot-dd-dp` : 'plot-dd-dp';
        const ddDhId = containerPrefix ? `${containerPrefix}-plot-dd-dh` : 'plot-dd-dh';
        const dpDhId = containerPrefix ? `${containerPrefix}-plot-dp-dh` : 'plot-dp-dh';

        // Render δD vs δP
        if (projections.dd_dp) {
            const element = document.getElementById(ddDpId);
            if (element) {
                const layout = {...projections.dd_dp.layout, width: 240, height: 240};
                Plotly.newPlot(ddDpId, projections.dd_dp.data, layout, {
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false
                });
            }
        }

        // Render δD vs δH
        if (projections.dd_dh) {
            const element = document.getElementById(ddDhId);
            if (element) {
                const layout = {...projections.dd_dh.layout, width: 240, height: 240};
                Plotly.newPlot(ddDhId, projections.dd_dh.data, layout, {
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false
                });
            }
        }

        // Render δP vs δH
        if (projections.dp_dh) {
            const element = document.getElementById(dpDhId);
            if (element) {
                const layout = {...projections.dp_dh.layout, width: 240, height: 240};
                Plotly.newPlot(dpDhId, projections.dp_dh.data, layout, {
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false
                });
            }
        }

        // Store projections
        this.projections2D = projections;
    }

    /**
     * Show visualization error message
     */
    showError(message) {
        const container = document.querySelector(`#${this.containerId}`);
        if (!container) return;

        container.innerHTML = `
            <div class="visualization-placeholder">
                <p style="color: #ef4444;">❌ Visualization Error</p>
                <small>${message}</small>
                <br><br>
                <small>Please ensure data is available</small>
            </div>
        `;
    }

    /**
     * Show placeholder message
     */
    showPlaceholder(message = 'Visualization will appear here') {
        const container = document.querySelector(`#${this.containerId}`);
        if (!container) return;

        container.innerHTML = `
            <div class="visualization-placeholder">
                <p>${message}</p>
                <small>Configure targets and search solvents to display visualization</small>
            </div>
        `;
    }

    /**
     * Clear visualization
     */
    clear() {
        this.showPlaceholder();
        this.plotlyConfig = null;
        this.projections2D = null;
    }

    /**
     * Generate client-side Hansen sphere visualization for two targets
     * This creates a simplified visualization without backend API calls
     */
    generateDualTargetVisualization(target1Data, target2Data, solventData = []) {
        // Generate sphere coordinates for both targets
        const sphere1 = this.generateSphereCoordinates(
            [target1Data.delta_d, target1Data.delta_p, target1Data.delta_h],
            target1Data.radius
        );

        const sphere2 = target2Data ? this.generateSphereCoordinates(
            [target2Data.delta_d, target2Data.delta_p, target2Data.delta_h],
            target2Data.radius
        ) : null;

        // Calculate axis ranges
        const allValues = [
            target1Data.delta_d, target1Data.delta_p, target1Data.delta_h,
            target1Data.delta_d + target1Data.radius,
            target1Data.delta_p + target1Data.radius,
            target1Data.delta_h + target1Data.radius
        ];

        if (target2Data) {
            allValues.push(
                target2Data.delta_d, target2Data.delta_p, target2Data.delta_h,
                target2Data.delta_d + target2Data.radius,
                target2Data.delta_p + target2Data.radius,
                target2Data.delta_h + target2Data.radius
            );
        }

        // Add solvent coordinates
        if (solventData && solventData.length > 0) {
            solventData.forEach(s => {
                allValues.push(s.delta_d, s.delta_p, s.delta_h);
            });
        }

        const maxVal = Math.max(...allValues);
        const xRange = [Math.max(0, Math.min(...allValues.filter((_, i) => i % 3 === 0)) - 2), Math.min(25, maxVal + 2)];
        const yRange = [0, Math.min(30, maxVal + 2)];
        const zRange = [0, Math.min(30, maxVal + 2)];

        // Build traces
        const traces = [];

        // Target 1 sphere (blue)
        traces.push({
            type: 'surface',
            x: sphere1.x,
            y: sphere1.y,
            z: sphere1.z,
            name: target1Data.name || 'Target 1',
            opacity: 0.35,
            colorscale: [[0, 'rgba(33, 150, 243, 0.3)'], [1, 'rgba(33, 150, 243, 0.3)']],
            showscale: false,
            hovertemplate: `<b>${target1Data.name || 'Target 1'}</b><br>Center: (${target1Data.delta_d.toFixed(1)}, ${target1Data.delta_p.toFixed(1)}, ${target1Data.delta_h.toFixed(1)})<br>R0: ${target1Data.radius.toFixed(1)}<extra></extra>`
        });

        // Target 1 center
        traces.push({
            type: 'scatter3d',
            mode: 'markers',
            x: [target1Data.delta_d],
            y: [target1Data.delta_p],
            z: [target1Data.delta_h],
            name: `${target1Data.name || 'Target 1'} Center`,
            showlegend: false,
            marker: {
                size: 5,
                color: '#2196F3',
                symbol: 'circle',
                opacity: 1.0,
                line: { width: 1, color: 'rgba(33, 150, 243, 0.8)' }
            },
            hovertemplate: `<b>${target1Data.name || 'Target 1'} Center</b><br>δD: ${target1Data.delta_d.toFixed(1)}<br>δP: ${target1Data.delta_p.toFixed(1)}<br>δH: ${target1Data.delta_h.toFixed(1)}<br>R0: ${target1Data.radius.toFixed(1)}<extra></extra>`
        });

        // Target 2 sphere and center (orange) if provided
        if (sphere2 && target2Data) {
            traces.push({
                type: 'surface',
                x: sphere2.x,
                y: sphere2.y,
                z: sphere2.z,
                name: target2Data.name || 'Target 2',
                opacity: 0.35,
                colorscale: [[0, 'rgba(255, 152, 0, 0.3)'], [1, 'rgba(255, 152, 0, 0.3)']],
                showscale: false,
                hovertemplate: `<b>${target2Data.name || 'Target 2'}</b><br>Center: (${target2Data.delta_d.toFixed(1)}, ${target2Data.delta_p.toFixed(1)}, ${target2Data.delta_h.toFixed(1)})<br>R0: ${target2Data.radius.toFixed(1)}<extra></extra>`
            });

            traces.push({
                type: 'scatter3d',
                mode: 'markers',
                x: [target2Data.delta_d],
                y: [target2Data.delta_p],
                z: [target2Data.delta_h],
                name: `${target2Data.name || 'Target 2'} Center`,
                showlegend: false,
                marker: {
                    size: 5,
                    color: '#FF9800',
                    symbol: 'circle',
                    opacity: 1.0,
                    line: { width: 1, color: 'rgba(255, 152, 0, 0.8)' }
                },
                hovertemplate: `<b>${target2Data.name || 'Target 2'} Center</b><br>δD: ${target2Data.delta_d.toFixed(1)}<br>δP: ${target2Data.delta_p.toFixed(1)}<br>δH: ${target2Data.delta_h.toFixed(1)}<br>R0: ${target2Data.radius.toFixed(1)}<extra></extra>`
            });
        }

        // Add solvent points if provided
        if (solventData && solventData.length > 0) {
            const solventX = [];
            const solventY = [];
            const solventZ = [];
            const solventHoverTexts = [];

            solventData.forEach(s => {
                solventX.push(s.delta_d);
                solventY.push(s.delta_p);
                solventZ.push(s.delta_h);

                // Calculate RED for both targets
                const red1 = this.calculateDistance(
                    s.delta_d, s.delta_p, s.delta_h,
                    target1Data.delta_d, target1Data.delta_p, target1Data.delta_h
                ) / target1Data.radius;

                const red2 = target2Data ? this.calculateDistance(
                    s.delta_d, s.delta_p, s.delta_h,
                    target2Data.delta_d, target2Data.delta_p, target2Data.delta_h
                ) / target2Data.radius : null;

                // Build hover text with RED values
                let hoverText = `<b>${s.name}</b><br>` +
                    `δD: ${s.delta_d.toFixed(1)}<br>` +
                    `δP: ${s.delta_p.toFixed(1)}<br>` +
                    `δH: ${s.delta_h.toFixed(1)}<br>` +
                    `RED (${target1Data.name || 'Target 1'}): ${red1.toFixed(2)}`;

                if (red2 !== null) {
                    hoverText += `<br>RED (${target2Data.name || 'Target 2'}): ${red2.toFixed(2)}`;
                }

                solventHoverTexts.push(hoverText);
            });

            traces.push({
                type: 'scatter3d',
                mode: 'markers',
                x: solventX,
                y: solventY,
                z: solventZ,
                name: 'Solvents',
                showlegend: false,
                marker: {
                    size: 3,
                    color: '#9E9E9E',  // Neutral gray color for all solvents
                    opacity: 0.8
                },
                hovertext: solventHoverTexts,
                hovertemplate: '%{hovertext}<extra></extra>'
            });
        }

        // Layout
        const layout = {
            margin: {
                l: 0,
                r: 0,
                t: 0,
                b: 0
            },
            scene: {
                xaxis: {
                    title: { text: 'δD (Dispersion) [MPa<sup>0.5</sup>]', font: { size: 12 } },
                    range: xRange
                },
                yaxis: {
                    title: { text: 'δP (Polarity) [MPa<sup>0.5</sup>]', font: { size: 12 } },
                    range: yRange
                },
                zaxis: {
                    title: { text: 'δH (Hydrogen Bonding) [MPa<sup>0.5</sup>]', font: { size: 12 } },
                    range: zRange
                },
                camera: {
                    eye: { x: 1.25, y: 1.25, z: 1.25 }
                },
                aspectmode: 'cube'
            },
            showlegend: true,
            legend: {
                x: 0.02,
                y: 0.98,
                bgcolor: 'rgba(255,255,255,0.95)',
                bordercolor: 'rgba(0,0,0,0.2)',
                borderwidth: 1
            }
        };

        this.displayPlotly3D({ data: traces, layout: layout });
    }

    /**
     * Generate Hansen sphere coordinates (ellipsoid in Euclidean space)
     */
    generateSphereCoordinates(center, radius, resolution = 20) {
        const u = [];
        const v = [];
        for (let i = 0; i < resolution; i++) {
            u.push(2 * Math.PI * i / (resolution - 1));
        }
        for (let i = 0; i < resolution; i++) {
            v.push(Math.PI * i / (resolution - 1));
        }

        const x = [];
        const y = [];
        const z = [];

        for (let i = 0; i < v.length; i++) {
            const xRow = [];
            const yRow = [];
            const zRow = [];
            for (let j = 0; j < u.length; j++) {
                // Hansen spheroid: δD has half radius due to factor of 4
                const xVal = Math.max(0, center[0] + (radius / 2) * Math.cos(u[j]) * Math.sin(v[i]));
                const yVal = Math.max(0, center[1] + radius * Math.sin(u[j]) * Math.sin(v[i]));
                const zVal = Math.max(0, center[2] + radius * Math.cos(v[i]));

                xRow.push(xVal);
                yRow.push(yVal);
                zRow.push(zVal);
            }
            x.push(xRow);
            y.push(yRow);
            z.push(zRow);
        }

        return { x, y, z };
    }

    /**
     * Calculate Hansen distance between two points
     */
    calculateDistance(d1, p1, h1, d2, p2, h2) {
        return Math.sqrt(4 * Math.pow(d1 - d2, 2) + Math.pow(p1 - p2, 2) + Math.pow(h1 - h2, 2));
    }
}

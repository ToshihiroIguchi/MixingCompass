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
     * Render 2D projections using plotly subplots
     */
    render2DProjections(projections, containerPrefix = '') {
        if (!projections) {
            console.warn('No projections data provided');
            return;
        }

        // Use different container ID based on prefix
        const containerId = containerPrefix ? `${containerPrefix}-plot-2d-subplots` : 'plot-2d-subplots';
        const element = document.getElementById(containerId);

        if (!element) {
            console.warn(`Container #${containerId} not found`);
            return;
        }

        // Prepare all traces with subplot assignments
        // Draw lines (ellipses) first, then markers (points) so points appear on top
        const allTraces = [];
        const lineTraces = [];
        const markerTraces = [];

        // δD vs δP (subplot 1)
        if (projections.dd_dp) {
            projections.dd_dp.data.forEach(trace => {
                const newTrace = {...trace, xaxis: 'x', yaxis: 'y'};
                if (trace.mode === 'lines' || trace.type === 'scatter' && !trace.mode?.includes('markers')) {
                    lineTraces.push(newTrace);
                } else {
                    markerTraces.push(newTrace);
                }
            });
        }

        // δD vs δH (subplot 2)
        if (projections.dd_dh) {
            projections.dd_dh.data.forEach(trace => {
                const newTrace = {...trace, xaxis: 'x2', yaxis: 'y2'};
                if (trace.mode === 'lines' || trace.type === 'scatter' && !trace.mode?.includes('markers')) {
                    lineTraces.push(newTrace);
                } else {
                    markerTraces.push(newTrace);
                }
            });
        }

        // δP vs δH (subplot 3)
        if (projections.dp_dh) {
            projections.dp_dh.data.forEach(trace => {
                const newTrace = {...trace, xaxis: 'x3', yaxis: 'y3'};
                if (trace.mode === 'lines' || trace.type === 'scatter' && !trace.mode?.includes('markers')) {
                    lineTraces.push(newTrace);
                } else {
                    markerTraces.push(newTrace);
                }
            });
        }

        // Add line traces first, then marker traces
        allTraces.push(...lineTraces, ...markerTraces);

        // Calculate max values for each axis from data
        const getMaxFromTraces = (traces, axis) => {
            let max = 0;
            traces.forEach(trace => {
                if (trace[axis] && Array.isArray(trace[axis])) {
                    const traceMax = Math.max(...trace[axis]);
                    if (traceMax > max) max = traceMax;
                }
            });
            return max;
        };

        // Get max values for each parameter
        const maxD = Math.max(
            getMaxFromTraces(projections.dd_dp.data, 'x'),
            getMaxFromTraces(projections.dd_dh.data, 'x')
        );
        const maxP = Math.max(
            getMaxFromTraces(projections.dd_dp.data, 'y'),
            getMaxFromTraces(projections.dp_dh.data, 'x')
        );
        const maxH = Math.max(
            getMaxFromTraces(projections.dd_dh.data, 'y'),
            getMaxFromTraces(projections.dp_dh.data, 'y')
        );

        // Apply 1.1x margin to max values
        const rangeD = [0, maxD * 1.1];
        const rangeP = [0, maxP * 1.1];
        const rangeH = [0, maxH * 1.1];

        console.log('Calculated axis ranges:', {
            δD: rangeD,
            δP: rangeP,
            δH: rangeH
        });

        // Create layout with 3 subplots in a row
        const layout = {
            grid: {rows: 1, columns: 3, pattern: 'independent', subplots: [['xy'], ['x2y2'], ['x3y3']]},
            showlegend: false,
            margin: {l: 50, r: 50, t: 30, b: 50},

            // Subplot 1: δD vs δP
            xaxis: {
                range: rangeD,
                domain: [0, 0.28],
                title: {text: 'δD (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'y'
            },
            yaxis: {
                range: rangeP,
                domain: [0, 1],
                title: {text: 'δP (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'x'
            },

            // Subplot 2: δD vs δH
            xaxis2: {
                range: rangeD,
                domain: [0.37, 0.65],
                title: {text: 'δD (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'y2'
            },
            yaxis2: {
                range: rangeH,
                domain: [0, 1],
                title: {text: 'δH (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'x2'
            },

            // Subplot 3: δP vs δH
            xaxis3: {
                range: rangeP,
                domain: [0.72, 1],
                title: {text: 'δP (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'y3'
            },
            yaxis3: {
                range: rangeH,
                domain: [0, 1],
                title: {text: 'δH (MPa<sup>0.5</sup>)', font: {size: 11}},
                showticklabels: true,
                anchor: 'x3'
            }
        };

        // Render all subplots in one plot
        Plotly.newPlot(containerId, allTraces, layout, {
            responsive: true,
            displayModeBar: true,
            displaylogo: false
        });

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
        // Fixed axis ranges (same as HSP Experimental)
        // δD: 5-30 (covers wide range of solvents)
        // δP: 0-50 (covers highly polar solvents)
        // δH: 0-50 (covers strong hydrogen bonding solvents like water)
        const xRange = [5, 30];   // δD
        const yRange = [0, 50];   // δP
        const zRange = [0, 50];   // δH

        // Build traces
        const traces = [];

        // Target 1 sphere as wireframe (blue)
        traces.push(this.generateSphereWireframe(
            [target1Data.delta_d, target1Data.delta_p, target1Data.delta_h],
            target1Data.radius,
            'rgba(33, 150, 243, 0.8)',
            target1Data.name || 'Target 1'
        ));

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
                size: 3,
                color: '#2196F3',
                symbol: 'circle',
                opacity: 1.0,
                line: { width: 0.5, color: 'rgba(33, 150, 243, 0.8)' }
            },
            hovertemplate: `<b>${target1Data.name || 'Target 1'} Center</b><br>δD: ${target1Data.delta_d.toFixed(1)}<br>δP: ${target1Data.delta_p.toFixed(1)}<br>δH: ${target1Data.delta_h.toFixed(1)}<br>R0: ${target1Data.radius.toFixed(1)}<extra></extra>`
        });

        // Target 2 sphere and center (orange) if provided
        if (target2Data) {
            // Target 2 sphere as wireframe (orange)
            traces.push(this.generateSphereWireframe(
                [target2Data.delta_d, target2Data.delta_p, target2Data.delta_h],
                target2Data.radius,
                'rgba(255, 152, 0, 0.8)',
                target2Data.name || 'Target 2'
            ));

            // Target 2 center
            traces.push({
                type: 'scatter3d',
                mode: 'markers',
                x: [target2Data.delta_d],
                y: [target2Data.delta_p],
                z: [target2Data.delta_h],
                name: `${target2Data.name || 'Target 2'} Center`,
                showlegend: false,
                marker: {
                    size: 3,
                    color: '#FF9800',
                    symbol: 'circle',
                    opacity: 1.0,
                    line: { width: 0.5, color: 'rgba(255, 152, 0, 0.8)' }
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
            const solventColors = [];

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

                // Determine color based on RED values
                let color = '';
                if (target2Data) {
                    // Dual target mode
                    if (red1 < 1.0 && red2 < 1.0) {
                        color = '#4CAF50'; // Green - both targets
                    } else if (red1 < 1.0) {
                        color = '#2196F3'; // Blue - Target 1 only
                    } else if (red2 < 1.0) {
                        color = '#FF9800'; // Orange - Target 2 only
                    } else {
                        color = '#BDBDBD'; // Grey - neither target
                    }
                } else {
                    // Single target mode
                    color = red1 < 1.0 ? '#4CAF50' : '#BDBDBD';
                }
                solventColors.push(color);

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
                    size: 1.5,
                    color: solventColors,
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

        // Generate and render 2D projections
        const projections2D = this.generate2DProjections(target1Data, target2Data, solventData);
        if (projections2D) {
            // Use 'search' prefix for Solvent Search container IDs
            const containerPrefix = this.containerId.includes('search') ? 'search' : '';
            this.render2DProjections(projections2D, containerPrefix);
        }
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

    /**
     * Get color for solubility value using RdYlBu gradient (Red-Yellow-Blue)
     * Matches backend color scheme
     */
    getSolubilityColor(solubility) {
        // Convert categorical to numerical
        if (typeof solubility === 'string') {
            const valueMap = {
                'insoluble': 0.0,
                'partial': 0.5,
                'soluble': 1.0
            };
            // Use 'in' operator to avoid falsy 0.0 being replaced with default 0.5
            solubility = solubility in valueMap ? valueMap[solubility] : 0.5;
        }

        // Ensure numerical value in range [0, 1]
        if (typeof solubility !== 'number') {
            return '#666666';  // Default gray
        }

        solubility = Math.max(0.0, Math.min(1.0, solubility));

        // RdYlBu gradient: Red (0.0) -> Yellow (0.5) -> Blue (1.0)
        let r, g, b;
        if (solubility <= 0.5) {
            // Red to Yellow (0.0 to 0.5)
            const t = solubility * 2;  // Map 0-0.5 to 0-1
            r = 211;  // Red component stays high
            g = Math.floor(50 + (235 - 50) * t);  // Interpolate from #d32f2f red to #ffeb3b yellow
            b = Math.floor(47 + (59 - 47) * t);
        } else {
            // Yellow to Blue (0.5 to 1.0)
            const t = (solubility - 0.5) * 2;  // Map 0.5-1.0 to 0-1
            r = Math.floor(255 - (255 - 33) * t);  // Interpolate from #ffeb3b yellow to #2196f3 blue
            g = Math.floor(235 - (235 - 150) * t);
            b = Math.floor(59 + (243 - 59) * t);
        }

        // Convert to hex
        const toHex = (n) => {
            const hex = n.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    /**
     * Generate wireframe lines for Hansen sphere
     */
    generateSphereWireframe(center, radius, color, name) {
        const [center_d, center_p, center_h] = center;
        const r = radius;

        const sphere_lines_x = [];
        const sphere_lines_y = [];
        const sphere_lines_z = [];

        const n_lat = 20;  // latitude circles (increased from 12 for smoother appearance)
        const n_lon = 20;  // longitude lines (increased from 12 for smoother appearance)
        const n_points = 50;  // points per circle

        // Latitude circles (horizontal slices)
        for (let i = 0; i < n_lat; i++) {
            const phi = Math.PI * i / (n_lat - 1);
            for (let j = 0; j <= n_points; j++) {
                const theta = 2 * Math.PI * j / n_points;
                // Ellipsoid: δD has half radius
                const x = center_d + (r / 2) * Math.cos(theta) * Math.sin(phi);
                const y = center_p + r * Math.sin(theta) * Math.sin(phi);
                const z = center_h + r * Math.cos(phi);
                sphere_lines_x.push(x);
                sphere_lines_y.push(y);
                sphere_lines_z.push(z);
            }
            sphere_lines_x.push(null);  // Line break
            sphere_lines_y.push(null);
            sphere_lines_z.push(null);
        }

        // Longitude lines (vertical slices)
        for (let i = 0; i < n_lon; i++) {
            const theta = 2 * Math.PI * i / n_lon;
            for (let j = 0; j <= n_points; j++) {
                const phi = Math.PI * j / n_points;
                const x = center_d + (r / 2) * Math.cos(theta) * Math.sin(phi);
                const y = center_p + r * Math.sin(theta) * Math.sin(phi);
                const z = center_h + r * Math.cos(phi);
                sphere_lines_x.push(x);
                sphere_lines_y.push(y);
                sphere_lines_z.push(z);
            }
            sphere_lines_x.push(null);
            sphere_lines_y.push(null);
            sphere_lines_z.push(null);
        }

        return {
            type: 'scatter3d',
            mode: 'lines',
            x: sphere_lines_x,
            y: sphere_lines_y,
            z: sphere_lines_z,
            name: name,
            line: {
                color: color,
                width: 1.5
            },
            hoverinfo: 'skip',
            showlegend: true
        };
    }

    /**
     * Generate 2D projections for dual target visualization
     */
    generate2DProjections(target1Data, target2Data, solventData = []) {
        if (!target1Data) {
            console.warn('No target data provided for 2D projections');
            return null;
        }

        // Helper function to create ellipse points for target sphere projection
        // radiusX and radiusY allow for elliptical projections
        const createEllipsePoints = (centerX, centerY, radiusX, radiusY, numPoints = 100) => {
            const x = [];
            const y = [];
            for (let i = 0; i <= numPoints; i++) {
                const angle = (i / numPoints) * 2 * Math.PI;
                x.push(centerX + radiusX * Math.cos(angle));
                y.push(centerY + radiusY * Math.sin(angle));
            }
            return { x, y };
        };

        // Common layout configuration
        const createLayout = (xTitle, yTitle, xRange, yRange) => ({
            xaxis: {
                title: xTitle,
                range: xRange,
                showgrid: true,
                zeroline: false
            },
            yaxis: {
                title: yTitle,
                range: yRange,
                showgrid: true,
                zeroline: false
            },
            showlegend: true,
            legend: {
                x: 0.02,
                y: 0.98,
                bgcolor: 'rgba(255,255,255,0.9)',
                bordercolor: 'rgba(0,0,0,0.2)',
                borderwidth: 1,
                font: { size: 10 }
            },
            margin: { l: 50, r: 20, t: 20, b: 50 },
            hovermode: 'closest'
        });

        // Calculate axis ranges
        const allX = [target1Data.delta_d];
        const allY = [target1Data.delta_p, target1Data.delta_h];

        if (target2Data) {
            allX.push(target2Data.delta_d);
            allY.push(target2Data.delta_p, target2Data.delta_h);
        }

        solventData.forEach(s => {
            allX.push(s.delta_d);
            allY.push(s.delta_p, s.delta_h);
        });

        const xMin = Math.max(0, Math.min(...allX) - 3);
        const xMax = Math.max(...allX) + 3;
        const yMin = Math.max(0, Math.min(...allY) - 3);
        const yMax = Math.max(...allY) + 3;

        // δD vs δP projection
        const ddDpData = [];

        // Target 1 ellipse (δD has factor of 4 in Hansen distance, so radius is R0/2)
        const ellipse1_ddDp = createEllipsePoints(
            target1Data.delta_d,
            target1Data.delta_p,
            target1Data.radius / 2,  // δD direction: R0/2
            target1Data.radius        // δP direction: R0
        );
        ddDpData.push({
            type: 'scatter',
            mode: 'lines',
            x: ellipse1_ddDp.x,
            y: ellipse1_ddDp.y,
            name: target1Data.name || 'Target 1',
            line: { color: '#2196F3', width: 2 },
            fill: 'toself',
            fillcolor: 'rgba(33, 150, 243, 0.1)',
            hoverinfo: 'skip'
        });

        // Target 2 ellipse if provided
        if (target2Data) {
            const ellipse2_ddDp = createEllipsePoints(
                target2Data.delta_d,
                target2Data.delta_p,
                target2Data.radius / 2,  // δD direction: R0/2
                target2Data.radius        // δP direction: R0
            );
            ddDpData.push({
                type: 'scatter',
                mode: 'lines',
                x: ellipse2_ddDp.x,
                y: ellipse2_ddDp.y,
                name: target2Data.name || 'Target 2',
                line: { color: '#FF9800', width: 2 },
                fill: 'toself',
                fillcolor: 'rgba(255, 152, 0, 0.1)',
                hoverinfo: 'skip'
            });
        }

        // Solvent points
        if (solventData && solventData.length > 0) {
            const solventX = [];
            const solventY = [];
            const solventHoverTexts = [];
            const solventColors = [];

            solventData.forEach(s => {
                solventX.push(s.delta_d);
                solventY.push(s.delta_p);

                // Calculate RED values (needed for both coloring and hover text)
                const red1 = this.calculateDistance(
                    s.delta_d, s.delta_p, s.delta_h,
                    target1Data.delta_d, target1Data.delta_p, target1Data.delta_h
                ) / target1Data.radius;

                let red2 = null;
                if (target2Data) {
                    red2 = this.calculateDistance(
                        s.delta_d, s.delta_p, s.delta_h,
                        target2Data.delta_d, target2Data.delta_p, target2Data.delta_h
                    ) / target2Data.radius;
                }

                let color = '';

                // If solubility data is available, use it for coloring (matches 3D visualization)
                if (s.hasOwnProperty('solubility') && s.solubility !== undefined && s.solubility !== null) {
                    color = this.getSolubilityColor(s.solubility);
                } else {
                    // Otherwise, use RED-based coloring
                    if (target2Data) {
                        // Dual target color scheme
                        if (red1 < 1.0 && red2 < 1.0) {
                            color = '#4CAF50'; // Green - both targets
                        } else if (red1 < 1.0) {
                            color = '#2196F3'; // Blue - Target 1 only
                        } else if (red2 < 1.0) {
                            color = '#FF9800'; // Orange - Target 2 only
                        } else {
                            color = '#BDBDBD'; // Grey - neither target
                        }
                    } else {
                        // Single target color scheme
                        color = red1 < 1.0 ? '#4CAF50' : '#BDBDBD';
                    }
                }

                solventColors.push(color);

                // Build hover text
                let hoverText = `<b>${s.name}</b><br>δD: ${s.delta_d.toFixed(1)}<br>δP: ${s.delta_p.toFixed(1)}`;

                if (s.hasOwnProperty('solubility') && s.solubility !== undefined && s.solubility !== null) {
                    hoverText += `<br>Solubility: ${typeof s.solubility === 'number' ? s.solubility.toFixed(2) : s.solubility}`;
                } else {
                    hoverText += `<br>RED (${target1Data.name || 'Target 1'}): ${red1.toFixed(2)}`;
                    if (target2Data) {
                        hoverText += `<br>RED (${target2Data.name || 'Target 2'}): ${red2.toFixed(2)}`;
                    }
                }

                solventHoverTexts.push(hoverText);
            });

            ddDpData.push({
                type: 'scatter',
                mode: 'markers',
                x: solventX,
                y: solventY,
                name: 'Solvents',
                marker: { size: 6, color: solventColors, opacity: 0.7 },
                showlegend: false,
                hovertext: solventHoverTexts,
                hovertemplate: '%{hovertext}<extra></extra>'
            });
        }

        // Target centers (add last so they appear on top)
        ddDpData.push({
            type: 'scatter',
            mode: 'markers',
            x: [target1Data.delta_d],
            y: [target1Data.delta_p],
            name: `${target1Data.name || 'Target 1'} Center`,
            marker: { size: 10, color: '#2196F3', symbol: 'cross', line: { width: 3, color: 'white' } },
            showlegend: false,
            hovertemplate: `<b>${target1Data.name || 'Target 1'}</b><br>δD: ${target1Data.delta_d.toFixed(1)}<br>δP: ${target1Data.delta_p.toFixed(1)}<br>R0: ${target1Data.radius.toFixed(1)}<extra></extra>`
        });

        if (target2Data) {
            ddDpData.push({
                type: 'scatter',
                mode: 'markers',
                x: [target2Data.delta_d],
                y: [target2Data.delta_p],
                name: `${target2Data.name || 'Target 2'} Center`,
                marker: { size: 10, color: '#FF9800', symbol: 'cross', line: { width: 3, color: 'white' } },
                showlegend: false,
                hovertemplate: `<b>${target2Data.name || 'Target 2'}</b><br>δD: ${target2Data.delta_d.toFixed(1)}<br>δP: ${target2Data.delta_p.toFixed(1)}<br>R0: ${target2Data.radius.toFixed(1)}<extra></extra>`
            });
        }

        // δD vs δH projection
        const ddDhData = [];

        // Target 1 ellipse (δD has factor of 4 in Hansen distance, so radius is R0/2)
        const ellipse1_ddDh = createEllipsePoints(
            target1Data.delta_d,
            target1Data.delta_h,
            target1Data.radius / 2,  // δD direction: R0/2
            target1Data.radius        // δH direction: R0
        );
        ddDhData.push({
            type: 'scatter',
            mode: 'lines',
            x: ellipse1_ddDh.x,
            y: ellipse1_ddDh.y,
            name: target1Data.name || 'Target 1',
            line: { color: '#2196F3', width: 2 },
            fill: 'toself',
            fillcolor: 'rgba(33, 150, 243, 0.1)',
            hoverinfo: 'skip'
        });

        if (target2Data) {
            const ellipse2_ddDh = createEllipsePoints(
                target2Data.delta_d,
                target2Data.delta_h,
                target2Data.radius / 2,  // δD direction: R0/2
                target2Data.radius        // δH direction: R0
            );
            ddDhData.push({
                type: 'scatter',
                mode: 'lines',
                x: ellipse2_ddDh.x,
                y: ellipse2_ddDh.y,
                name: target2Data.name || 'Target 2',
                line: { color: '#FF9800', width: 2 },
                fill: 'toself',
                fillcolor: 'rgba(255, 152, 0, 0.1)',
                hoverinfo: 'skip'
            });
        }

        if (solventData && solventData.length > 0) {
            const solventX = [];
            const solventY = [];
            const solventHoverTexts = [];
            const solventColors = [];

            solventData.forEach(s => {
                solventX.push(s.delta_d);
                solventY.push(s.delta_h);

                // Calculate RED values (needed for both coloring and hover text)
                const red1 = this.calculateDistance(
                    s.delta_d, s.delta_p, s.delta_h,
                    target1Data.delta_d, target1Data.delta_p, target1Data.delta_h
                ) / target1Data.radius;

                let red2 = null;
                if (target2Data) {
                    red2 = this.calculateDistance(
                        s.delta_d, s.delta_p, s.delta_h,
                        target2Data.delta_d, target2Data.delta_p, target2Data.delta_h
                    ) / target2Data.radius;
                }

                let color = '';

                // If solubility data is available, use it for coloring (matches 3D visualization)
                if (s.hasOwnProperty('solubility') && s.solubility !== undefined && s.solubility !== null) {
                    color = this.getSolubilityColor(s.solubility);
                } else {
                    // Otherwise, use RED-based coloring
                    if (target2Data) {
                        // Dual target color scheme
                        if (red1 < 1.0 && red2 < 1.0) {
                            color = '#4CAF50'; // Green - both targets
                        } else if (red1 < 1.0) {
                            color = '#2196F3'; // Blue - Target 1 only
                        } else if (red2 < 1.0) {
                            color = '#FF9800'; // Orange - Target 2 only
                        } else {
                            color = '#BDBDBD'; // Grey - neither target
                        }
                    } else {
                        // Single target color scheme
                        color = red1 < 1.0 ? '#4CAF50' : '#BDBDBD';
                    }
                }

                solventColors.push(color);

                // Build hover text
                let hoverText = `<b>${s.name}</b><br>δD: ${s.delta_d.toFixed(1)}<br>δH: ${s.delta_h.toFixed(1)}`;

                if (s.hasOwnProperty('solubility') && s.solubility !== undefined && s.solubility !== null) {
                    hoverText += `<br>Solubility: ${typeof s.solubility === 'number' ? s.solubility.toFixed(2) : s.solubility}`;
                } else {
                    hoverText += `<br>RED (${target1Data.name || 'Target 1'}): ${red1.toFixed(2)}`;
                    if (target2Data) {
                        hoverText += `<br>RED (${target2Data.name || 'Target 2'}): ${red2.toFixed(2)}`;
                    }
                }

                solventHoverTexts.push(hoverText);
            });

            ddDhData.push({
                type: 'scatter',
                mode: 'markers',
                x: solventX,
                y: solventY,
                name: 'Solvents',
                marker: { size: 6, color: solventColors, opacity: 0.7 },
                showlegend: false,
                hovertext: solventHoverTexts,
                hovertemplate: '%{hovertext}<extra></extra>'
            });
        }

        // Target centers (add last so they appear on top)
        ddDhData.push({
            type: 'scatter',
            mode: 'markers',
            x: [target1Data.delta_d],
            y: [target1Data.delta_h],
            name: `${target1Data.name || 'Target 1'} Center`,
            marker: { size: 10, color: '#2196F3', symbol: 'cross', line: { width: 3, color: 'white' } },
            showlegend: false,
            hovertemplate: `<b>${target1Data.name || 'Target 1'}</b><br>δD: ${target1Data.delta_d.toFixed(1)}<br>δH: ${target1Data.delta_h.toFixed(1)}<br>R0: ${target1Data.radius.toFixed(1)}<extra></extra>`
        });

        if (target2Data) {
            ddDhData.push({
                type: 'scatter',
                mode: 'markers',
                x: [target2Data.delta_d],
                y: [target2Data.delta_h],
                name: `${target2Data.name || 'Target 2'} Center`,
                marker: { size: 10, color: '#FF9800', symbol: 'cross', line: { width: 3, color: 'white' } },
                showlegend: false,
                hovertemplate: `<b>${target2Data.name || 'Target 2'}</b><br>δD: ${target2Data.delta_d.toFixed(1)}<br>δH: ${target2Data.delta_h.toFixed(1)}<br>R0: ${target2Data.radius.toFixed(1)}<extra></extra>`
            });
        }

        // δP vs δH projection
        const dpDhData = [];

        // Target 1 circle (no factor of 4 for δP and δH, so radius is R0)
        const circle1_dpDh = createEllipsePoints(
            target1Data.delta_p,
            target1Data.delta_h,
            target1Data.radius,  // δP direction: R0
            target1Data.radius   // δH direction: R0
        );
        dpDhData.push({
            type: 'scatter',
            mode: 'lines',
            x: circle1_dpDh.x,
            y: circle1_dpDh.y,
            name: target1Data.name || 'Target 1',
            line: { color: '#2196F3', width: 2 },
            fill: 'toself',
            fillcolor: 'rgba(33, 150, 243, 0.1)',
            hoverinfo: 'skip'
        });

        if (target2Data) {
            const circle2_dpDh = createEllipsePoints(
                target2Data.delta_p,
                target2Data.delta_h,
                target2Data.radius,  // δP direction: R0
                target2Data.radius   // δH direction: R0
            );
            dpDhData.push({
                type: 'scatter',
                mode: 'lines',
                x: circle2_dpDh.x,
                y: circle2_dpDh.y,
                name: target2Data.name || 'Target 2',
                line: { color: '#FF9800', width: 2 },
                fill: 'toself',
                fillcolor: 'rgba(255, 152, 0, 0.1)',
                hoverinfo: 'skip'
            });
        }

        if (solventData && solventData.length > 0) {
            const solventX = [];
            const solventY = [];
            const solventHoverTexts = [];
            const solventColors = [];

            solventData.forEach(s => {
                solventX.push(s.delta_p);
                solventY.push(s.delta_h);

                // Calculate RED values (needed for both coloring and hover text)
                const red1 = this.calculateDistance(
                    s.delta_d, s.delta_p, s.delta_h,
                    target1Data.delta_d, target1Data.delta_p, target1Data.delta_h
                ) / target1Data.radius;

                let red2 = null;
                if (target2Data) {
                    red2 = this.calculateDistance(
                        s.delta_d, s.delta_p, s.delta_h,
                        target2Data.delta_d, target2Data.delta_p, target2Data.delta_h
                    ) / target2Data.radius;
                }

                let color = '';

                // If solubility data is available, use it for coloring (matches 3D visualization)
                if (s.hasOwnProperty('solubility') && s.solubility !== undefined && s.solubility !== null) {
                    color = this.getSolubilityColor(s.solubility);
                } else {
                    // Otherwise, use RED-based coloring
                    if (target2Data) {
                        // Dual target color scheme
                        if (red1 < 1.0 && red2 < 1.0) {
                            color = '#4CAF50'; // Green - both targets
                        } else if (red1 < 1.0) {
                            color = '#2196F3'; // Blue - Target 1 only
                        } else if (red2 < 1.0) {
                            color = '#FF9800'; // Orange - Target 2 only
                        } else {
                            color = '#BDBDBD'; // Grey - neither target
                        }
                    } else {
                        // Single target color scheme
                        color = red1 < 1.0 ? '#4CAF50' : '#BDBDBD';
                    }
                }

                solventColors.push(color);

                // Build hover text
                let hoverText = `<b>${s.name}</b><br>δP: ${s.delta_p.toFixed(1)}<br>δH: ${s.delta_h.toFixed(1)}`;

                if (s.hasOwnProperty('solubility') && s.solubility !== undefined && s.solubility !== null) {
                    hoverText += `<br>Solubility: ${typeof s.solubility === 'number' ? s.solubility.toFixed(2) : s.solubility}`;
                } else {
                    hoverText += `<br>RED (${target1Data.name || 'Target 1'}): ${red1.toFixed(2)}`;
                    if (target2Data) {
                        hoverText += `<br>RED (${target2Data.name || 'Target 2'}): ${red2.toFixed(2)}`;
                    }
                }

                solventHoverTexts.push(hoverText);
            });

            dpDhData.push({
                type: 'scatter',
                mode: 'markers',
                x: solventX,
                y: solventY,
                name: 'Solvents',
                marker: { size: 6, color: solventColors, opacity: 0.7 },
                showlegend: false,
                hovertext: solventHoverTexts,
                hovertemplate: '%{hovertext}<extra></extra>'
            });
        }

        // Target centers (add last so they appear on top)
        dpDhData.push({
            type: 'scatter',
            mode: 'markers',
            x: [target1Data.delta_p],
            y: [target1Data.delta_h],
            name: `${target1Data.name || 'Target 1'} Center`,
            marker: { size: 10, color: '#2196F3', symbol: 'cross', line: { width: 3, color: 'white' } },
            showlegend: false,
            hovertemplate: `<b>${target1Data.name || 'Target 1'}</b><br>δP: ${target1Data.delta_p.toFixed(1)}<br>δH: ${target1Data.delta_h.toFixed(1)}<br>R0: ${target1Data.radius.toFixed(1)}<extra></extra>`
        });

        if (target2Data) {
            dpDhData.push({
                type: 'scatter',
                mode: 'markers',
                x: [target2Data.delta_p],
                y: [target2Data.delta_h],
                name: `${target2Data.name || 'Target 2'} Center`,
                marker: { size: 10, color: '#FF9800', symbol: 'cross', line: { width: 3, color: 'white' } },
                showlegend: false,
                hovertemplate: `<b>${target2Data.name || 'Target 2'}</b><br>δP: ${target2Data.delta_p.toFixed(1)}<br>δH: ${target2Data.delta_h.toFixed(1)}<br>R0: ${target2Data.radius.toFixed(1)}<extra></extra>`
            });
        }

        return {
            dd_dp: {
                data: ddDpData,
                layout: createLayout('δD (Dispersion)', 'δP (Polarity)', [xMin, xMax], [yMin, yMax])
            },
            dd_dh: {
                data: ddDhData,
                layout: createLayout('δD (Dispersion)', 'δH (Hydrogen Bonding)', [xMin, xMax], [yMin, yMax])
            },
            dp_dh: {
                data: dpDhData,
                layout: createLayout('δP (Polarity)', 'δH (Hydrogen Bonding)', [yMin, yMax], [yMin, yMax])
            }
        };
    }
}

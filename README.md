# MixingCompass

Hansen Solubility Parameters (HSP) analysis web application for solvent screening and material compatibility analysis.

## Overview

MixingCompass is a comprehensive web application designed for Hansen Solubility Parameters calculation and visualization. It provides an intuitive interface for researchers and engineers to analyze solvent-material interactions and optimize formulations.

### Key Features

- **Interactive HSP Calculation**: Calculate Hansen Solubility Parameters using experimental solubility data
- **3D Visualization**: Interactive 3D Hansen sphere visualization using Plotly
- **Solvent Database**: Comprehensive database with 710+ solvents and their HSP values
- **Experimental Management**: Create, manage, and track multiple experiments
- **Real-time Analysis**: Live calculation and visualization updates
- **Export Capabilities**: Export results and visualizations

## System Requirements

### Python Version
- **Supported**: Python 3.9 - 3.13
- **Recommended**: Python 3.10 - 3.12
- **Current Development**: Python 3.13.7

### Operating System
- Windows 10/11
- macOS 10.14+
- Linux (Ubuntu 18.04+, CentOS 7+)

## Installation

### Method 1: Standard Installation (Recommended)

1. **Clone the Repository**
   ```bash
   git clone https://github.com/ToshihiroIguchi/MixingCompass.git
   cd MixingCompass
   ```

2. **Create Virtual Environment**
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Upgrade pip**
   ```bash
   python -m pip install --upgrade pip
   ```

4. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Start the Application**
   ```bash
   python start.py
   ```

### Method 2: Manual Package Installation

If `requirements.txt` installation fails, install packages manually:

```bash
# Core Web Framework
pip install "fastapi>=0.100.0,<1.0.0"
pip install "uvicorn[standard]>=0.24.0,<1.0.0"
pip install "jinja2>=3.1.0,<4.0.0"

# Data Processing (precompiled binaries)
pip install "numpy>=1.24.0,<3.0.0"
pip install "pandas>=2.0.0,<3.0.0"
pip install "scipy>=1.10.0,<2.0.0"

# Visualization
pip install "plotly>=5.0.0,<6.0.0"
pip install "matplotlib>=3.5.0,<4.0.0"

# HSP Calculation
pip install "HSPiPy>=1.1.0,<2.0.0"

# Machine Learning
pip install "scikit-learn>=1.3.0,<2.0.0"

# Data Validation
pip install "pydantic>=2.5.0,<3.0.0"
pip install "pydantic-settings>=2.0.0,<3.0.0"

# Utilities
pip install "python-dotenv>=1.0.0,<2.0.0"
pip install "psutil>=5.9.0,<6.0.0"
pip install "requests>=2.28.0,<3.0.0"
```

### Method 3: conda Installation (Alternative)

```bash
# Create conda environment
conda create -n mixingcompass python=3.11
conda activate mixingcompass

# Install scientific packages via conda
conda install numpy pandas scipy scikit-learn matplotlib

# Install remaining packages via pip
pip install fastapi uvicorn[standard] jinja2 plotly HSPiPy pydantic pydantic-settings python-dotenv psutil requests
```

## Quick Start

1. **Start the Server**
   ```bash
   python start.py
   ```
   The server will automatically find an available port (default: 8200)

2. **Open Web Browser**
   Navigate to: `http://localhost:8200`

3. **Create Your First Experiment**
   - Enter sample name and description
   - Add solvents and their solubility results
   - Click "Calculate HSP" to get Hansen parameters
   - View 3D visualization

## Usage Guide

### Creating an Experiment

1. Fill in experiment details:
   - Sample name (required)
   - Description
   - Experimenter name
   - Notes and tags

2. Add solvent tests:
   - Search and select solvents from the database
   - Set solubility status (Soluble/Insoluble/Partial)
   - Add test notes

3. Calculate HSP values:
   - Click "Calculate HSP Values"
   - View results: δD, δP, δH, and Ra values
   - Explore 3D Hansen sphere visualization

### Understanding Results

- **δD (Dispersion)**: Van der Waals forces
- **δP (Polarity)**: Dipole-dipole interactions
- **δH (Hydrogen bonding)**: Hydrogen bonding forces
- **Ra (Radius)**: Interaction sphere radius

## Troubleshooting

### Common Installation Issues

**Issue**: `pip install` fails with compilation errors
**Solution**: Use precompiled packages:
```bash
pip install --only-binary=all numpy pandas scipy scikit-learn matplotlib
```

**Issue**: HSPiPy installation fails
**Solution**: Install dependencies first:
```bash
pip install numpy pandas scipy scikit-learn matplotlib
pip install HSPiPy
```

**Issue**: Port already in use
**Solution**: The `start.py` script automatically finds available ports. Alternatively, specify a port:
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8201
```

**Issue**: Permission denied errors
**Solution**: Run with appropriate permissions or use virtual environment

### Runtime Issues

**Issue**: "No module named 'app'"
**Solution**: Ensure you're in the project root directory

**Issue**: Solvent database not loading
**Solution**: Check that `data/hsp.csv` exists and is readable

**Issue**: Visualization not displaying
**Solution**: Ensure modern browser with JavaScript enabled

## Development

### Project Structure

```
MixingCompass/
├── app/                    # Main application code
│   ├── api/               # API endpoints
│   ├── models/            # Data models
│   ├── services/          # Business logic
│   └── main.py           # FastAPI application
├── static/                # Frontend assets
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript
│   └── images/           # Images
├── templates/             # HTML templates
├── data/                  # Data files
│   ├── hsp.csv           # Solvent database
│   └── experiments/      # Saved experiments
├── start.py              # Application launcher
└── requirements.txt      # Dependencies
```

### Running in Development Mode

```bash
python start.py
```

The application includes:
- Auto-reload on code changes
- Comprehensive logging
- Error handling and debugging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Technical Details

### Dependencies Overview

- **FastAPI**: Modern web framework for APIs
- **HSPiPy**: Hansen Solubility Parameters calculations
- **Plotly**: Interactive 3D visualizations
- **Pandas/NumPy**: Data processing and analysis
- **Scikit-learn**: Machine learning algorithms
- **Pydantic**: Data validation and settings management

### Performance Notes

- All scientific packages use precompiled binaries (wheels)
- No compilation required during installation
- Optimized for cross-platform compatibility
- Memory-efficient data processing

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For issues, questions, or contributions, please visit:
https://github.com/ToshihiroIguchi/MixingCompass

## Acknowledgments

- HSPiPy library for Hansen Solubility Parameters calculations
- Hansen Solubility Parameters community for theoretical foundation
- FastAPI and Plotly teams for excellent frameworks
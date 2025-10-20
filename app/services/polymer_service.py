"""
Polymer data service for loading and managing polymer database
"""

import pandas as pd
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
import time

from app.config import settings

logger = logging.getLogger(__name__)


class PolymerData:
    """Polymer data model"""
    def __init__(self, polymer: str, delta_d: float, delta_p: float, delta_h: float,
                 ra: float, cas: Optional[str] = None, source_file: Optional[str] = None,
                 source_url: Optional[str] = None):
        self.polymer = polymer
        self.delta_d = delta_d
        self.delta_p = delta_p
        self.delta_h = delta_h
        self.ra = ra
        self.cas = cas
        self.source_file = source_file
        self.source_url = source_url


class PolymerService:
    """Service for managing polymer data"""

    def __init__(self):
        self._data: Optional[pd.DataFrame] = None
        self._indexed_data: Dict[str, PolymerData] = {}
        self._last_loaded: Optional[float] = None
        self._polymer_data_file = "data/polymers.csv"

    def load_data(self, force_reload: bool = False) -> bool:
        """Load polymer data from CSV file"""

        if not force_reload and self._data is not None:
            return True

        try:
            file_path = Path(self._polymer_data_file)

            if not file_path.exists():
                logger.error(f"Polymer data file not found: {file_path}")
                return False

            # Load CSV with proper encoding
            df = pd.read_csv(file_path, encoding='utf-8-sig')
            logger.info(f"Loaded {len(df)} polymers from {file_path}")

            # Validate required columns (accept both Ra and R0)
            required_columns = ['Polymer', 'delta_D', 'delta_P', 'delta_H']
            radius_col = 'R0' if 'R0' in df.columns else 'Ra'

            if radius_col not in df.columns:
                logger.error(f"Missing radius column (expected R0 or Ra)")
                return False

            required_columns.append(radius_col)
            missing_columns = [col for col in required_columns if col not in df.columns]

            if missing_columns:
                logger.error(f"Missing required columns: {missing_columns}")
                return False

            # Normalize column name to Ra for internal use
            if 'R0' in df.columns and 'Ra' not in df.columns:
                df['Ra'] = df['R0']

            # Clean and validate data
            df = self._clean_data(df)

            # Store data
            self._data = df
            self._last_loaded = time.time()

            # Create indexed lookup for faster access
            self._create_index()

            logger.info(f"Successfully loaded {len(self._data)} valid polymers")
            return True

        except Exception as e:
            logger.error(f"Error loading polymer data: {e}")
            return False

    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and validate polymer data"""

        # Remove rows with missing essential data
        essential_cols = ['Polymer', 'delta_D', 'delta_P', 'delta_H', 'Ra']
        df = df.dropna(subset=essential_cols)

        # Remove rows with invalid HSP values
        df = df[
            (df['delta_D'] >= 0) &
            (df['delta_P'] >= 0) &
            (df['delta_H'] >= 0) &
            (df['Ra'] >= 0)
        ]

        # Clean polymer names
        df['Polymer'] = df['Polymer'].astype(str).str.strip()
        df = df[df['Polymer'] != '']

        # Remove duplicates (keep first occurrence)
        df = df.drop_duplicates(subset=['Polymer'], keep='first')

        # Convert numeric columns
        numeric_cols = ['delta_D', 'delta_P', 'delta_H', 'Ra']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        # Clean string columns
        string_cols = ['CAS', 'source_file', 'source_url']
        for col in string_cols:
            if col in df.columns:
                df[col] = df[col].astype(str).replace('nan', '')
                df[col] = df[col].replace('', None)

        return df

    def _create_index(self):
        """Create indexed lookup for faster searches"""

        if self._data is None:
            return

        self._indexed_data = {}

        for _, row in self._data.iterrows():
            try:
                polymer_data = self._row_to_polymer_data(row)

                # Index by polymer name (case-insensitive)
                key = polymer_data.polymer.lower()
                self._indexed_data[key] = polymer_data

                # Also index by CAS if available
                if polymer_data.cas:
                    self._indexed_data[polymer_data.cas.lower()] = polymer_data

            except Exception as e:
                logger.warning(f"Error indexing polymer {row.get('Polymer', 'unknown')}: {e}")

    def _row_to_polymer_data(self, row: pd.Series) -> PolymerData:
        """Convert DataFrame row to PolymerData model"""

        return PolymerData(
            polymer=str(row['Polymer']),
            delta_d=float(row['delta_D']),
            delta_p=float(row['delta_P']),
            delta_h=float(row['delta_H']),
            ra=float(row['Ra']),
            cas=row.get('CAS') if pd.notna(row.get('CAS')) else None,
            source_file=str(row['source_file']) if pd.notna(row.get('source_file')) else None,
            source_url=str(row['source_url']) if pd.notna(row.get('source_url')) else None,
        )

    def get_polymer_by_name(self, name: str) -> Optional[PolymerData]:
        """Get polymer data by name (case-insensitive)"""

        if not self._ensure_data_loaded():
            return None

        key = name.lower().strip()
        return self._indexed_data.get(key)

    def get_all_polymer_names(self) -> List[str]:
        """Get list of all available polymer names"""

        if not self._ensure_data_loaded():
            return []

        return sorted(self._data['Polymer'].tolist())

    def get_all_polymers(self) -> List[PolymerData]:
        """Get all polymers"""

        if not self._ensure_data_loaded():
            return []

        polymers = []
        for _, row in self._data.iterrows():
            try:
                polymer_data = self._row_to_polymer_data(row)
                polymers.append(polymer_data)
            except Exception as e:
                logger.warning(f"Error converting polymer row: {e}")

        return polymers

    def _ensure_data_loaded(self) -> bool:
        """Ensure data is loaded, load if necessary"""

        if self._data is None:
            return self.load_data()
        return True

    def reload_data(self) -> bool:
        """Force reload of polymer data"""

        return self.load_data(force_reload=True)

    def get_data_info(self) -> Dict[str, Any]:
        """Get information about loaded data"""

        if not self._ensure_data_loaded():
            return {"loaded": False}

        return {
            "loaded": True,
            "total_polymers": len(self._data),
            "last_loaded": self._last_loaded,
            "columns": list(self._data.columns),
            "data_file": self._polymer_data_file
        }


# Global service instance
polymer_service = PolymerService()

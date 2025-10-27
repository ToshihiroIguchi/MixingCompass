"""
Solvent data service for loading and managing solvent database
"""

import pandas as pd
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
import time
import re

from app.config import settings
from app.models.solvent_models import (
    SolventData,
    SolventSearchQuery,
    SolventSearchResponse
)

logger = logging.getLogger(__name__)


class SolventService:
    """Service for managing solvent data"""

    def __init__(self):
        self._data: Optional[pd.DataFrame] = None
        self._indexed_data: Dict[str, SolventData] = {}
        self._last_loaded: Optional[float] = None

    def load_data(self, force_reload: bool = False) -> bool:
        """Load solvent data from CSV file"""

        if not force_reload and self._data is not None:
            return True

        try:
            file_path = Path(settings.solvent_data_file)

            if not file_path.exists():
                logger.error(f"Solvent data file not found: {file_path}")
                return False

            # Load CSV with proper encoding
            df = pd.read_csv(file_path, encoding='utf-8-sig')
            logger.info(f"Loaded {len(df)} solvents from {file_path}")

            # Validate required columns
            required_columns = ['Solvent', 'delta_D', 'delta_P', 'delta_H']
            missing_columns = [col for col in required_columns if col not in df.columns]

            if missing_columns:
                logger.error(f"Missing required columns: {missing_columns}")
                return False

            # Clean and validate data
            df = self._clean_data(df)

            # Store data
            self._data = df
            self._last_loaded = time.time()

            # Create indexed lookup for faster access
            self._create_index()

            logger.info(f"Successfully loaded {len(self._data)} valid solvents")
            return True

        except Exception as e:
            logger.error(f"Error loading solvent data: {e}")
            return False

    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and validate solvent data"""

        # Remove rows with missing essential data
        essential_cols = ['Solvent', 'delta_D', 'delta_P', 'delta_H']
        df = df.dropna(subset=essential_cols)

        # Remove rows with invalid HSP values
        df = df[
            (df['delta_D'] >= 0) &
            (df['delta_P'] >= 0) &
            (df['delta_H'] >= 0)
        ]

        # Clean solvent names
        df['Solvent'] = df['Solvent'].astype(str).str.strip()
        df = df[df['Solvent'] != '']

        # Remove duplicates (keep first occurrence)
        df = df.drop_duplicates(subset=['Solvent'], keep='first')

        # Convert numeric columns
        numeric_cols = ['delta_D', 'delta_P', 'delta_H', 'MWt', 'MVol', 'Density', 'Tb', 'Pv']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        # Clean string columns
        string_cols = ['CAS', 'Smiles', 'InChIKey', 'GHS', 'H']
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
                solvent_data = self._row_to_solvent_data(row)

                # Index by solvent name (case-insensitive)
                key = solvent_data.solvent.lower()
                self._indexed_data[key] = solvent_data

                # Also index by CAS if available
                if solvent_data.cas:
                    self._indexed_data[solvent_data.cas.lower()] = solvent_data

            except Exception as e:
                logger.warning(f"Error indexing solvent {row.get('Solvent', 'unknown')}: {e}")

    def _row_to_solvent_data(self, row: pd.Series) -> SolventData:
        """Convert DataFrame row to SolventData model"""

        return SolventData(
            solvent=str(row['Solvent']),
            delta_d=float(row['delta_D']),
            delta_p=float(row['delta_P']),
            delta_h=float(row['delta_H']),
            cas=row.get('CAS') if pd.notna(row.get('CAS')) else None,
            smiles=row.get('Smiles') if pd.notna(row.get('Smiles')) else None,
            inchi_key=row.get('InChIKey') if pd.notna(row.get('InChIKey')) else None,
            molecular_weight=float(row['MWt']) if pd.notna(row.get('MWt')) else None,
            molar_volume=float(row['MVol']) if pd.notna(row.get('MVol')) else None,
            density=float(row['Density']) if pd.notna(row.get('Density')) else None,
            boiling_point=float(row['Tb']) if pd.notna(row.get('Tb')) else None,
            vapor_pressure=float(row['Pv']) if pd.notna(row.get('Pv')) else None,
            ghs_classification=str(row['GHS']) if pd.notna(row.get('GHS')) else None,
            hazard_statements=str(row['H']) if pd.notna(row.get('H')) else None,
            wgk_class=int(row['WGK']) if pd.notna(row.get('WGK')) else None,
            cost_per_ml=float(row['Cost']) if pd.notna(row.get('Cost')) else None,
            delta_total=float(row['delta_total']) if pd.notna(row.get('delta_total')) else None,
            source_file=str(row['source_file']) if pd.notna(row.get('source_file')) else None,
            source_row=int(row['source_row']) if pd.notna(row.get('source_row')) else None,
            source_url=str(row['source_url']) if pd.notna(row.get('source_url')) else None,
            completeness=float(row['completeness']) if pd.notna(row.get('completeness')) else None,
        )

    def get_solvent_by_name(self, name: str) -> Optional[SolventData]:
        """Get solvent data by name (case-insensitive, supports partial matching)"""

        if not self._ensure_data_loaded():
            return None

        query = name.lower().strip()

        # First try exact match (faster)
        if query in self._indexed_data:
            return self._indexed_data[query]

        # If not found, try partial match in Solvent column
        for solvent_data in self._indexed_data.values():
            if query in solvent_data.solvent.lower():
                return solvent_data

        return None

    def get_solvent_by_cas(self, cas: str) -> Optional[SolventData]:
        """Get solvent data by CAS number"""

        if not self._ensure_data_loaded():
            return None

        key = cas.lower().strip()
        return self._indexed_data.get(key)

    def search_solvents(self, query: SolventSearchQuery) -> SolventSearchResponse:
        """Search solvents with various filters"""

        start_time = time.time()

        if not self._ensure_data_loaded():
            return SolventSearchResponse(
                solvents=[],
                total_count=0,
                query=query,
                execution_time_ms=0
            )

        # Start with all data
        df = self._data.copy()

        # Apply text search filter
        if query.query:
            search_term = query.query.lower()
            mask = (
                df['Solvent'].str.lower().str.contains(search_term, na=False, regex=False) |
                df['CAS'].astype(str).str.lower().str.contains(search_term, na=False, regex=False) |
                df['Smiles'].astype(str).str.lower().str.contains(search_term, na=False, regex=False)
            )
            df = df[mask]

        # Apply HSP range filters
        if query.delta_d_min is not None:
            df = df[df['delta_D'] >= query.delta_d_min]
        if query.delta_d_max is not None:
            df = df[df['delta_D'] <= query.delta_d_max]

        if query.delta_p_min is not None:
            df = df[df['delta_P'] >= query.delta_p_min]
        if query.delta_p_max is not None:
            df = df[df['delta_P'] <= query.delta_p_max]

        if query.delta_h_min is not None:
            df = df[df['delta_H'] >= query.delta_h_min]
        if query.delta_h_max is not None:
            df = df[df['delta_H'] <= query.delta_h_max]

        # Apply availability filters
        if query.has_smiles is not None:
            if query.has_smiles:
                df = df[df['Smiles'].notna() & (df['Smiles'] != '')]
            else:
                df = df[df['Smiles'].isna() | (df['Smiles'] == '')]

        if query.has_cas is not None:
            if query.has_cas:
                df = df[df['CAS'].notna() & (df['CAS'] != '')]
            else:
                df = df[df['CAS'].isna() | (df['CAS'] == '')]

        # Get total count before pagination
        total_count = len(df)

        # Apply pagination
        start_idx = query.offset
        end_idx = start_idx + query.limit
        df_page = df.iloc[start_idx:end_idx]

        # Convert to SolventData objects
        solvents = []
        for _, row in df_page.iterrows():
            try:
                solvent_data = self._row_to_solvent_data(row)
                solvents.append(solvent_data)
            except Exception as e:
                logger.warning(f"Error converting row to SolventData: {e}")

        execution_time = (time.time() - start_time) * 1000

        return SolventSearchResponse(
            solvents=solvents,
            total_count=total_count,
            query=query,
            execution_time_ms=execution_time
        )

    def get_all_solvent_names(self) -> List[str]:
        """Get list of all available solvent names"""

        if not self._ensure_data_loaded():
            return []

        return sorted(self._data['Solvent'].tolist())

    def get_hsp_range_stats(self) -> Dict[str, Dict[str, float]]:
        """Get statistical information about HSP ranges"""

        if not self._ensure_data_loaded():
            return {}

        stats = {}
        for param in ['delta_D', 'delta_P', 'delta_H']:
            if param in self._data.columns:
                stats[param] = {
                    'min': float(self._data[param].min()),
                    'max': float(self._data[param].max()),
                    'mean': float(self._data[param].mean()),
                    'std': float(self._data[param].std())
                }

        return stats

    def _ensure_data_loaded(self) -> bool:
        """Ensure data is loaded, load if necessary"""

        if self._data is None:
            return self.load_data()
        return True

    def reload_data(self) -> bool:
        """Force reload of solvent data"""

        return self.load_data(force_reload=True)

    def get_data_info(self) -> Dict[str, Any]:
        """Get information about loaded data"""

        if not self._ensure_data_loaded():
            return {"loaded": False}

        return {
            "loaded": True,
            "total_solvents": len(self._data),
            "last_loaded": self._last_loaded,
            "columns": list(self._data.columns),
            "hsp_stats": self.get_hsp_range_stats(),
            "data_file": settings.solvent_data_file
        }

    def add_solvent(self, solvent_data: SolventData) -> bool:
        """Add a new solvent to the database"""

        if not self._ensure_data_loaded():
            return False

        try:
            # Check if solvent already exists
            existing = self.get_solvent_by_name(solvent_data.solvent)
            if existing:
                logger.warning(f"Solvent '{solvent_data.solvent}' already exists in database")
                return False

            # Create new row
            new_row = {
                'Solvent': solvent_data.solvent,
                'delta_D': solvent_data.delta_d,
                'delta_P': solvent_data.delta_p,
                'delta_H': solvent_data.delta_h,
                'Cas': solvent_data.cas,
                'Smiles': solvent_data.smiles,
                'InChIKey': solvent_data.inchi_key,
                'MWt': solvent_data.molecular_weight,
                'MVol': solvent_data.molar_volume,
                'Density': solvent_data.density,
                'Tv': solvent_data.boiling_point,
                'Pv': solvent_data.vapor_pressure,
                'GHS': solvent_data.ghs_classification,
                'H': solvent_data.hazard_statements,
                'WGK': solvent_data.wgk_class,
                'Cost': solvent_data.cost_per_ml,
                'delta_total': solvent_data.delta_total,
                'source_file': 'user_added',
                'source_row': None,
                'source_url': solvent_data.source_url,
                'completeness': solvent_data.completeness
            }

            # Append to DataFrame
            self._data = pd.concat([self._data, pd.DataFrame([new_row])], ignore_index=True)

            # Update index
            key = solvent_data.solvent.lower()
            self._indexed_data[key] = solvent_data
            if solvent_data.cas:
                self._indexed_data[solvent_data.cas.lower()] = solvent_data

            # Save to CSV
            self._save_to_csv()

            logger.info(f"Added new solvent: {solvent_data.solvent}")
            return True

        except Exception as e:
            logger.error(f"Error adding solvent: {e}")
            return False

    def _save_to_csv(self) -> bool:
        """Save current data to CSV file"""

        try:
            file_path = Path(settings.solvent_data_file)
            self._data.to_csv(file_path, index=False, encoding='utf-8-sig')
            logger.info(f"Saved {len(self._data)} solvents to {file_path}")
            return True

        except Exception as e:
            logger.error(f"Error saving solvent data: {e}")
            return False

    def get_user_added_solvents(self) -> List[SolventData]:
        """Get all user-added solvents"""

        if not self._ensure_data_loaded():
            return []

        try:
            # Filter solvents where source_file is 'user_added'
            user_solvents_df = self._data[self._data['source_file'] == 'user_added']

            solvents = []
            for _, row in user_solvents_df.iterrows():
                try:
                    solvent_data = self._row_to_solvent_data(row)
                    solvents.append(solvent_data)
                except Exception as e:
                    logger.warning(f"Error converting user solvent row: {e}")

            return solvents

        except Exception as e:
            logger.error(f"Error getting user-added solvents: {e}")
            return []

    def update_solvent(self, original_name: str, solvent_data: SolventData) -> bool:
        """Update an existing solvent (only user-added solvents can be updated)"""

        if not self._ensure_data_loaded():
            return False

        try:
            # Find the solvent by original name
            mask = self._data['Solvent'] == original_name
            if not mask.any():
                logger.warning(f"Solvent '{original_name}' not found")
                return False

            # Check if it's a user-added solvent
            solvent_row = self._data[mask].iloc[0]
            if solvent_row.get('source_file') != 'user_added':
                logger.warning(f"Cannot update non-user-added solvent '{original_name}'")
                return False

            # If name changed, check new name doesn't already exist
            if original_name != solvent_data.solvent:
                existing = self.get_solvent_by_name(solvent_data.solvent)
                if existing:
                    logger.warning(f"Solvent name '{solvent_data.solvent}' already exists")
                    return False

            # Update the row
            idx = self._data[mask].index[0]
            self._data.at[idx, 'Solvent'] = solvent_data.solvent
            self._data.at[idx, 'delta_D'] = solvent_data.delta_d
            self._data.at[idx, 'delta_P'] = solvent_data.delta_p
            self._data.at[idx, 'delta_H'] = solvent_data.delta_h
            self._data.at[idx, 'Cas'] = solvent_data.cas
            self._data.at[idx, 'Smiles'] = solvent_data.smiles
            self._data.at[idx, 'InChIKey'] = solvent_data.inchi_key
            self._data.at[idx, 'MWt'] = solvent_data.molecular_weight
            self._data.at[idx, 'MVol'] = solvent_data.molar_volume
            self._data.at[idx, 'Density'] = solvent_data.density
            self._data.at[idx, 'Tv'] = solvent_data.boiling_point
            self._data.at[idx, 'Pv'] = solvent_data.vapor_pressure
            self._data.at[idx, 'GHS'] = solvent_data.ghs_classification
            self._data.at[idx, 'H'] = solvent_data.hazard_statements
            self._data.at[idx, 'WGK'] = solvent_data.wgk_class
            self._data.at[idx, 'Cost'] = solvent_data.cost_per_ml
            self._data.at[idx, 'source_url'] = solvent_data.source_url

            # Rebuild index
            self._create_index()

            # Save to CSV
            self._save_to_csv()

            logger.info(f"Updated solvent: {original_name} -> {solvent_data.solvent}")
            return True

        except Exception as e:
            logger.error(f"Error updating solvent: {e}")
            return False

    def delete_solvent(self, solvent_name: str) -> bool:
        """Delete a solvent (only user-added solvents can be deleted)"""

        if not self._ensure_data_loaded():
            return False

        try:
            # Find the solvent
            mask = self._data['Solvent'] == solvent_name
            if not mask.any():
                logger.warning(f"Solvent '{solvent_name}' not found")
                return False

            # Check if it's a user-added solvent
            solvent_row = self._data[mask].iloc[0]
            if solvent_row.get('source_file') != 'user_added':
                logger.warning(f"Cannot delete non-user-added solvent '{solvent_name}'")
                return False

            # Remove from DataFrame
            self._data = self._data[~mask].reset_index(drop=True)

            # Rebuild index
            self._create_index()

            # Save to CSV
            self._save_to_csv()

            logger.info(f"Deleted solvent: {solvent_name}")
            return True

        except Exception as e:
            logger.error(f"Error deleting solvent: {e}")
            return False


# Global service instance
solvent_service = SolventService()
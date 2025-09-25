"""
Configuration settings for MixingCompass application
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings"""

    # Application
    app_name: str = "MixingCompass"
    version: str = "1.0.0"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8200

    # Paths
    data_dir: str = "data"
    static_dir: str = "static"
    templates_dir: str = "templates"

    # File paths
    solvent_data_file: str = "data/hsp.csv"
    logo_file: str = "static/images/mc_logo.png"

    # CORS
    cors_origins: list = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()
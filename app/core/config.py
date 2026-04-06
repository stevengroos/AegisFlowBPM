from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
import json

class Settings(BaseSettings):
    PROJECT_NAME: str = "BPM SaaS"
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # 🔥 PENTEST FIX: Centralizamos la validación de los orígenes permitidos (CORS) 🔥
    CORS_ORIGINS: str = "http://localhost:5173"

    # =========================================================
    # 🔥 NUEVO: VARIABLES DE ENTORNO PARA SMTP GLOBAL 🔥
    # =========================================================
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Seguridad AegisFlow"

    @property
    def get_cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    # 🔥 PENTEST FIX: Sintaxis moderna de Pydantic V2 para evitar deprecation warnings 🔥
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
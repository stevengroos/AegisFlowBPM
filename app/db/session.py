from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# 🔥 PENTEST FIX: Optimizaciones para Nube / Producción (Escalabilidad y Resiliencia) 🔥
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Evita Errores 500 verificando que la conexión esté viva
    pool_size=20,        # Conexiones base simultáneas (Apto para alto tráfico)
    max_overflow=15      # Conexiones de emergencia adicionales si hay picos de usuarios
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
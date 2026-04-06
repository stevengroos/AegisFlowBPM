from sqlalchemy import text
from app.db.session import engine

def update_tables():
    with engine.connect() as conn:
        print("Actualizando tabla 'cases'...")
        # Agregamos la columna status_id
        # El comando 'ALTER TABLE' añade la columna si no existe
        try:
            conn.execute(text("ALTER TABLE cases ADD COLUMN status_id INTEGER REFERENCES statuses(id);"))
            conn.commit()
            print("Columna 'status_id' agregada con éxito.")
        except Exception as e:
            print(f"Nota: Probablemente la columna ya existe o hubo un error: {e}")

if __name__ == "__main__":
    update_tables()
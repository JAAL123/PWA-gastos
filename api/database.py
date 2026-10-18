import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Usar el driver psycopg 3 con URLs estándar de PostgreSQL.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)


def init_db():
    """Crea tablas nuevas (ej. users) y asegura las columnas user_id en tablas existentes."""
    import api.models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_transactions_user_id ON transactions (user_id)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_fixed_expenses_user_id ON fixed_expenses (user_id)"
            )
        )


def get_session():
    with Session(engine) as session:
        yield session
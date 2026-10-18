import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

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

APP_TIMEZONE = os.getenv("APP_TIMEZONE", "America/Mexico_City")


def get_local_now() -> datetime:
    try:
        return datetime.now(ZoneInfo(APP_TIMEZONE)).replace(tzinfo=None)
    except Exception:
        return datetime.now()


def init_db():
    """Crea tablas nuevas, columnas de cobro automático, función SQL y job pg_cron en Supabase."""
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
                "ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS last_charged_period VARCHAR(7)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fixed_expense_id INTEGER REFERENCES fixed_expenses(id) ON DELETE SET NULL"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS billing_period VARCHAR(7)"
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
        conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_fixed_expense_period
                ON transactions (fixed_expense_id, billing_period)
                WHERE fixed_expense_id IS NOT NULL AND billing_period IS NOT NULL
                """
            )
        )

        # Eliminar firma anterior sin argumentos si existiera para evitar ambigüedad
        conn.execute(
            text("DROP FUNCTION IF EXISTS process_due_fixed_expenses();")
        )

        # Crear función almacenada unificada en PostgreSQL (usada tanto por pg_cron como por el backend)
        conn.execute(
            text(
                """
                CREATE OR REPLACE FUNCTION process_due_fixed_expenses(p_user_id INTEGER DEFAULT NULL)
                RETURNS INTEGER
                LANGUAGE plpgsql
                AS $$
                DECLARE
                    v_now TIMESTAMP := CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City';
                    v_today DATE := v_now::DATE;
                    v_period VARCHAR(7) := to_char(v_today, 'YYYY-MM');
                    v_current_day INTEGER := EXTRACT(DAY FROM v_today)::INTEGER;
                    v_last_day INTEGER := EXTRACT(DAY FROM (date_trunc('month', v_today) + INTERVAL '1 month - 1 day'))::INTEGER;
                    v_rec RECORD;
                    v_effective_day INTEGER;
                    v_charge_date TIMESTAMP;
                    v_inserted_count INTEGER := 0;
                    v_row_count INTEGER;
                BEGIN
                    FOR v_rec IN
                        SELECT id, user_id, name, amount, due_day, category
                        FROM fixed_expenses
                        WHERE is_active = TRUE
                          AND user_id IS NOT NULL
                          AND (p_user_id IS NULL OR user_id = p_user_id)
                          AND (last_charged_period IS NULL OR last_charged_period < v_period)
                          AND LEAST(GREATEST(due_day, 1), v_last_day) <= v_current_day
                    LOOP
                        v_effective_day := LEAST(GREATEST(v_rec.due_day, 1), v_last_day);
                        v_charge_date := make_timestamp(
                            EXTRACT(YEAR FROM v_today)::INTEGER,
                            EXTRACT(MONTH FROM v_today)::INTEGER,
                            v_effective_day,
                            12, 0, 0
                        );

                        INSERT INTO transactions (
                            type, amount, category, description, date, created_at,
                            user_id, fixed_expense_id, billing_period
                        )
                        VALUES (
                            'expense',
                            v_rec.amount,
                            COALESCE(NULLIF(v_rec.category, ''), 'Gasto Fijo'),
                            'Cobro automático: ' || v_rec.name,
                            v_charge_date,
                            v_now,
                            v_rec.user_id,
                            v_rec.id,
                            v_period
                        )
                        ON CONFLICT (fixed_expense_id, billing_period)
                        WHERE fixed_expense_id IS NOT NULL AND billing_period IS NOT NULL
                        DO NOTHING;

                        GET DIAGNOSTICS v_row_count = ROW_COUNT;
                        v_inserted_count := v_inserted_count + v_row_count;

                        UPDATE fixed_expenses
                        SET last_charged_period = v_period
                        WHERE id = v_rec.id;
                    END LOOP;

                    RETURN v_inserted_count;
                END;
                $$;
                """
            )
        )

        # Intentar registrar el job diario en pg_cron (si la extensión está habilitada en Supabase)
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                    CREATE EXTENSION IF NOT EXISTS pg_cron;
                    PERFORM cron.schedule(
                        'auto-charge-fixed-expenses',
                        '5 6 * * *',
                        'SELECT process_due_fixed_expenses(NULL);'
                    );
                EXCEPTION
                    WHEN OTHERS THEN
                        NULL;
                END
                $$;
                """
            )
        )


def process_due_fixed_expenses(
    session: Session, user_id: int | None = None
) -> int:
    """
    Invoca la función almacenada en PostgreSQL `process_due_fixed_expenses(p_user_id)`
    para garantizar un único reloj (el de la base de datos) y ejecución atómica en 1 solo viaje de red.
    """
    result = session.exec(
        text("SELECT process_due_fixed_expenses(:uid)").bindparams(uid=user_id)
    ).scalar()
    session.commit()
    return int(result or 0)


def get_session():
    with Session(engine) as session:
        yield session
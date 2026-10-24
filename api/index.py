import math
from contextlib import asynccontextmanager
from datetime import date, datetime

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Date, case, cast, func, text
from sqlmodel import Session, select

from api.database import (
    get_local_now,
    get_session,
    init_db,
    process_due_fixed_expenses,
)
from api.models import (
    AuthResponse,
    Category,
    FixedExpense,
    FixedExpenseCreate,
    FixedExpenseUpdate,
    PaginatedTransactionsResponse,
    Transaction,
    TransactionCreate,
    TransactionSummary,
    TransactionUpdate,
    User,
    UserCreate,
    UserLogin,
    UserPublic,
)
from api.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="PWA Finanzas API", version="2.1", lifespan=lifespan)

# Inicializar esquema también al importar para entornos serverless sin ciclo lifespan completo
try:
    init_db()
except Exception as exc:
    print(f"WARN - No se pudo inicializar DB al arrancar: {exc}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/hello")
def read_root():
    return {"message": "api Running successfully"}


# --- AUTENTICACIÓN ---
@app.post(
    "/api/auth/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(user_in: UserCreate, session: Session = Depends(get_session)):
    username = user_in.username.strip().lower()
    if len(username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario debe tener al menos 3 caracteres.",
        )
    if len(user_in.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 6 caracteres.",
        )

    existing = session.exec(select(User).where(User.username == username)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese nombre de usuario ya está registrado.",
        )

    is_first_user = session.exec(select(User)).first() is None

    db_user = User(
        username=username,
        password_hash=hash_password(user_in.password),
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)

    # Si es el primer usuario creado tras la migración, asociarle registros previos sin user_id
    if is_first_user and db_user.id is not None:
        session.exec(
            text(
                "UPDATE transactions SET user_id = :uid WHERE user_id IS NULL"
            ).bindparams(uid=db_user.id)
        )
        session.exec(
            text(
                "UPDATE fixed_expenses SET user_id = :uid WHERE user_id IS NULL"
            ).bindparams(uid=db_user.id)
        )
        session.commit()

    token = create_access_token(user_id=db_user.id, username=db_user.username)
    return AuthResponse(
        access_token=token,
        user=UserPublic.model_validate(db_user),
    )


@app.post("/api/auth/login", response_model=AuthResponse)
def login_user(credentials: UserLogin, session: Session = Depends(get_session)):
    username = credentials.username.strip().lower()
    db_user = session.exec(select(User).where(User.username == username)).first()

    if not db_user or not verify_password(credentials.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos.",
        )

    token = create_access_token(user_id=db_user.id, username=db_user.username)
    return AuthResponse(
        access_token=token,
        user=UserPublic.model_validate(db_user),
    )


@app.get("/api/auth/me", response_model=UserPublic)
def get_me(current_user: User = Depends(get_current_user)):
    return UserPublic.model_validate(current_user)


# --- CATEGORÍAS ---
@app.get("/api/categories", response_model=list[Category])
def get_categories(
    _current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    categories = session.exec(
        select(Category)
        .where(Category.is_active == True)  # noqa: E712
        .order_by(Category.id.asc())
    ).all()
    return categories



def _parse_date_param(raw: str | None) -> date | None:
    if not raw or not raw.strip():
        return None
    val = raw.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Formato de fecha inválido ({val}). Usa dd/mm/yyyy o yyyy-mm-dd.",
    )


# --- TRANSACCIONES ---
@app.get("/api/transactions", response_model=PaginatedTransactionsResponse)
def get_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    category: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Procesar automáticamente gastos fijos vencidos del usuario antes de listar
    process_due_fixed_expenses(session, user_id=current_user.id)

    now = get_local_now()
    today_date = now.date()
    first_of_month = date(today_date.year, today_date.month, 1)

    parsed_from = _parse_date_param(date_from) or first_of_month
    parsed_to = _parse_date_param(date_to) or today_date

    conditions = [
        Transaction.user_id == current_user.id,
        cast(Transaction.date, Date) >= parsed_from,
        cast(Transaction.date, Date) <= parsed_to,
    ]

    if category and category.strip() and category.strip().lower() not in ("all", "todas"):
        conditions.append(
            func.lower(Transaction.category) == category.strip().lower()
        )

    agg_row = session.exec(
        select(
            func.count(Transaction.id),
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == "income", Transaction.amount),
                        else_=0.0,
                    )
                ),
                0.0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == "expense", Transaction.amount),
                        else_=0.0,
                    )
                ),
                0.0,
            ),
            func.coalesce(
                func.sum(case((Transaction.type == "income", 1), else_=0)),
                0,
            ),
            func.coalesce(
                func.sum(case((Transaction.type == "expense", 1), else_=0)),
                0,
            ),
        ).where(*conditions)
    ).one()

    total_count = int(agg_row[0] or 0)
    total_income = float(agg_row[1] or 0.0)
    total_expense = float(agg_row[2] or 0.0)
    income_count = int(agg_row[3] or 0)
    expense_count = int(agg_row[4] or 0)

    total_pages = max(1, math.ceil(total_count / page_size))
    safe_page = min(page, total_pages)
    offset = (safe_page - 1) * page_size

    items = session.exec(
        select(Transaction)
        .where(*conditions)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(page_size)
    ).all()

    return PaginatedTransactionsResponse(
        items=items,
        total=total_count,
        page=safe_page,
        page_size=page_size,
        total_pages=total_pages,
        summary=TransactionSummary(
            total_income=total_income,
            total_expense=total_expense,
            net_balance=total_income - total_expense,
            income_count=income_count,
            expense_count=expense_count,
        ),
    )


@app.post(
    "/api/transactions",
    response_model=Transaction,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    transaction_in: TransactionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    db_transaction = Transaction.model_validate(transaction_in)
    db_transaction.user_id = current_user.id
    session.add(db_transaction)
    session.commit()
    session.refresh(db_transaction)
    return db_transaction


@app.put("/api/transactions/{transaction_id}", response_model=Transaction)
def update_transaction(
    transaction_id: int,
    transaction_in: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    db_transaction = session.get(Transaction, transaction_id)
    if not db_transaction or db_transaction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transacción no encontrada.",
        )

    update_data = transaction_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_transaction, key, value)

    session.add(db_transaction)
    session.commit()
    session.refresh(db_transaction)
    return db_transaction


@app.delete(
    "/api/transactions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    db_transaction = session.get(Transaction, transaction_id)
    if not db_transaction or db_transaction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transacción no encontrada.",
        )

    session.delete(db_transaction)
    session.commit()
    return None


# --- GASTOS FIJOS ---
@app.get("/api/fixed-expenses", response_model=list[FixedExpense])
def get_fixed_expenses(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Asegurar que cualquier gasto fijo vencido este mes ya esté procesado
    process_due_fixed_expenses(session, user_id=current_user.id)

    expenses = session.exec(
        select(FixedExpense)
        .where(FixedExpense.user_id == current_user.id)
        .order_by(FixedExpense.due_day.asc(), FixedExpense.id.desc())
    ).all()
    return expenses


@app.post(
    "/api/fixed-expenses",
    response_model=FixedExpense,
    status_code=status.HTTP_201_CREATED,
)
def create_fixed_expense(
    expense_in: FixedExpenseCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    db_expense = FixedExpense.model_validate(expense_in)
    db_expense.user_id = current_user.id
    session.add(db_expense)
    session.commit()
    session.refresh(db_expense)

    # Si el día de cobro ya llegó o pasó en este mes, cobrarlo automáticamente de inmediato
    process_due_fixed_expenses(session, user_id=current_user.id)
    session.refresh(db_expense)
    return db_expense


@app.put("/api/fixed-expenses/{expense_id}", response_model=FixedExpense)
def update_fixed_expense(
    expense_id: int,
    expense_in: FixedExpenseUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    db_expense = session.get(FixedExpense, expense_id)
    if not db_expense or db_expense.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gasto fijo no encontrado.",
        )

    update_data = expense_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_expense, key, value)

    session.add(db_expense)
    session.commit()

    # Reevaluar por si se activó o cambió su día a uno ya vencido este mes
    process_due_fixed_expenses(session, user_id=current_user.id)
    session.refresh(db_expense)
    return db_expense


@app.post(
    "/api/fixed-expenses/{expense_id}/charge-now",
    response_model=Transaction,
    status_code=status.HTTP_201_CREATED,
)
def charge_fixed_expense_now(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Permite adelantar el cobro del mes actual antes de que llegue el due_day sin duplicarlo después."""
    db_expense = session.get(FixedExpense, expense_id)
    if not db_expense or db_expense.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gasto fijo no encontrado.",
        )

    now = session.exec(
        text("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City'):: timestamp")
    ).scalar() or get_local_now()
    current_period = now.strftime("%Y-%m")

    existing_tx = session.exec(
        select(Transaction).where(
            Transaction.fixed_expense_id == db_expense.id,
            Transaction.billing_period == current_period,
        )
    ).first()
    if existing_tx or db_expense.last_charged_period == current_period:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este gasto fijo ya fue cobrado en el mes actual.",
        )

    new_tx = Transaction(
        type="expense",
        amount=db_expense.amount,
        category=db_expense.category or "Gasto Fijo",
        description=f"Cobro automático: {db_expense.name}",
        date=now,
        created_at=now,
        user_id=current_user.id,
        fixed_expense_id=db_expense.id,
        billing_period=current_period,
    )
    db_expense.last_charged_period = current_period
    session.add(new_tx)
    session.add(db_expense)
    session.commit()
    session.refresh(new_tx)
    return new_tx


@app.delete(
    "/api/fixed-expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_fixed_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    db_expense = session.get(FixedExpense, expense_id)
    if not db_expense or db_expense.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gasto fijo no encontrado.",
        )

    session.delete(db_expense)
    session.commit()
    return None


# --- CRON / PROCESAMIENTO GLOBAL DE GASTOS FIJOS ---
@app.get("/api/cron/process-fixed-expenses")
def cron_process_fixed_expenses(session: Session = Depends(get_session)):
    """Endpoint para ejecutar el procesamiento global de gastos fijos vencidos."""
    processed_count = process_due_fixed_expenses(session, user_id=None)
    return {
        "processed_count": processed_count,
    }

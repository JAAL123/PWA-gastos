from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from api.database import get_session
from api.models import FixedExpense, FixedExpenseCreate, Transaction, TransactionCreate
from api.security import verify_token

app = FastAPI(title="PWA Finanzas API", version="1.0")

# Configurar CORS para permitir peticiones desde tu frontend (local y producción)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/hello")
def read_root():
    return {"message": "api Running successfully"}


@app.get(
    "/api/transactions",
    response_model=list[Transaction],
    dependencies=[Depends(verify_token)],
)
def get_transactions(session: Session = Depends(get_session)):
    transactions = session.exec(
        select(Transaction).order_by(Transaction.date.desc())
    ).all()
    return transactions


@app.post(
    "/api/transactions",
    response_model=Transaction,
    dependencies=[Depends(verify_token)],
)
def create_transaction(
    transaction_in: TransactionCreate, session: Session = Depends(get_session)
):
    db_transaction = Transaction.model_validate(transaction_in)
    session.add(db_transaction)
    session.commit()
    session.refresh(db_transaction)
    return db_transaction


@app.get(
    "/api/fixed-expenses",
    response_model=list[FixedExpense],
    dependencies=[Depends(verify_token)],
)
def get_fixed_expenses(session: Session = Depends(get_session)):
    expenses = session.exec(
        select(FixedExpense).where(FixedExpense.is_active == True)
    ).all()
    return expenses


@app.post(
    "/api/fixed-expenses",
    response_model=FixedExpense,
    dependencies=[Depends(verify_token)],
)
def create_fixed_expense(
    expense_in: FixedExpenseCreate, session: Session = Depends(get_session)
):
    db_expense = FixedExpense.model_validate(expense_in)
    session.add(db_expense)
    session.commit()
    session.refresh(db_expense)
    return db_expense

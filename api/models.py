from datetime import datetime

from sqlmodel import Field, SQLModel


# --- TRANSACCIONES (Ingresos y Gastos) ---
class TransactionBase(SQLModel):
    type: str = Field(index=True)  # 'income' o 'expense'
    amount: float
    category: str
    description: str | None = None
    date: datetime | None = Field(default_factory=datetime.now)

class Transaction(TransactionBase, table=True):
    __tablename__ = "transactions"
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime | None = Field(default_factory=datetime.now)

class TransactionCreate(TransactionBase):
    pass


# --- GASTOS FIJOS ---
class FixedExpenseBase(SQLModel):
    name: str
    amount: float
    due_day: int
    category: str
    is_active: bool = True

class FixedExpense(FixedExpenseBase, table=True):
    __tablename__ = "fixed_expenses"
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime | None = Field(default_factory=datetime.utcnow)

class FixedExpenseCreate(FixedExpenseBase):
    pass
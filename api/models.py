from datetime import datetime

from sqlmodel import Field, SQLModel


# --- USUARIOS ---
class UserBase(SQLModel):
    username: str = Field(index=True, unique=True, min_length=3, max_length=50)


class User(UserBase, table=True):
    __tablename__ = "users"
    id: int | None = Field(default=None, primary_key=True)
    password_hash: str
    created_at: datetime | None = Field(default_factory=datetime.utcnow)


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserLogin(SQLModel):
    username: str
    password: str


class UserPublic(UserBase):
    id: int
    created_at: datetime | None = None


class AuthResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


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
    user_id: int | None = Field(default=None, foreign_key="users.id", index=True)
    fixed_expense_id: int | None = Field(
        default=None, foreign_key="fixed_expenses.id", index=True
    )
    billing_period: str | None = Field(default=None, max_length=7)
    created_at: datetime | None = Field(default_factory=datetime.now)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(SQLModel):
    type: str | None = None
    amount: float | None = None
    category: str | None = None
    description: str | None = None
    date: datetime | None = None


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
    user_id: int | None = Field(default=None, foreign_key="users.id", index=True)
    last_charged_period: str | None = Field(default=None, max_length=7)
    created_at: datetime | None = Field(default_factory=datetime.utcnow)


class FixedExpenseCreate(FixedExpenseBase):
    pass


class FixedExpenseUpdate(SQLModel):
    name: str | None = None
    amount: float | None = None
    due_day: int | None = None
    category: str | None = None
    is_active: bool | None = None


# --- CATEGORÍAS ---
class CategoryBase(SQLModel):
    name: str = Field(index=True, unique=True, max_length=60)
    is_active: bool = True


class Category(CategoryBase, table=True):
    __tablename__ = "categories"
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime | None = Field(default_factory=datetime.utcnow)

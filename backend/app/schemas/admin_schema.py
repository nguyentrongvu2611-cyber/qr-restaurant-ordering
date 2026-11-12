from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

# --- AUTH SCHEMAS ---
class UserRegister(BaseModel):
    username: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = "staff"  # admin, staff, kitchen

class UserLogin(BaseModel):
    username: str
    password: str

# --- CATEGORY SCHEMAS ---
class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    display_order: int = 0
    is_active: bool = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

# --- PRODUCT SCHEMAS ---
class ProductCreate(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None
    price: Decimal
    image_url: Optional[str] = None
    is_available: bool = True

class ProductUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    image_url: Optional[str] = None
    is_available: Optional[bool] = None

# --- TABLE SCHEMAS ---
class TableCreate(BaseModel):
    table_number: str
    capacity: int = 4

class TableUpdate(BaseModel):
    table_number: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[str] = None  # available, occupied, reserved

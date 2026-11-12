from sqlalchemy import Column, BigInteger, String, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base

class CashierShift(Base):
    __tablename__ = "cashier_shifts"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    staff_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    opening_cash = Column(Numeric(12, 2), nullable=False, default=0)
    expected_cash = Column(Numeric(12, 2), nullable=False, default=0)
    actual_cash = Column(Numeric(12, 2), nullable=True)
    difference = Column(Numeric(12, 2), nullable=True)
    note = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="open")  # open, closed
    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)

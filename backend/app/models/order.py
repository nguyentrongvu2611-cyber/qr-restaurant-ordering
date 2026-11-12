from sqlalchemy import Column, BigInteger, String, Text, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from sqlalchemy import Column, BigInteger, String, Integer, Text, DECIMAL, ForeignKey, Boolean, DateTime
class Order(Base):
    __tablename__ = "orders"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    order_code = Column(String(30), unique=True, nullable=False, index=True)
    session_id = Column(BigInteger, ForeignKey("table_sessions.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    note = Column(Text, nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(String(30), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("TableSession", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_history = relationship("OrderStatusHistory", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    order_id = Column(BigInteger, ForeignKey("orders.id"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("products.id"), nullable=False)
    product_name = Column(String(150), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(12, 2), nullable=False)
    item_note = Column(String(255), nullable=True)
    item_status = Column(String(30), nullable=False, default="pending")
    is_priority = Column(Boolean, default=False)
    cancel_reason = Column(String(255), nullable=True)
    updated_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    order = relationship("Order", back_populates="items")

class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    order_id = Column(BigInteger, ForeignKey("orders.id"), nullable=False)
    changed_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    old_status = Column(String(30), nullable=True)
    new_status = Column(String(30), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="status_history")

class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("table_sessions.id"), nullable=False)
    handled_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    request_type = Column(String(30), nullable=False)
    note = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("TableSession", back_populates="service_requests")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("table_sessions.id"), nullable=False)
    confirmed_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(30), nullable=False)
    bank_name = Column(String(100), nullable=True)
    bank_account_no = Column(String(50), nullable=True)
    transfer_content = Column(String(150), nullable=True)
    payment_qr_url = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="unpaid")
    paid_at = Column(DateTime(timezone=True), nullable=True)

    session = relationship("TableSession", back_populates="payments")

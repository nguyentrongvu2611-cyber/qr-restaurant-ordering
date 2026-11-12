from sqlalchemy import Column, BigInteger, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class DiningTable(Base):
    __tablename__ = "dining_tables"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    table_number = Column(String(20), unique=True, nullable=False)
    capacity = Column(Integer, default=4)
    qr_code_token = Column(String(255), unique=True, nullable=False)
    qr_image_url = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="available")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sessions = relationship("TableSession", back_populates="table")

class TableSession(Base):
    __tablename__ = "table_sessions"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    table_id = Column(BigInteger, ForeignKey("dining_tables.id"), nullable=False)
    customer_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    session_token = Column(String(255), unique=True, nullable=False)
    status = Column(String(20), nullable=False, default="active")
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    table = relationship("DiningTable", back_populates="sessions")
    orders = relationship("Order", back_populates="session")
    service_requests = relationship("ServiceRequest", back_populates="session")
    payments = relationship("Payment", back_populates="session")

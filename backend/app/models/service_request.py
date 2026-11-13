from sqlalchemy import Column, BigInteger, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

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
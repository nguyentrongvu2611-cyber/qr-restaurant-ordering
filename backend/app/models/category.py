from sqlalchemy import Column, BigInteger, String, Text, Integer, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    station = Column(String(20), nullable=False, default="KITCHEN") 

    products = relationship("Product", back_populates="category")

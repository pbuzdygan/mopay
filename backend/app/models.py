from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()

class Category(Base):
    __tablename__ = 'categories'
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    items = relationship('Item', back_populates='category', cascade='all, delete-orphan')

class Item(Base):
    __tablename__ = 'items'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey('categories.id'))
    category = relationship('Category', back_populates='items')

class Entry(Base):
    __tablename__ = 'entries'
    id = Column(Integer, primary_key=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1..12
    amount = Column(Float, default=0.0)
    comment = Column(Text, default='')
    type = Column(String, nullable=False)  # 'expense' or 'income'
    category_id = Column(Integer, ForeignKey('categories.id'))
    item_id = Column(Integer, ForeignKey('items.id'))

def get_engine(db_path='data/mopay.db'):
    engine = create_engine(f'sqlite:///{db_path}', connect_args={"check_same_thread": False})
    return engine

def init_db(db_path='data/mopay.db'):
    engine = get_engine(db_path)
    Base.metadata.create_all(engine)
    return engine

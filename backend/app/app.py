from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from sqlalchemy.orm import sessionmaker
from .models import init_db, Category, Item, Entry
import os, csv
from io import StringIO
from sqlalchemy import func

DB_PATH = os.environ.get('MOPAY_DB', 'data/mopay.db')
engine = init_db(DB_PATH)
Session = sessionmaker(bind=engine)

app = Flask(__name__)
CORS(app)

MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

@app.route('/api/data')
def get_data():
    year = int(request.args.get('year', 2025))
    type_ = request.args.get('type', 'expense')
    session = Session()

    categories = session.query(Category).all()
    grid = []
    for cat in categories:
        items = []
        for it in cat.items:
            row = {
                'category_id': cat.id,
                'category_name': cat.name,
                'item_id': it.id,
                'item_name': it.name,
                'months': [0.0]*12,
                'comments': ['']*12
            }
            entries = session.query(Entry).filter_by(year=year, type=type_, category_id=cat.id, item_id=it.id).all()
            for e in entries:
                row['months'][e.month-1] = e.amount
                row['comments'][e.month-1] = e.comment or ''
            items.append(row)
        grid.append({'category': cat.name, 'category_id': cat.id, 'items': items})

    column_sums = [0.0]*12
    total = 0.0
    for g in grid:
        for it in g['items']:
            for m, val in enumerate(it['months']):
                column_sums[m] += val
                total += val
    session.close()
    return jsonify({'year': year, 'type': type_, 'months': MONTHS, 'grid': grid, 'column_sums': column_sums, 'total': total})

@app.route('/api/entry', methods=['POST'])
def upsert_entry():
    data = request.json
    session = Session()
    year = int(data['year'])
    month = int(data['month'])
    type_ = data['type']
    category_id = data['category_id']
    item_id = data['item_id']
    amount = float(data.get('amount', 0) or 0)
    comment = data.get('comment', '')

    entry = session.query(Entry).filter_by(year=year, month=month, type=type_, category_id=category_id, item_id=item_id).first()
    if not entry:
        entry = Entry(year=year, month=month, type=type_, category_id=category_id, item_id=item_id, amount=amount, comment=comment)
        session.add(entry)
    else:
        entry.amount = amount
        entry.comment = comment
    session.commit()
    session.close()
    return jsonify({'status': 'ok'})

@app.route('/api/category', methods=['POST'])
def add_category():
    data = request.json
    name = data.get('name')
    items = data.get('items', [])
    session = Session()
    cat = session.query(Category).filter_by(name=name).first()
    if not cat:
        cat = Category(name=name)
        session.add(cat)
        session.flush()
    for itname in items:
        it = Item(name=itname, category=cat)
        session.add(it)
    session.commit()
    session.close()
    return jsonify({'status': 'ok'})

@app.route('/api/dashboard')
def dashboard():
    year = int(request.args.get('year', 2025))
    session = Session()
    from sqlalchemy import func
    income_total = session.query(func.coalesce(func.sum(Entry.amount), 0)).filter(Entry.year==year, Entry.type=='income').scalar() or 0
    expense_total = session.query(func.coalesce(func.sum(Entry.amount), 0)).filter(Entry.year==year, Entry.type=='expense').scalar() or 0
    balance = income_total - expense_total
    percent_spent = (expense_total / income_total * 100) if income_total else 0
    session.close()
    return jsonify({'year': year, 'income_total': income_total, 'expense_total': expense_total, 'balance': balance, 'percent_spent': percent_spent})

@app.route('/api/export')
def export_csv():
    session = Session()
    entries = session.query(Entry).all()
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['type','year','month','category_id','category_name','item_id','item_name','amount','comment'])
    for e in entries:
        cat = session.query(Category).filter_by(id=e.category_id).first()
        it = session.query(Item).filter_by(id=e.item_id).first()
        writer.writerow([e.type, e.year, e.month, e.category_id, cat.name if cat else '', e.item_id, it.name if it else '', e.amount, e.comment or ''])
    session.close()
    output.seek(0)
    return send_file(StringIO(output.getvalue()), mimetype='text/csv', as_attachment=True, download_name='mopay_export.csv')

@app.route('/api/import', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error':'no file provided'}), 400
    file = request.files['file']
    stream = StringIO(file.read().decode('utf-8'))
    reader = csv.DictReader(stream)
    session = Session()
    for row in reader:
        cat_name = row.get('category_name') or 'Uncategorized'
        cat = session.query(Category).filter_by(name=cat_name).first()
        if not cat:
            cat = Category(name=cat_name)
            session.add(cat)
            session.flush()
        item_name = row.get('item_name') or 'Item'
        it = session.query(Item).filter_by(name=item_name, category_id=cat.id).first()
        if not it:
            it = Item(name=item_name, category=cat)
            session.add(it)
            session.flush()
        e = Entry(
            type=row.get('type','expense'),
            year=int(row.get('year', 2025)),
            month=int(row.get('month', 1)),
            amount=float(row.get('amount', 0) or 0),
            comment=row.get('comment',''),
            category_id=cat.id,
            item_id=it.id
        )
        session.add(e)
    session.commit()
    session.close()
    return jsonify({'status':'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)

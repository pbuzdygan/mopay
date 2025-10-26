from flask import request, jsonify
import os
from functools import wraps

def require_pin(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        pin = request.headers.get('X-MOPAY-PIN')
        env_pin = os.environ.get('MOPAY_PIN')
        if not env_pin or not pin or pin != env_pin:
            return jsonify({'error': 'unauthorized'}), 401
        return f(*args, **kwargs)
    return wrapped

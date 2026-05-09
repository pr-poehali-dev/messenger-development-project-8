import json
import os
import hashlib
import secrets
import psycopg2

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def hash_password(password: str, salt: str = None) -> tuple:
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return h, salt

def handler(event: dict, context) -> dict:
    """Регистрация и авторизация пользователей"""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action')

    db = get_db()
    cur = db.cursor()

    if action == 'register':
        username = body.get('username', '').strip().lower()
        display_name = body.get('display_name', '').strip()
        password = body.get('password', '')

        if not username or not display_name or not password:
            db.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Заполните все поля'})}

        if len(username) < 3:
            db.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Логин минимум 3 символа'})}

        if len(password) < 6:
            db.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cur.fetchone():
            db.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Пользователь уже существует'})}

        pw_hash, salt = hash_password(password)
        stored = f"{salt}:{pw_hash}"
        cur.execute(
            "INSERT INTO users (username, display_name, password_hash) VALUES (%s, %s, %s) RETURNING id",
            (username, display_name, stored)
        )
        user_id = cur.fetchone()[0]
        token = secrets.token_hex(32)
        db.commit()
        db.close()

        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'user_id': user_id, 'username': username, 'display_name': display_name, 'token': token})
        }

    elif action == 'login':
        username = body.get('username', '').strip().lower()
        password = body.get('password', '')

        cur.execute("SELECT id, display_name, password_hash FROM users WHERE username = %s", (username,))
        row = cur.fetchone()
        db.close()

        if not row:
            return {'statusCode': 401, 'headers': cors, 'body': json.dumps({'error': 'Неверный логин или пароль'})}

        user_id, display_name, stored = row
        salt, pw_hash = stored.split(':', 1)
        check_hash, _ = hash_password(password, salt)

        if check_hash != pw_hash:
            return {'statusCode': 401, 'headers': cors, 'body': json.dumps({'error': 'Неверный логин или пароль'})}

        token = secrets.token_hex(32)
        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'user_id': user_id, 'username': username, 'display_name': display_name, 'token': token})
        }

    elif action == 'get_users':
        user_id = body.get('user_id')
        search = body.get('search', '').strip().lower()
        if search:
            cur.execute(
                "SELECT id, username, display_name FROM users WHERE id != %s AND (LOWER(username) LIKE %s OR LOWER(display_name) LIKE %s) LIMIT 20",
                (user_id, f'%{search}%', f'%{search}%')
            )
        else:
            cur.execute(
                "SELECT id, username, display_name FROM users WHERE id != %s LIMIT 20",
                (user_id,)
            )
        rows = cur.fetchall()
        db.close()
        users = [{'id': r[0], 'username': r[1], 'display_name': r[2]} for r in rows]
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'users': users})}

    db.close()
    return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Неизвестное действие'})}

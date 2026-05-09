import json
import os
import hashlib
import secrets
import base64
import psycopg2
import boto3

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )

def hash_password(password: str, salt: str = None) -> tuple:
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return h, salt

def handler(event: dict, context) -> dict:
    """Регистрация, авторизация и управление профилем пользователей"""
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
        avatar_b64 = body.get('avatar_b64')
        avatar_mime = body.get('avatar_mime', 'image/jpeg')

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
        db.commit()

        avatar_url = None
        if avatar_b64:
            try:
                ext = 'jpg' if 'jpeg' in avatar_mime else avatar_mime.split('/')[-1]
                key = f"avatars/{user_id}.{ext}"
                s3 = get_s3()
                s3.put_object(Bucket='files', Key=key, Body=base64.b64decode(avatar_b64), ContentType=avatar_mime)
                avatar_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
                cur.execute("UPDATE users SET avatar_url = %s WHERE id = %s", (avatar_url, user_id))
                db.commit()
            except Exception:
                pass

        token = secrets.token_hex(32)
        db.close()
        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'user_id': user_id, 'username': username, 'display_name': display_name, 'token': token, 'avatar_url': avatar_url})
        }

    elif action == 'login':
        username = body.get('username', '').strip().lower()
        password = body.get('password', '')

        cur.execute("SELECT id, display_name, password_hash, avatar_url FROM users WHERE username = %s", (username,))
        row = cur.fetchone()
        db.close()

        if not row:
            return {'statusCode': 401, 'headers': cors, 'body': json.dumps({'error': 'Неверный логин или пароль'})}

        user_id, display_name, stored, avatar_url = row
        salt, pw_hash = stored.split(':', 1)
        check_hash, _ = hash_password(password, salt)

        if check_hash != pw_hash:
            return {'statusCode': 401, 'headers': cors, 'body': json.dumps({'error': 'Неверный логин или пароль'})}

        token = secrets.token_hex(32)
        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'user_id': user_id, 'username': username, 'display_name': display_name, 'token': token, 'avatar_url': avatar_url})
        }

    elif action == 'get_users':
        user_id = body.get('user_id')
        search = body.get('search', '').strip().lower()
        if search:
            cur.execute(
                "SELECT id, username, display_name, avatar_url FROM users WHERE id != %s AND (LOWER(username) LIKE %s OR LOWER(display_name) LIKE %s) LIMIT 20",
                (user_id, f'%{search}%', f'%{search}%')
            )
        else:
            cur.execute(
                "SELECT id, username, display_name, avatar_url FROM users WHERE id != %s LIMIT 20",
                (user_id,)
            )
        rows = cur.fetchall()
        db.close()
        users = [{'id': r[0], 'username': r[1], 'display_name': r[2], 'avatar_url': r[3]} for r in rows]
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'users': users})}

    elif action == 'update_profile':
        user_id = body.get('user_id')
        display_name = body.get('display_name', '').strip()
        username = body.get('username', '').strip().lower()
        avatar_b64 = body.get('avatar_b64')
        avatar_mime = body.get('avatar_mime', 'image/jpeg')

        if not display_name or not username:
            db.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Заполните все поля'})}
        if len(username) < 3:
            db.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Логин минимум 3 символа'})}

        cur.execute("SELECT id FROM users WHERE username = %s AND id != %s", (username, user_id))
        if cur.fetchone():
            db.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Логин уже занят'})}

        avatar_url = None
        if avatar_b64:
            try:
                ext = 'jpg' if 'jpeg' in avatar_mime else avatar_mime.split('/')[-1]
                key = f"avatars/{user_id}.{ext}"
                s3 = get_s3()
                s3.put_object(Bucket='files', Key=key, Body=base64.b64decode(avatar_b64), ContentType=avatar_mime)
                avatar_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            except Exception:
                pass

        if avatar_url:
            cur.execute("UPDATE users SET display_name = %s, username = %s, avatar_url = %s WHERE id = %s", (display_name, username, avatar_url, user_id))
        else:
            cur.execute("UPDATE users SET display_name = %s, username = %s WHERE id = %s", (display_name, username, user_id))

        cur.execute("SELECT avatar_url FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        final_avatar = avatar_url or (row[0] if row else None)

        db.commit()
        db.close()
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'display_name': display_name, 'username': username, 'avatar_url': final_avatar})}

    elif action == 'change_password':
        user_id = body.get('user_id')
        old_password = body.get('old_password', '')
        new_password = body.get('new_password', '')

        if len(new_password) < 6:
            db.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Новый пароль минимум 6 символов'})}

        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row:
            db.close()
            return {'statusCode': 404, 'headers': cors, 'body': json.dumps({'error': 'Пользователь не найден'})}

        stored = row[0]
        salt, pw_hash = stored.split(':', 1)
        check_hash, _ = hash_password(old_password, salt)
        if check_hash != pw_hash:
            db.close()
            return {'statusCode': 401, 'headers': cors, 'body': json.dumps({'error': 'Неверный текущий пароль'})}

        new_hash, new_salt = hash_password(new_password)
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (f"{new_salt}:{new_hash}", user_id))
        db.commit()
        db.close()
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True})}

    db.close()
    return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Неизвестное действие'})}

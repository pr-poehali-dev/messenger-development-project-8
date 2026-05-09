import json
import os
import psycopg2

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event: dict, context) -> dict:
    """Работа с чатами и сообщениями"""
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

    if action == 'get_conversations':
        user_id = body.get('user_id')
        cur.execute("""
            SELECT
                c.id,
                u.id as other_user_id,
                u.display_name,
                u.username,
                (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_time
            FROM conversations c
            JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = %s
            JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id != %s
            JOIN users u ON u.id = cm2.user_id
            ORDER BY last_time DESC NULLS LAST
        """, (user_id, user_id))
        rows = cur.fetchall()
        db.close()
        convs = [{
            'id': r[0],
            'other_user_id': r[1],
            'display_name': r[2],
            'username': r[3],
            'last_message': r[4],
            'last_time': r[5].isoformat() if r[5] else None
        } for r in rows]
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'conversations': convs})}

    elif action == 'get_or_create_conversation':
        user_id = body.get('user_id')
        other_user_id = body.get('other_user_id')

        cur.execute("""
            SELECT c.id FROM conversations c
            JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = %s
            JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = %s
        """, (user_id, other_user_id))
        row = cur.fetchone()

        if row:
            db.close()
            return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'conversation_id': row[0]})}

        cur.execute("INSERT INTO conversations DEFAULT VALUES RETURNING id")
        conv_id = cur.fetchone()[0]
        cur.execute("INSERT INTO conversation_members (conversation_id, user_id) VALUES (%s, %s)", (conv_id, user_id))
        cur.execute("INSERT INTO conversation_members (conversation_id, user_id) VALUES (%s, %s)", (conv_id, other_user_id))
        db.commit()
        db.close()
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'conversation_id': conv_id})}

    elif action == 'get_messages':
        conversation_id = body.get('conversation_id')
        user_id = body.get('user_id')

        cur.execute("""
            SELECT m.id, m.content, m.created_at, m.sender_id, u.display_name
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.conversation_id = %s
            ORDER BY m.created_at ASC
            LIMIT 100
        """, (conversation_id,))
        rows = cur.fetchall()
        db.close()
        msgs = [{
            'id': r[0],
            'content': r[1],
            'created_at': r[2].isoformat(),
            'sender_id': r[3],
            'sender_name': r[4],
            'is_mine': r[3] == user_id
        } for r in rows]
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'messages': msgs})}

    elif action == 'send_message':
        conversation_id = body.get('conversation_id')
        sender_id = body.get('sender_id')
        content = body.get('content', '').strip()

        if not content:
            db.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Пустое сообщение'})}

        cur.execute(
            "INSERT INTO messages (conversation_id, sender_id, content) VALUES (%s, %s, %s) RETURNING id, created_at",
            (conversation_id, sender_id, content)
        )
        msg_id, created_at = cur.fetchone()
        db.commit()
        db.close()
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'id': msg_id, 'created_at': created_at.isoformat()})}

    db.close()
    return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Неизвестное действие'})}

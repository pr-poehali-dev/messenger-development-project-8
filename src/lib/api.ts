const AUTH_URL = 'https://functions.poehali.dev/21700e86-1e2f-487c-8cee-c2f7ecf06a52';
const MESSAGES_URL = 'https://functions.poehali.dev/bf0fc815-d16f-41a1-971d-7b91e7f9ace9';

async function call(url: string, body: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
    if (typeof data === 'string') data = JSON.parse(data);
  } catch {
    data = { error: text };
  }
  if (!res.ok && !data.error) data.error = 'Ошибка сервера';
  return data;
}

export const api = {
  register: (username: string, display_name: string, password: string) =>
    call(AUTH_URL, { action: 'register', username, display_name, password }),

  login: (username: string, password: string) =>
    call(AUTH_URL, { action: 'login', username, password }),

  getUsers: (user_id: number, search: string) =>
    call(AUTH_URL, { action: 'get_users', user_id, search }),

  updateProfile: (user_id: number, display_name: string, username: string) =>
    call(AUTH_URL, { action: 'update_profile', user_id, display_name, username }),

  changePassword: (user_id: number, old_password: string, new_password: string) =>
    call(AUTH_URL, { action: 'change_password', user_id, old_password, new_password }),

  getConversations: (user_id: number) =>
    call(MESSAGES_URL, { action: 'get_conversations', user_id }),

  getOrCreateConversation: (user_id: number, other_user_id: number) =>
    call(MESSAGES_URL, { action: 'get_or_create_conversation', user_id, other_user_id }),

  getMessages: (conversation_id: number, user_id: number) =>
    call(MESSAGES_URL, { action: 'get_messages', conversation_id, user_id }),

  sendMessage: (conversation_id: number, sender_id: number, content: string) =>
    call(MESSAGES_URL, { action: 'send_message', conversation_id, sender_id, content }),
};
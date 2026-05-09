export interface User {
  user_id: number;
  username: string;
  display_name: string;
  token: string;
  avatar_url?: string;
}

const KEY = 'messenger_user';

export function saveUser(user: User) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function loadUser(): User | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function clearUser() {
  localStorage.removeItem(KEY);
}
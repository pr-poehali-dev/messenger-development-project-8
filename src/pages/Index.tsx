import { useState, useEffect } from 'react';
import { loadUser, User } from '@/lib/auth';
import AuthPage from '@/components/AuthPage';
import MessengerPage from '@/components/MessengerPage';

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setUser(loadUser());
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!user) {
    return <AuthPage onAuth={u => setUser(u)} />;
  }

  return <MessengerPage user={user} onLogout={() => setUser(null)} />;
}

import { useState } from 'react';
import { api } from '@/lib/api';
import { saveUser, User } from '@/lib/auth';
import Icon from '@/components/ui/icon';
import AvatarPicker from '@/components/AvatarPicker';

interface Props {
  onAuth: (user: User) => void;
}

export default function AuthPage({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [avatarB64, setAvatarB64] = useState<string | undefined>();
  const [avatarMime, setAvatarMime] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (mode === 'login') {
        data = await api.login(username, password);
      } else {
        data = await api.register(username, displayName, password, avatarB64, avatarMime);
      }
      if (data.error) {
        setError(data.error);
      } else {
        saveUser(data as User);
        onAuth(data as User);
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: 'login' | 'register') {
    setMode(m);
    setError('');
    setAvatarB64(undefined);
    setAvatarMime(undefined);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary mb-4">
            <Icon name="MessageCircle" size={24} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Волна</h1>
          <p className="text-sm text-muted-foreground mt-1">Простой мессенджер</p>
        </div>

        <div className="flex border border-border rounded-xl p-1 mb-6 bg-secondary">
          <button
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
              mode === 'login' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Войти
          </button>
          <button
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
              mode === 'register' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 animate-slide-up">
          {mode === 'register' && (
            <>
              {/* Avatar picker */}
              <div className="flex justify-center pb-1">
                <div className="flex flex-col items-center gap-1.5">
                  <AvatarPicker
                    name={displayName || 'A'}
                    size={72}
                    onChange={(b64, mime) => { setAvatarB64(b64); setAvatarMime(mime); }}
                  />
                  <span className="text-xs text-muted-foreground">Нажмите, чтобы добавить фото</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Имя</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Как вас зовут?"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Логин</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-destructive/8 text-destructive text-sm">
              <Icon name="AlertCircle" size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium mt-2 hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Icon name="Loader2" size={14} className="animate-spin" />
                {mode === 'login' ? 'Входим...' : 'Создаём...'}
              </span>
            ) : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
      </div>
    </div>
  );
}

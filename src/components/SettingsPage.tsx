import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { User, saveUser } from '@/lib/auth';
import Icon from '@/components/ui/icon';

interface Props {
  user: User;
  onClose: () => void;
  onUserUpdate: (u: User) => void;
}

type Tab = 'profile' | 'password' | 'appearance' | 'notifications';

function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, setDark };
}

function useNotifSettings() {
  const [sound, setSound] = useState(() => localStorage.getItem('notif_sound') !== 'off');
  const [desktop, setDesktop] = useState(() => localStorage.getItem('notif_desktop') === 'on');

  function toggleSound() {
    const next = !sound;
    setSound(next);
    localStorage.setItem('notif_sound', next ? 'on' : 'off');
  }

  async function toggleDesktop() {
    if (!desktop) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setDesktop(true);
        localStorage.setItem('notif_desktop', 'on');
      }
    } else {
      setDesktop(false);
      localStorage.setItem('notif_desktop', 'off');
    }
  }

  return { sound, toggleSound, desktop, toggleDesktop };
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-primary' : 'bg-border'}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  );
}

export default function SettingsPage({ user, onClose, onUserUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('profile');
  const { dark, setDark } = useTheme();
  const { sound, toggleSound, desktop, toggleDesktop } = useNotifSettings();

  const [displayName, setDisplayName] = useState(user.display_name);
  const [username, setUsername] = useState(user.username);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileLoading(true);
    const data = await api.updateProfile(user.user_id, displayName, username);
    setProfileLoading(false);
    if (data.error) {
      setProfileMsg({ text: data.error, ok: false });
    } else {
      const updated = { ...user, display_name: data.display_name, username: data.username };
      saveUser(updated);
      onUserUpdate(updated);
      setProfileMsg({ text: 'Профиль обновлён', ok: true });
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassMsg(null);
    if (newPass !== confirmPass) {
      setPassMsg({ text: 'Пароли не совпадают', ok: false });
      return;
    }
    setPassLoading(true);
    const data = await api.changePassword(user.user_id, oldPass, newPass);
    setPassLoading(false);
    if (data.error) {
      setPassMsg({ text: data.error, ok: false });
    } else {
      setPassMsg({ text: 'Пароль изменён', ok: true });
      setOldPass(''); setNewPass(''); setConfirmPass('');
    }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Профиль', icon: 'User' },
    { id: 'password', label: 'Пароль', icon: 'Lock' },
    { id: 'appearance', label: 'Внешний вид', icon: 'Palette' },
    { id: 'notifications', label: 'Уведомления', icon: 'Bell' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Настройки</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="flex">
          {/* Sidebar tabs */}
          <div className="w-40 border-r border-border py-3 flex-shrink-0">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ${
                  tab === t.id
                    ? 'text-primary font-medium bg-primary/6'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Icon name={t.icon} size={15} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 min-h-[320px]">

            {/* Profile */}
            {tab === 'profile' && (
              <form onSubmit={saveProfile} className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-semibold flex-shrink-0"
                    style={{ backgroundColor: ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#6366F1'][user.display_name.charCodeAt(0) % 6] }}
                  >
                    {user.display_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Имя</label>
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Логин</label>
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    required
                  />
                </div>

                {profileMsg && (
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${profileMsg.ok ? 'bg-green-50 text-green-700' : 'bg-destructive/8 text-destructive'}`}>
                    <Icon name={profileMsg.ok ? 'CheckCircle' : 'AlertCircle'} size={14} />
                    {profileMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={profileLoading}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {profileLoading && <Icon name="Loader2" size={14} className="animate-spin" />}
                  Сохранить
                </button>
              </form>
            )}

            {/* Password */}
            {tab === 'password' && (
              <form onSubmit={savePassword} className="space-y-4 animate-fade-in">
                <p className="text-xs text-muted-foreground mb-1">Минимум 6 символов</p>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Текущий пароль</label>
                  <input
                    type="password"
                    value={oldPass}
                    onChange={e => setOldPass(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Новый пароль</label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Повторите пароль</label>
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    required
                  />
                </div>

                {passMsg && (
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${passMsg.ok ? 'bg-green-50 text-green-700' : 'bg-destructive/8 text-destructive'}`}>
                    <Icon name={passMsg.ok ? 'CheckCircle' : 'AlertCircle'} size={14} />
                    {passMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={passLoading}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {passLoading && <Icon name="Loader2" size={14} className="animate-spin" />}
                  Изменить пароль
                </button>
              </form>
            )}

            {/* Appearance */}
            {tab === 'appearance' && (
              <div className="space-y-2 animate-fade-in">
                <p className="text-xs text-muted-foreground mb-4">Выберите тему оформления</p>

                <button
                  onClick={() => setDark(false)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all ${!dark ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center shadow-sm">
                    <Icon name="Sun" size={16} className="text-yellow-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Светлая</p>
                    <p className="text-xs text-muted-foreground">Классический вид</p>
                  </div>
                  {!dark && <Icon name="Check" size={16} className="text-primary ml-auto" />}
                </button>

                <button
                  onClick={() => setDark(true)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all ${dark ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center shadow-sm">
                    <Icon name="Moon" size={16} className="text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Тёмная</p>
                    <p className="text-xs text-muted-foreground">Для работы вечером</p>
                  </div>
                  {dark && <Icon name="Check" size={16} className="text-primary ml-auto" />}
                </button>
              </div>
            )}

            {/* Notifications */}
            {tab === 'notifications' && (
              <div className="space-y-1 animate-fade-in">
                <p className="text-xs text-muted-foreground mb-4">Управление уведомлениями</p>

                <div className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-border hover:bg-secondary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <Icon name="Volume2" size={15} className="text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Звук сообщений</p>
                      <p className="text-xs text-muted-foreground">Звуковой сигнал при получении</p>
                    </div>
                  </div>
                  <Toggle checked={sound} onChange={toggleSound} />
                </div>

                <div className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-border hover:bg-secondary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <Icon name="Monitor" size={15} className="text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Уведомления на ПК</p>
                      <p className="text-xs text-muted-foreground">Всплывающие окна браузера</p>
                    </div>
                  </div>
                  <Toggle checked={desktop} onChange={toggleDesktop} />
                </div>

                {desktop && (
                  <p className="text-xs text-muted-foreground px-1 pt-1">
                    Убедитесь, что браузер разрешил уведомления для этого сайта.
                  </p>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

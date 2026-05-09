import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { User, clearUser } from '@/lib/auth';
import Icon from '@/components/ui/icon';
import SettingsPage from '@/components/SettingsPage';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    (prompt as BeforeInstallPromptEvent).prompt();
    const { outcome } = await (prompt as BeforeInstallPromptEvent).userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  };

  return { canInstall: !!prompt && !installed, install };
}

interface Conversation {
  id: number;
  other_user_id: number;
  display_name: string;
  username: string;
  last_message: string | null;
  last_time: string | null;
}

interface Message {
  id: number;
  content: string;
  created_at: string;
  sender_id: number;
  sender_name: string;
  is_mine: boolean;
}

interface SearchUser {
  id: number;
  username: string;
  display_name: string;
}

interface Props {
  user: User;
  onLogout: () => void;
}

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
      className="rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 select-none"
    >
      {initials}
    </div>
  );
}

export default function MessengerPage({ user: initialUser, onLogout }: Props) {
  const { canInstall, install } = useInstallPrompt();
  const [user, setUser] = useState<User>(initialUser);
  const [showSettings, setShowSettings] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversations = useCallback(async () => {
    const data = await api.getConversations(user.user_id);
    if (data.conversations) setConversations(data.conversations);
    setLoadingConvs(false);
  }, [user.user_id]);

  const loadMessages = useCallback(async (convId: number) => {
    const data = await api.getMessages(convId, user.user_id);
    if (data.messages) {
      setMessages(data.messages);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [user.user_id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (activeConv) {
      pollRef.current = setInterval(() => {
        loadMessages(activeConv.id);
        loadConversations();
      }, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConv, loadMessages, loadConversations]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const data = await api.getUsers(user.user_id, searchQuery);
      if (data.users) setSearchResults(data.users);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, user.user_id]);

  async function openConversation(otherUserId: number, otherUser?: SearchUser) {
    const data = await api.getOrCreateConversation(user.user_id, otherUserId);
    if (!data.conversation_id) return;
    const convId = data.conversation_id;

    await loadConversations();
    setConversations(prev => {
      const found = prev.find(c => c.id === convId);
      if (!found && otherUser) {
        const newConv: Conversation = {
          id: convId,
          other_user_id: otherUser.id,
          display_name: otherUser.display_name,
          username: otherUser.username,
          last_message: null,
          last_time: null,
        };
        setActiveConv(newConv);
        loadMessages(convId);
      } else if (found) {
        setActiveConv(found);
        loadMessages(convId);
      }
      return prev;
    });

    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    inputRef.current?.focus();
  }

  async function selectConversation(conv: Conversation) {
    setActiveConv(conv);
    setMessages([]);
    await loadMessages(conv.id);
    inputRef.current?.focus();
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activeConv || sendingMsg) return;
    const content = input.trim();
    setInput('');
    setSendingMsg(true);

    const tempMsg: Message = {
      id: Date.now(),
      content,
      created_at: new Date().toISOString(),
      sender_id: user.user_id,
      sender_name: user.display_name,
      is_mine: true,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

    await api.sendMessage(activeConv.id, user.user_id, content);
    setSendingMsg(false);
    loadMessages(activeConv.id);
    loadConversations();
  }

  function logout() {
    clearUser();
    onLogout();
  }

  return (
    <>
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <div className={`${activeConv ? 'hidden md:flex' : 'flex'} w-full md:w-72 lg:w-80 flex-col border-r border-border bg-white`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Avatar name={user.display_name} size={32} />
            <span className="text-sm font-medium text-foreground truncate max-w-[120px]">{user.display_name}</span>
          </div>
          <div className="flex items-center gap-1">
            {canInstall && (
              <button
                onClick={install}
                className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 active:scale-95 transition-all"
                title="Установить приложение на ПК"
              >
                <Icon name="Download" size={13} />
                <span>Скачать</span>
              </button>
            )}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${showSearch ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
              title="Новый чат"
            >
              <Icon name="PenSquare" size={16} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Настройки"
            >
              <Icon name="Settings" size={16} />
            </button>
            <button
              onClick={logout}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Выйти"
            >
              <Icon name="LogOut" size={16} />
            </button>
          </div>
        </div>

        {/* Search new chat */}
        {showSearch && (
          <div className="px-3 py-3 border-b border-border animate-slide-up">
            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск пользователей..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-secondary rounded-lg border-none outline-none text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/30"
                autoFocus
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => openConversation(u.id, u)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-secondary transition-colors text-left"
                  >
                    <Avatar name={u.display_name} size={28} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2 px-2">Пользователи не найдены</p>
            )}
          </div>
        )}

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
          {loadingConvs ? (
            <div className="flex items-center justify-center h-24">
              <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 px-6 text-center">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-3">
                <Icon name="MessageCircle" size={18} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Нет чатов</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Нажмите карандаш, чтобы начать переписку</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full flex items-center gap-3 px-3 py-3 transition-colors text-left hover:bg-secondary/60 ${
                  activeConv?.id === conv.id ? 'bg-secondary' : ''
                }`}
              >
                <Avatar name={conv.display_name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">{conv.display_name}</span>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{formatTime(conv.last_time)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.last_message || 'Нет сообщений'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`${activeConv ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Icon name="MessageCircle" size={28} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Выберите чат</h2>
            <p className="text-sm text-muted-foreground max-w-xs">Откройте существующую переписку или начните новую</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-white">
              <button
                onClick={() => setActiveConv(null)}
                className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
              >
                <Icon name="ChevronLeft" size={20} />
              </button>
              <Avatar name={activeConv.display_name} size={36} />
              <div>
                <p className="text-sm font-medium text-foreground">{activeConv.display_name}</p>
                <p className="text-xs text-muted-foreground">@{activeConv.username}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-1">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Начните переписку</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const showName = !msg.is_mine && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);
                  const isFirst = i === 0 || messages[i - 1]?.sender_id !== msg.sender_id;
                  const isLast = i === messages.length - 1 || messages[i + 1]?.sender_id !== msg.sender_id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'} ${isFirst ? 'mt-3' : 'mt-0.5'} animate-message-in`}
                    >
                      <div className={`flex flex-col ${msg.is_mine ? 'items-end' : 'items-start'} max-w-[70%]`}>
                        {showName && (
                          <span className="text-xs text-muted-foreground mb-1 ml-2">{msg.sender_name}</span>
                        )}
                        <div
                          className={`px-3.5 py-2 text-sm leading-relaxed ${
                            msg.is_mine
                              ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                              : 'bg-white border border-border text-foreground rounded-2xl rounded-bl-md'
                          } ${isLast ? '' : msg.is_mine ? 'rounded-br-2xl' : 'rounded-bl-2xl'}`}
                        >
                          {msg.content}
                        </div>
                        {isLast && (
                          <span className="text-[10px] text-muted-foreground mt-1 mx-1">{formatTime(msg.created_at)}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border bg-white">
              <form onSubmit={sendMessage} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Написать сообщение..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sendingMsg}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40"
                >
                  <Icon name="Send" size={16} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>

    {showSettings && (
      <SettingsPage
        user={user}
        onClose={() => setShowSettings(false)}
        onUserUpdate={u => setUser(u)}
      />
    )}
    </>
  );
}
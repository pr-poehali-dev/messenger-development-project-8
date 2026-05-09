import { useRef, useState } from 'react';
import Icon from '@/components/ui/icon';

interface Props {
  name: string;
  currentUrl?: string;
  size?: number;
  onChange: (b64: string, mime: string) => void;
}

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];

export function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function getColor(name: string) {
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

export default function AvatarPicker({ name, currentUrl, size = 72, onChange }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, b64] = result.split(',');
      const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
      setPreview(result);
      onChange(b64, mime);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {/* Avatar circle */}
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center text-white font-semibold cursor-pointer select-none"
        style={{
          backgroundColor: preview ? 'transparent' : getColor(name),
          fontSize: size * 0.32,
        }}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          getInitials(name || '?')
        )}
      </div>

      {/* Camera overlay */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors border-2 border-white"
      >
        <Icon name="Camera" size={12} />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

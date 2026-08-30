import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useAuth } from '../../context/AuthContext';

export const LoginDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({
  open,
  onOpenChange,
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputClass =
    'w-full bg-secondary/60 border border-border rounded-[2px] px-2 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = mode === 'login' ? await login(email, password) : await register(email, password);
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      setEmail('');
      setPassword('');
    } else {
      setError(result.error ?? 'Something went wrong');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-mono text-xs tracking-widest uppercase">
            {mode === 'login' ? 'Account Login' : 'Create Account'}
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px]">
            Log in to persist saved accounts and credentials across sessions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-2.5 font-mono text-xs">
          <input
            type="email"
            required
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            autoComplete="email"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {error && <p className="text-destructive text-[10px]">{error}</p>}
          <Button type="submit" size="sm" className="w-full font-mono text-xs" disabled={busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Log In' : 'Create Account'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {mode === 'login' ? 'No account? Register' : 'Have an account? Log in'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

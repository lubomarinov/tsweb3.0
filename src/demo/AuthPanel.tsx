import { useState } from 'react';
import type { ApiError } from '../core/api';

type Mode = 'login' | 'register';

interface AuthPanelProps {
  readonly busy: boolean;
  readonly error: ApiError | null;
  readonly onLogin: (email: string, password: string) => Promise<boolean>;
  readonly onRegister: (
    email: string,
    fullName: string,
    password: string,
  ) => Promise<boolean>;
  readonly onClearError: () => void;
}

/** Съобщения по код, а не по текста от сървъра. */
const MESSAGES: Record<string, string> = {
  email_taken: 'Вече има регистрация с този имейл.',
  invalid_credentials: 'Грешен имейл или парола.',
  network_error: 'Сървърът не отговаря. Провери дали бекендът е вдигнат.',
};

export function AuthPanel({
  busy,
  error,
  onLogin,
  onRegister,
  onClearError,
}: AuthPanelProps) {
  const [mode, setMode] = useState<Mode>('register');
  const [email, setEmail] = useState('ivan@example.com');
  const [fullName, setFullName] = useState('Иван Петров');
  const [password, setPassword] = useState('silna-parola-123');

  const switchTo = (next: Mode) => {
    setMode(next);
    onClearError();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'login') void onLogin(email, password);
    else void onRegister(email, fullName, password);
  };

  // Сървърът иска поне 8 знака — проверяваме и тук, за да не пращаме
  // заявка, чийто отказ е предвидим.
  const valid = email.includes('@') && password.length >= 8 &&
    (mode === 'login' || fullName.trim().length >= 2);

  return (
    <form onSubmit={submit}>
      <div className="tabs">
        <button
          type="button"
          className={`tab ${mode === 'register' ? 'tab-active' : ''}`}
          onClick={() => switchTo('register')}
        >
          Регистрация
        </button>
        <button
          type="button"
          className={`tab ${mode === 'login' ? 'tab-active' : ''}`}
          onClick={() => switchTo('login')}
        >
          Вход
        </button>
      </div>

      {mode === 'register' && (
        <div className="field">
          <label htmlFor="auth-name">Име</label>
          <input
            id="auth-name"
            className="input"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="auth-email">Имейл</label>
        <input
          id="auth-email"
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="field">
        <label htmlFor="auth-password">Парола</label>
        <input
          id="auth-password"
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </div>

      {error && (
        <p className="error" style={{ marginBottom: 14 }}>
          {MESSAGES[error.code] ?? error.message}
        </p>
      )}

      <button className="btn btn-primary btn-block" type="submit" disabled={!valid || busy}>
        {busy ? 'Момент…' : mode === 'login' ? 'Влез' : 'Създай сметка'}
      </button>

      <p className="muted" style={{ marginTop: 12 }}>
        Демо сметка — данните са попълнени предварително. Паролата трябва да е
        поне 8 знака.
      </p>
    </form>
  );
}

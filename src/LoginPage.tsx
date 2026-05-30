import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setToken } from './auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = email.trim().length > 0 && password.trim().length > 0 && !isLoading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError('Correo o contraseña incorrectos');
        return;
      }
      const data = await res.json();
      setToken(data.accessToken);
      navigate('/');
    } catch {
      setError('Correo o contraseña incorrectos');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #141830 0%, #09090C 60%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        padding: '2.5rem',
        background: '#0F1117',
        borderRadius: '16px',
        border: '1px solid #1E2233',
        boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #C9A84C, #8A6E2F)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>⚙️</div>
          <div>
            <div style={{ color: '#E8E3D8', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1 }}>SIGOB</div>
            <div style={{ color: '#3E4260', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Plan Semanal PMO</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Label htmlFor="email" style={{ color: '#7A7F9A', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Correo electrónico
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="correo@sigob.com.mx"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              style={{ background: '#14161E', borderColor: '#1E2233', color: '#E8E3D8', height: '2.5rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Label htmlFor="password" style={{ color: '#7A7F9A', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Contraseña
            </Label>
            <div style={{ position: 'relative' }}>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                style={{ background: '#14161E', borderColor: '#1E2233', color: '#E8E3D8', height: '2.5rem', paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  position: 'absolute', right: '0.625rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '0.25rem',
                  color: '#3E4260', display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, padding: '8px 12px',
            }}>
              <p style={{ color: '#f87171', fontSize: '0.8rem', margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%', height: '2.5rem', marginTop: '0.5rem',
              background: canSubmit ? 'linear-gradient(135deg, #C9A84C, #A07840)' : '#1A1D28',
              border: 'none', borderRadius: 10, cursor: canSubmit ? 'pointer' : 'not-allowed',
              color: canSubmit ? '#09090C' : '#3E4260',
              fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.02em',
              transition: 'all 0.15s', fontFamily: 'system-ui, sans-serif',
            }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <svg style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }}
                  viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
                Iniciando sesión...
              </span>
            ) : 'Iniciar sesión'}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

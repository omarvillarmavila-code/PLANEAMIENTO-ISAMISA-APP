import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (!signIn) {
      setError("Configura Supabase en el archivo .env.local.");
      setBusy(false);
      return;
    }
    const { error: authError } = await signIn(email, password);
    if (authError) setError("Correo o contraseña incorrectos.");
    else navigate("/");
    setBusy(false);
  }
  return (
    <div className="login-page">
      <div className="login-art">
        <div className="login-brand">
          <div className="brand-mark">P</div>
          <strong>Planeamiento</strong>
        </div>
        <div className="art-copy">
          <span className="eyebrow light">Gestión inteligente</span>
          <h1>PRoducción Pecuaria e Industrial</h1>
          <p>
            Una vista integrada de granjas, incubadoras y planes operativos.
          </p>
        </div>
        <div className="art-footer">© 2026 · Plataforma de operaciones</div>
      </div>
      <div className="login-panel">
        <div className="login-box">
          <span className="eyebrow">Bienvenido de nuevo</span>
          <h2>Ingresa a tu cuenta</h2>
          <p className="muted">Accede al centro de planeamiento.</p>
          <form onSubmit={handleSubmit}>
            <label>
              Correo electrónico
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" disabled={busy}>
              {busy ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
          <p className="login-note">
            El acceso y los permisos se gestionan desde Supabase Auth.
          </p>
        </div>
      </div>
    </div>
  );
}

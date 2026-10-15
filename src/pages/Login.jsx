import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./login.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="login-page login-simple">
      <section className="login-box" aria-labelledby="login-title">
        <div className="login-logo" aria-label="ISAMISA">ISAMISA</div>
        <h2 id="login-title">Iniciar sesión</h2>
        <p className="login-subtitle">Planeamiento y producción</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="login-email">Correo electrónico</label>
          <input id="login-email" name="email" type="email" autoComplete="username"
            required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.com" />
          <label htmlFor="login-password">Contraseña</label>
          <div className="login-password">
            <input id="login-password" name="password" type={showPassword ? "text" : "password"}
              autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" />
            <button type="button" className="login-password-toggle"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword} aria-controls="login-password"
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}

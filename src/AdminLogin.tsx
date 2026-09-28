import { useEffect, useState, type FormEvent } from "react";
import { AdminColumn, Wordmark } from "@/App";
import { useI18n } from "@/i18n";
import {
  checkAdminPassword,
  markPasswordSetup,
  passwordIsCustom,
  setAdminPassword,
  startAdminSession,
} from "@/storage";

export function AdminLogin({ onReady, onSetup }: { onReady: () => void; onSetup: () => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    setShowHint(!passwordIsCustom());
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const ok = await checkAdminPassword(username, password);
    setBusy(false);
    if (!ok) {
      setError("login.failed");
      return;
    }
    if (!passwordIsCustom()) {
      markPasswordSetup();
      onSetup();
      return;
    }
    startAdminSession();
    onReady();
  }

  return (
    <AdminColumn>
      <div className="mx-auto w-full max-w-md pt-10">
        <Wordmark />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
        <form className="card mt-6 grid gap-3" onSubmit={(event) => void submit(event)}>
          <label className="grid gap-1 text-sm font-medium" htmlFor="admin-user">
            {t("login.username")}
            <input
              id="admin-user"
              className="field-input"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium" htmlFor="admin-pass">
            {t("login.password")}
            <input
              id="admin-pass"
              className="field-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-primary">{t(error)}</p> : null}
          <button type="submit" className="tap tap-primary" disabled={busy}>
            {t("login.signIn")}
          </button>
          {showHint ? (
            <div className="banner text-sm">
              <p className="font-semibold">{t("login.firstRun")}</p>
              <p className="mt-1">admin</p>
              <p>SafetyBot2026</p>
            </div>
          ) : null}
        </form>
      </div>
    </AdminColumn>
  );
}

export function PasswordSetup({ onReady }: { onReady: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("login.short");
      return;
    }
    await setAdminPassword(password);
    startAdminSession();
    onReady();
  }

  return (
    <AdminColumn>
      <div className="mx-auto w-full max-w-md pt-10">
        <Wordmark />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("login.newPassword")}</h1>
        <p className="mt-2 text-muted">{t("login.newPasswordHelp")}</p>
        <form className="card mt-6 grid gap-3" onSubmit={(event) => void save(event)}>
          <label className="grid gap-1 text-sm font-medium" htmlFor="new-pass">
            {t("login.newPasswordLabel")}
            <input
              id="new-pass"
              className="field-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-primary">{t(error)}</p> : null}
          <button type="submit" className="tap tap-primary">
            {t("login.savePassword")}
          </button>
        </form>
      </div>
    </AdminColumn>
  );
}

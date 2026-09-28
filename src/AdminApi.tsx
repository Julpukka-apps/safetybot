import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { pushConfig } from "@/remote";
import { useI18n } from "@/i18n";
import { aiConfigured } from "@/xai";
import {
  checkAdminPassword,
  copyText,
  loadAi,
  loadApiKey,
  loadWebhook,
  saveAi,
  saveWebhook,
  setAdminPassword,
  type AiProvider,
  type AiSettings,
} from "@/storage";

export function AdminApi() {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [ai, setAi] = useState<AiSettings>({ provider: "xai", apiKey: "", model: "", baseUrl: "" });
  const [aiReady, setAiReady] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [notice, setNotice] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setApiKey(loadApiKey());
    setAi(loadAi());
    const webhook = loadWebhook();
    setWebhookUrl(webhook.url);
    setWebhookSecret(webhook.secret);
    void aiConfigured().then(setAiReady);
  }, []);

  const base = `${origin}/api/reports`;
  const listCurl = `curl -s -H "Authorization: Bearer ${apiKey}" "${base}"`;
  const schemaCurl = `curl -s -H "Authorization: Bearer ${apiKey}" "${origin}/api/schema"`;

  async function rotate() {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const next = `sb_live_${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    const result = await pushConfig({ rotateTo: next });
    if (!result) {
      setNotice("notice.rotateFail");
      return;
    }
    setApiKey(result.apiKey);
    setNotice("notice.newKey");
  }

  async function saveModel() {
    saveAi(ai);
    const ready = await aiConfigured();
    setAiReady(ready);
    setNotice(ai.apiKey.trim() || ready ? "notice.aiSaved" : "notice.aiCleared");
  }

  function saveHook() {
    saveWebhook({ url: webhookUrl.trim(), secret: webhookSecret });
    void pushConfig();
    setNotice("notice.webhook");
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    const ok = await checkAdminPassword("admin", currentPassword);
    if (!ok) {
      setNotice("notice.badPassword");
      return;
    }
    if (nextPassword.length < 8) {
      setNotice("notice.short");
      return;
    }
    await setAdminPassword(nextPassword);
    setCurrentPassword("");
    setNextPassword("");
    setNotice("notice.passwordUpdated");
  }

  const demo = !ai.apiKey.trim() && !aiReady;
  const needsAddress = ai.provider === "azure" || ai.provider === "compatible";

  return (
    <div className="grid gap-4">
      {demo ? (
        <div className="banner">
          {t("ai.demo")}
        </div>
      ) : null}
      {notice ? <p className="text-base text-primary">{t(notice)}</p> : null}
      <section className="card grid gap-3 p-3">
        <h2 className="text-base font-semibold">{t("ai.title")}</h2>
        <p className="text-base text-ink">{t("ai.help")}</p>
        <label className="grid gap-1 text-base font-medium">
          {t("ai.service")}
          <select
            className="select-input"
            aria-label={t("ai.service")}
            value={ai.provider}
            onChange={(event) => setAi({ ...ai, provider: event.target.value as AiProvider })}
          >
            <option value="xai">{t("ai.grok")}</option>
            <option value="openai">{t("ai.openai")}</option>
            <option value="azure">{t("ai.azure")}</option>
            <option value="compatible">{t("ai.other")}</option>
          </select>
        </label>
        {needsAddress ? (
          <label className="grid gap-1 text-base font-medium">
            {t("ai.address")}
            <input
              className="field-input"
              aria-label={t("ai.address")}
              placeholder={ai.provider === "azure" ? "https://your-resource.openai.azure.com" : "https://example.com/v1"}
              value={ai.baseUrl}
              onChange={(event) => setAi({ ...ai, baseUrl: event.target.value })}
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-base font-medium">
          {t("ai.model")}
          <input
            className="field-input"
            aria-label={t("ai.model")}
            placeholder={ai.provider === "xai" ? "grok-4.6" : ai.provider === "openai" ? "gpt-4.1-mini" : "deployment name"}
            value={ai.model}
            onChange={(event) => setAi({ ...ai, model: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-base font-medium">
          {t("ai.key")}
          <input
            className="field-input"
            type="password"
            autoComplete="off"
            aria-label={t("ai.key")}
            value={ai.apiKey}
            onChange={(event) => setAi({ ...ai, apiKey: event.target.value })}
            placeholder={t("ai.paste")}
          />
        </label>
        <p className="text-base text-muted">{t("ai.note")}</p>
        <button type="button" className="tap tap-primary" onClick={() => void saveModel()}>
          {t("ai.save")}
        </button>
      </section>
      <section className="card grid gap-3 p-3">
        <h2 className="text-base font-semibold">{t("hook.title")}</h2>
        <p className="text-base text-muted">{t("hook.help")}</p>
        <input
          className="field-input"
          aria-label={t("hook.title")}
          placeholder="https://example.com/safety"
          value={webhookUrl}
          onChange={(event) => setWebhookUrl(event.target.value)}
        />
        <input
          className="field-input"
          aria-label={t("hook.secret")}
          placeholder={t("hook.secret")}
          value={webhookSecret}
          onChange={(event) => setWebhookSecret(event.target.value)}
        />
        <button type="button" className="tap tap-quiet" onClick={saveHook}>
          {t("hook.save")}
        </button>
      </section>
      <details className="card grid gap-3 p-3">
        <summary className="cursor-pointer text-base font-semibold">{t("connect.title")}</summary>
        <p className="mt-3 text-base text-muted">{t("connect.help")}</p>
        <p className="text-sm font-medium">Base {base || "/api/reports"}</p>
        <ul className="grid gap-1 text-sm text-muted">
          <li>GET /api/reports?since=ISO&case_type=&org_id= — one flat row per report</li>
          <li>GET /api/organization</li>
          <li>PUT /api/organization</li>
          <li>GET /api/reports/:id</li>
          <li>GET /api/schema</li>
          <li>POST /api/reports</li>
        </ul>
        <label className="grid gap-1 text-sm font-medium">
          {t("connect.key")}
          <input className="field-input" readOnly value={apiKey} aria-label={t("connect.key")} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="tap tap-quiet" onClick={() => void copyText(apiKey).then(() => setNotice("notice.keyCopied"))}>
            {t("connect.copyKey")}
          </button>
          <button type="button" className="tap tap-quiet" onClick={() => void copyText(base).then(() => setNotice("notice.baseCopied"))}>
            {t("connect.copyBase")}
          </button>
          <button type="button" className="tap tap-primary" onClick={() => void rotate()}>
            {t("connect.rotate")}
          </button>
        </div>
        <label className="grid gap-1 text-sm font-medium">
          {t("connect.list")}
          <textarea className="field-input font-mono text-sm" readOnly value={listCurl} />
        </label>
        <button type="button" className="tap tap-quiet" onClick={() => void copyText(listCurl).then(() => setNotice("notice.curlCopied"))}>
          {t("connect.copyCurl")}
        </button>
        <label className="grid gap-1 text-sm font-medium">
          {t("connect.schema")}
          <textarea className="field-input font-mono text-sm" readOnly value={schemaCurl} />
        </label>
      </details>
      <form className="card grid gap-3 p-3" onSubmit={(event) => void changePassword(event)}>
        <h2 className="text-sm font-semibold">{t("password.title")}</h2>
        <input
          className="field-input"
          type="password"
          autoComplete="current-password"
          aria-label={t("password.current")}
          placeholder={t("password.current")}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <input
          className="field-input"
          type="password"
          autoComplete="new-password"
          aria-label={t("password.next")}
          placeholder={t("password.next")}
          value={nextPassword}
          onChange={(event) => setNextPassword(event.target.value)}
        />
        <button type="submit" className="tap tap-quiet">
          {t("password.save")}
        </button>
      </form>
    </div>
  );
}

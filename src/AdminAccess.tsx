import { useEffect, useState } from "react";
import { parseOrgText, orgPath, type OrgNode, type SsoConfig } from "@/org";
import { pushConfig } from "@/remote";
import { useI18n } from "@/i18n";
import { loadOrg, loadSso, saveOrg, saveSso } from "@/storage";

const SAMPLE = `id,name,parent_id,type
company,Company,,company
operations,Operations,company,business_unit
north-yard,North yard,operations,site`;

export function AdminAccess() {
  const { t } = useI18n();
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [paste, setPaste] = useState("");
  const [sso, setSso] = useState<SsoConfig | null>(null);
  const [notice, setNotice] = useState("");
  const [count, setCount] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    void (async () => {
      await pushConfig();
      setNodes(loadOrg().nodes);
      setSso(loadSso());
    })();
  }, []);

  function readText(text: string) {
    try {
      const next = parseOrgText(text);
      if (!next.length) {
        setNotice("access.noneFound");
        return;
      }
      setNodes(next);
      setNotice("access.ready");
      setCount(String(next.length));
    } catch {
      setNotice("access.badFile");
    }
  }

  async function saveStructure() {
    const organization = { nodes, updated_at: new Date().toISOString() };
    saveOrg(organization);
    const result = await pushConfig({ organization });
    setNotice(result ? "access.saved" : "access.savedLocal");
  }

  async function clearStructure() {
    setNodes([]);
    const organization = { nodes: [], updated_at: new Date().toISOString() };
    saveOrg(organization);
    await pushConfig({ organization });
    setNotice("access.cleared");
  }

  async function saveSignIn() {
    if (!sso) return;
    saveSso(sso);
    const result = await pushConfig({ sso });
    const stored = loadSso();
    setSso(stored);
    if (sso.microsoft.enabled && !stored.microsoft.enabled) {
      setNotice("access.msNeeds");
      return;
    }
    if (sso.google.enabled && !stored.google.enabled) {
      setNotice("access.googleNeeds");
      return;
    }
    setNotice(result ? "access.signSaved" : "access.savedLocal");
  }

  return (
    <div className="grid gap-4">
      <section className="card grid gap-3 p-3">
        <h2 className="text-base font-semibold">{t("access.title")}</h2>
        <p className="text-base text-ink">{t("access.help")}</p>
        <label className="tap tap-quiet w-full">
          {t("access.upload")}
          <input
            className="sr-only"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then(readText);
              event.target.value = "";
            }}
          />
        </label>
        <label className="grid gap-1 text-base font-medium">
          {t("access.paste")}
          <textarea
            className="field-input font-mono text-base"
            placeholder={SAMPLE}
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
          />
        </label>
        <button type="button" className="tap tap-quiet" onClick={() => readText(paste)}>
          {t("access.useList")}
        </button>
        <p className="text-base">{nodes.length ? `${nodes.length} ${t("access.places")}` : t("access.none")}</p>
        {nodes.length > 0 ? (
          <ul className="grid max-h-48 gap-1 overflow-auto text-base">
            {nodes.slice(0, 12).map((node) => (
              <li key={node.id}>{orgPath(nodes, node.id)}</li>
            ))}
            {nodes.length > 12 ? <li>…</li> : null}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="tap tap-primary" onClick={() => void saveStructure()}>
            {t("access.save")}
          </button>
          <button type="button" className="tap tap-quiet" onClick={() => void clearStructure()}>
            {t("access.clear")}
          </button>
        </div>
        <p className="text-base text-muted">{t("access.apiHint")}</p>
      </section>
      {sso ? (
        <section className="card grid gap-3 p-3">
          <h2 className="text-base font-semibold">{t("access.signIn")}</h2>
          <p className="text-base text-ink">{t("access.signInHelp")}</p>
          <label className="flex min-h-14 items-center gap-3 text-base font-medium">
            <input
              type="checkbox"
              checked={sso.requireSignIn}
              onChange={(event) => setSso({ ...sso, requireSignIn: event.target.checked })}
            />
            {t("access.require")}
          </label>
          <label className="flex min-h-14 items-center gap-3 text-base font-medium">
            <input
              type="checkbox"
              checked={sso.microsoft.enabled}
              onChange={(event) => setSso({ ...sso, microsoft: { ...sso.microsoft, enabled: event.target.checked } })}
            />
            {t("access.microsoft")}
          </label>
          <input
            className="field-input"
            placeholder={t("access.tenant")}
            aria-label={t("access.tenant")}
            value={sso.microsoft.tenantId}
            onChange={(event) => setSso({ ...sso, microsoft: { ...sso.microsoft, tenantId: event.target.value } })}
          />
          <input
            className="field-input"
            placeholder={t("access.client")}
            aria-label={t("access.client")}
            value={sso.microsoft.clientId}
            onChange={(event) => setSso({ ...sso, microsoft: { ...sso.microsoft, clientId: event.target.value } })}
          />
          <p className="break-all text-base text-muted">{t("access.redirect")} {origin}/api/auth/microsoft/callback</p>
          <label className="flex min-h-14 items-center gap-3 text-base font-medium">
            <input
              type="checkbox"
              checked={sso.google.enabled}
              onChange={(event) => setSso({ ...sso, google: { ...sso.google, enabled: event.target.checked } })}
            />
            {t("access.google")}
          </label>
          <input
            className="field-input"
            placeholder={t("access.googleClient")}
            aria-label={t("access.googleClient")}
            value={sso.google.clientId}
            onChange={(event) => setSso({ ...sso, google: { ...sso.google, clientId: event.target.value } })}
          />
          <p className="break-all text-base text-muted">{t("access.redirect")} {origin}/api/auth/google/callback</p>
          <button type="button" className="tap tap-primary" onClick={() => void saveSignIn()}>
            {t("access.saveSignIn")}
          </button>
        </section>
      ) : null}
      {notice ? <p className="text-base text-primary">{t(notice).replace("{n}", count)}</p> : null}
    </div>
  );
}

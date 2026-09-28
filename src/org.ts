export type OrgNode = {
  id: string;
  name: string;
  parent_id: string | null;
  type: string;
};

export type OrgStructure = {
  nodes: OrgNode[];
  updated_at: string;
};

export type SsoProvider = "microsoft" | "google";

export type SsoConfig = {
  microsoft: { enabled: boolean; tenantId: string; clientId: string };
  google: { enabled: boolean; clientId: string };
  requireSignIn: boolean;
};

export type SessionUser = {
  id: string;
  provider: SsoProvider;
  email: string;
  name: string;
  org_id: string | null;
  org_path: string | null;
  expires: string;
};

export function emptyOrg(): OrgStructure {
  return { nodes: [], updated_at: "" };
}

export function emptySso(): SsoConfig {
  return {
    microsoft: { enabled: false, tenantId: "", clientId: "" },
    google: { enabled: false, clientId: "" },
    requireSignIn: false,
  };
}

export function normalizeOrg(value: unknown): OrgStructure {
  const base = emptyOrg();
  if (!value || typeof value !== "object") return base;
  const raw = value as { nodes?: unknown; updated_at?: unknown };
  const nodes = Array.isArray(raw.nodes) ? raw.nodes.map(asNode).filter((item): item is OrgNode => Boolean(item)) : [];
  return {
    nodes: uniqueNodes(nodes).slice(0, 2000),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
  };
}

export function normalizeSso(value: unknown): SsoConfig {
  const base = emptySso();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<SsoConfig>;
  const microsoft = raw.microsoft ?? base.microsoft;
  const google = raw.google ?? base.google;
  const tenantId = text(microsoft.tenantId).slice(0, 80);
  const msClient = text(microsoft.clientId).slice(0, 120);
  const googleClient = text(google.clientId).slice(0, 120);
  return {
    microsoft: { enabled: Boolean(microsoft.enabled) && Boolean(tenantId) && Boolean(msClient), tenantId, clientId: msClient },
    google: { enabled: Boolean(google.enabled) && Boolean(googleClient), clientId: googleClient },
    requireSignIn: Boolean(raw.requireSignIn),
  };
}

export function parseOrgText(text: string): OrgNode[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return uniqueNodes(parseOrgJson(JSON.parse(trimmed)));
  return uniqueNodes(parseOrgCsv(trimmed));
}

export function orgPath(nodes: OrgNode[], id: string | null | undefined): string {
  if (!id) return "";
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const names: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return names.join(" / ");
}

export function orgName(nodes: OrgNode[], id: string | null | undefined): string {
  if (!id) return "";
  return nodes.find((node) => node.id === id)?.name ?? "";
}

export function matchOrgNode(nodes: OrgNode[], hints: string[]): OrgNode | null {
  const wanted = hints.map((hint) => hint.trim().toLowerCase()).filter((hint) => hint.length > 1);
  for (const hint of wanted) {
    const exact = nodes.find((node) => node.name.toLowerCase() === hint || node.id.toLowerCase() === hint);
    if (exact) return exact;
  }
  for (const hint of wanted) {
    if (hint.length < 3) continue;
    const partial = nodes.find((node) => node.name.toLowerCase().includes(hint) || hint.includes(node.name.toLowerCase()));
    if (partial) return partial;
  }
  return null;
}

function parseOrgJson(value: unknown): OrgNode[] {
  if (Array.isArray(value)) {
    if (value.some((item) => item && typeof item === "object" && ("children" in (item as object) || "nodes" in (item as object)))) {
      const out: OrgNode[] = [];
      for (const item of value) walkTree(item, null, out);
      return out;
    }
    return value.map(asNode).filter((item): item is OrgNode => Boolean(item));
  }
  if (value && typeof value === "object") {
    const raw = value as { nodes?: unknown; children?: unknown; name?: unknown };
    if (Array.isArray(raw.nodes) && !raw.name) return parseOrgJson(raw.nodes);
    const out: OrgNode[] = [];
    walkTree(value, null, out);
    return out;
  }
  return [];
}

function walkTree(value: unknown, parent: string | null, out: OrgNode[]): void {
  if (!value || typeof value !== "object") return;
  const raw = value as { id?: unknown; name?: unknown; type?: unknown; children?: unknown; nodes?: unknown };
  const name = text(raw.name);
  if (!name) return;
  const id = text(raw.id) || slug(name);
  out.push({ id, name, parent_id: parent, type: text(raw.type) || "unit" });
  const children = Array.isArray(raw.children) ? raw.children : Array.isArray(raw.nodes) ? raw.nodes : [];
  for (const child of children) walkTree(child, id, out);
}

function parseOrgCsv(text: string): OrgNode[] {
  const rows = csvRows(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((cell) => cell.trim().toLowerCase().replace(/\s+/g, "_"));
  const index = (names: string[]) => header.findIndex((cell) => names.includes(cell));
  const idCol = index(["id", "code", "key"]);
  const nameCol = index(["name", "title", "unit", "organization"]);
  const parentCol = index(["parent_id", "parent", "parent_code", "reports_to"]);
  const typeCol = index(["type", "kind", "level"]);
  if (nameCol < 0) return [];
  const draft: OrgNode[] = [];
  for (const row of rows.slice(1)) {
    const name = (row[nameCol] || "").trim();
    if (!name) continue;
    const id = (idCol >= 0 ? row[idCol] : "").trim() || slug(name);
    const parent = (parentCol >= 0 ? row[parentCol] : "").trim();
    draft.push({
      id,
      name,
      parent_id: parent || null,
      type: (typeCol >= 0 ? row[typeCol] : "").trim() || "unit",
    });
  }
  const ids = new Set(draft.map((node) => node.id));
  return draft.map((node) => {
    if (!node.parent_id || ids.has(node.parent_id)) return node;
    const byName = draft.find((item) => item.name.toLowerCase() === node.parent_id?.toLowerCase());
    return { ...node, parent_id: byName ? byName.id : null };
  });
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "," || char === "\t" || char === ";") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

function asNode(value: unknown): OrgNode | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { id?: unknown; name?: unknown; parent_id?: unknown; parent?: unknown; type?: unknown };
  const name = text(raw.name);
  if (!name) return null;
  const parent = text(raw.parent_id || raw.parent);
  return {
    id: text(raw.id) || slug(name),
    name,
    parent_id: parent || null,
    type: text(raw.type) || "unit",
  };
}

function uniqueNodes(nodes: OrgNode[]): OrgNode[] {
  const seen = new Set<string>();
  const out: OrgNode[] = [];
  for (const node of nodes) {
    let id = node.id || slug(node.name);
    while (seen.has(id)) id = `${id}-2`;
    seen.add(id);
    out.push({ ...node, id });
  }
  return out;
}

function slug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "unit";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

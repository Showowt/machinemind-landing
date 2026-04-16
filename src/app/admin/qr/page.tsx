"use client";

import { useCallback, useEffect, useState } from "react";

interface QRCodeRow {
  id: string;
  slug: string;
  name: string;
  destination: string;
  active: boolean;
  campaign: string | null;
  style: string;
  colors: { dark: string; light: string; accent: string };
  gift_config: Record<string, unknown> | null;
  discount_config: Record<string, unknown> | null;
  max_redemptions: number | null;
  redemption_count: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  slug: "",
  name: "",
  destination: "https://machinemindconsulting.com",
  campaign: "",
  style: "luxury",
  active: true,
  giftType: "none" as "none" | "gift" | "discount",
  giftLabel: "",
  giftValue: "",
  giftPrefix: "MM",
  giftExpiresDays: 30,
  maxRedemptions: "",
  expiresAt: "",
};

export default function QRAdminPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<QRCodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<QRCodeRow | null>(null);
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("mm_admin_token");
    if (saved) setToken(saved);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch("/api/admin/qr", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setRows(json.data || []);
      setAuthed(true);
      localStorage.setItem("mm_admin_token", token);
    } catch (e) {
      setStatus(`auth failed: ${(e as Error).message}`);
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && !authed) load();
  }, [token, authed, load]);

  const loadPreview = useCallback(
    async (slug: string, style: string) => {
      if (!token) return;
      const res = await fetch(
        `/api/admin/qr/render?slug=${slug}&style=${style}&format=svg&size=600`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const svg = await res.text();
      setPreview(svg);
    },
    [token],
  );

  function buildPayload(f: typeof EMPTY_FORM) {
    const gift = f.giftType === "gift"
      ? {
          label: f.giftLabel,
          value: f.giftValue,
          prefix: f.giftPrefix,
          expires_in_days: Number(f.giftExpiresDays) || 30,
        }
      : null;
    const discount = f.giftType === "discount"
      ? {
          label: f.giftLabel,
          value: f.giftValue,
          prefix: f.giftPrefix,
          expires_in_days: Number(f.giftExpiresDays) || 30,
        }
      : null;
    return {
      slug: f.slug || undefined,
      name: f.name || f.slug,
      destination: f.destination,
      campaign: f.campaign || null,
      style: f.style,
      active: f.active,
      gift_config: gift,
      discount_config: discount,
      max_redemptions: f.maxRedemptions ? Number(f.maxRedemptions) : null,
      expires_at: f.expiresAt || null,
    };
  }

  async function submit() {
    setStatus("");
    const payload = buildPayload(form);
    const method = editing ? "PATCH" : "POST";
    const body = editing ? { ...payload, slug: editing } : payload;
    const res = await fetch("/api/admin/qr", {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error}`);
      return;
    }
    setStatus(editing ? "updated" : "created");
    setForm(EMPTY_FORM);
    setEditing(null);
    load();
  }

  async function remove(slug: string) {
    if (!confirm(`delete ${slug}?`)) return;
    await fetch(`/api/admin/qr?slug=${slug}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    load();
  }

  function edit(r: QRCodeRow) {
    setEditing(r.slug);
    const cfg = (r.gift_config || r.discount_config) as
      | Record<string, unknown>
      | null;
    setForm({
      slug: r.slug,
      name: r.name,
      destination: r.destination,
      campaign: r.campaign || "",
      style: r.style,
      active: r.active,
      giftType: r.gift_config ? "gift" : r.discount_config ? "discount" : "none",
      giftLabel: String(cfg?.label ?? ""),
      giftValue: String(cfg?.value ?? ""),
      giftPrefix: String(cfg?.prefix ?? "MM"),
      giftExpiresDays: Number(cfg?.expires_in_days ?? 30),
      maxRedemptions: r.max_redemptions ? String(r.max_redemptions) : "",
      expiresAt: r.expires_at ? r.expires_at.slice(0, 16) : "",
    });
    setSelected(r);
    loadPreview(r.slug, r.style);
  }

  function download(slug: string, style: string, format: string) {
    const url = `/api/admin/qr/render?slug=${slug}&style=${style}&format=${format}&size=1200`;
    fetch(url, { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `MM_QR_${slug}_${style}.${format}`;
        a.click();
      });
  }

  if (!authed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#06060a",
          color: "#f0f0f3",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, width: "100%" }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 300,
              letterSpacing: 1,
              marginBottom: 24,
            }}
          >
            MACHINEMIND QR · ADMIN
          </h1>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="admin token"
            style={{
              width: "100%",
              padding: 14,
              background: "transparent",
              border: "1px solid rgba(201,169,110,0.4)",
              color: "#f0f0f3",
              fontSize: 14,
              fontFamily: "monospace",
            }}
          />
          <button
            onClick={load}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 12,
              padding: 14,
              background: "#c9a96e",
              color: "#06060a",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2,
              cursor: "pointer",
            }}
          >
            {loading ? "…" : "AUTHENTICATE"}
          </button>
          {status && (
            <p style={{ marginTop: 12, color: "#ff6b6b", fontSize: 13 }}>
              {status}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#06060a",
        color: "#f0f0f3",
        fontFamily: "system-ui",
        padding: 32,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 32,
        }}
      >
        <h1 style={{ fontSize: 32, fontWeight: 300, letterSpacing: 1 }}>
          QR · ADMIN
        </h1>
        <div style={{ fontSize: 12, color: "rgba(240,240,243,0.5)" }}>
          {rows.length} codes ·{" "}
          {rows.reduce((s, r) => s + r.redemption_count, 0)} scans
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 400px",
          gap: 32,
          alignItems: "start",
        }}
      >
        <div>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 14, letterSpacing: 2, marginBottom: 16 }}>
              {editing ? `EDIT · ${editing}` : "NEW QR CODE"}
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              <Row>
                <Input
                  label="slug (url path)"
                  value={form.slug}
                  onChange={(v) => setForm({ ...form, slug: v })}
                  placeholder="leave blank to auto-generate"
                  disabled={!!editing}
                />
                <Input
                  label="name"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  placeholder="Cartagena Summit 2026"
                />
              </Row>
              <Input
                label="destination URL"
                value={form.destination}
                onChange={(v) => setForm({ ...form, destination: v })}
              />
              <Row>
                <Input
                  label="campaign"
                  value={form.campaign}
                  onChange={(v) => setForm({ ...form, campaign: v })}
                />
                <Select
                  label="style"
                  value={form.style}
                  onChange={(v) => setForm({ ...form, style: v })}
                  options={["luxury", "classic", "framed", "minimal"]}
                />
              </Row>
              <Row>
                <Select
                  label="attach"
                  value={form.giftType}
                  onChange={(v) =>
                    setForm({ ...form, giftType: v as "none" | "gift" | "discount" })
                  }
                  options={["none", "gift", "discount"]}
                />
                {form.giftType !== "none" && (
                  <Input
                    label="code prefix"
                    value={form.giftPrefix}
                    onChange={(v) => setForm({ ...form, giftPrefix: v })}
                  />
                )}
              </Row>
              {form.giftType !== "none" && (
                <Row>
                  <Input
                    label={`${form.giftType} label`}
                    value={form.giftLabel}
                    onChange={(v) => setForm({ ...form, giftLabel: v })}
                    placeholder={
                      form.giftType === "gift"
                        ? "Free Cinema Audit"
                        : "20% off"
                    }
                  />
                  <Input
                    label="value"
                    value={form.giftValue}
                    onChange={(v) => setForm({ ...form, giftValue: v })}
                    placeholder={
                      form.giftType === "gift" ? "audit" : "20"
                    }
                  />
                </Row>
              )}
              {form.giftType !== "none" && (
                <Row>
                  <Input
                    label="expires (days)"
                    value={String(form.giftExpiresDays)}
                    onChange={(v) =>
                      setForm({ ...form, giftExpiresDays: Number(v) || 30 })
                    }
                  />
                  <Input
                    label="max redemptions"
                    value={form.maxRedemptions}
                    onChange={(v) => setForm({ ...form, maxRedemptions: v })}
                    placeholder="unlimited"
                  />
                </Row>
              )}
              <Row>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                  active
                </label>
                <Input
                  label="expires at (QR itself)"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(v) => setForm({ ...form, expiresAt: v })}
                />
              </Row>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={submit}
                  style={{
                    padding: "12px 24px",
                    background: "#c9a96e",
                    color: "#06060a",
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 2,
                    cursor: "pointer",
                  }}
                >
                  {editing ? "UPDATE" : "CREATE"}
                </button>
                {editing && (
                  <button
                    onClick={() => {
                      setEditing(null);
                      setForm(EMPTY_FORM);
                      setSelected(null);
                      setPreview("");
                    }}
                    style={{
                      padding: "12px 24px",
                      background: "transparent",
                      color: "#f0f0f3",
                      border: "1px solid rgba(240,240,243,0.2)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    CANCEL
                  </button>
                )}
                {status && (
                  <span
                    style={{
                      fontSize: 12,
                      color: status.startsWith("error") ? "#ff6b6b" : "#c9a96e",
                      alignSelf: "center",
                    }}
                  >
                    {status}
                  </span>
                )}
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 14, letterSpacing: 2, marginBottom: 16 }}>
            ALL CODES
          </h2>
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: 16,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 14,
                      color: r.active ? "#c9a96e" : "rgba(240,240,243,0.4)",
                    }}
                  >
                    /q/{r.slug}{" "}
                    <span
                      style={{ color: "rgba(240,240,243,0.4)", fontSize: 11 }}
                    >
                      → {r.destination.replace(/^https?:\/\//, "")}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(240,240,243,0.5)",
                      marginTop: 4,
                    }}
                  >
                    {r.name} · {r.style} · {r.redemption_count} scans
                    {r.gift_config ? " · gift" : ""}
                    {r.discount_config ? " · discount" : ""}
                    {r.max_redemptions
                      ? ` · ${r.redemption_count}/${r.max_redemptions}`
                      : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <ActionBtn onClick={() => edit(r)}>EDIT</ActionBtn>
                  <ActionBtn onClick={() => download(r.slug, r.style, "svg")}>
                    SVG
                  </ActionBtn>
                  <ActionBtn onClick={() => download(r.slug, r.style, "png")}>
                    PNG
                  </ActionBtn>
                  <ActionBtn onClick={() => remove(r.slug)} danger>
                    DEL
                  </ActionBtn>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            position: "sticky",
            top: 32,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 14, letterSpacing: 2, marginBottom: 16 }}>
            PREVIEW
          </h2>
          {preview ? (
            <div
              style={{ background: "#fff", padding: 12 }}
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          ) : (
            <div
              style={{
                aspectRatio: "1",
                display: "grid",
                placeItems: "center",
                color: "rgba(240,240,243,0.3)",
                fontSize: 12,
                border: "1px dashed rgba(240,240,243,0.1)",
              }}
            >
              select a code to preview
            </div>
          )}
          {selected && (
            <div
              style={{
                marginTop: 16,
                fontSize: 11,
                color: "rgba(240,240,243,0.5)",
                fontFamily: "monospace",
              }}
            >
              <div>slug: {selected.slug}</div>
              <div>scans: {selected.redemption_count}</div>
              <div>
                encoded URL:
                <br />
                /q/{selected.slug}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, letterSpacing: 1.5, color: "rgba(240,240,243,0.5)" }}>
        {label.toUpperCase()}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          padding: 10,
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#f0f0f3",
          fontSize: 13,
          fontFamily: "monospace",
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, letterSpacing: 1.5, color: "rgba(240,240,243,0.5)" }}>
        {label.toUpperCase()}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: 10,
          background: "#06060a",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#f0f0f3",
          fontSize: 13,
          fontFamily: "monospace",
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        background: "transparent",
        color: danger ? "#ff6b6b" : "#c9a96e",
        border: `1px solid ${danger ? "rgba(255,107,107,0.3)" : "rgba(201,169,110,0.3)"}`,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.5,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

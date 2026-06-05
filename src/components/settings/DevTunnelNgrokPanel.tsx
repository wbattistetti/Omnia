/**
 * Gestione compatta tunnel ngrok multi-porta; mappa porta→URL in localStorage per la compilazione.
 * Con progetto aperto, le porte usate in task (es. Backend Call) e in config IA vengono aggiunte automaticamente.
 */

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  fetchNgrokTunnelStatus,
  startNgrokTunnels,
  stopNgrokTunnels,
} from '@services/devTunnelNgrokApi';
import { collectProjectLocalhostPortsForTunnel } from '@domain/devTunnel/devTunnelLocalhostPortCollector';
import {
  DEV_TUNNEL_COMPILE_FLAG_KEY,
  DEV_TUNNEL_PRESET_PORTS,
  getCompileUseDevTunnel,
  saveDevTunnelPortMapToStorage,
  setCompileUseDevTunnel,
} from '@domain/devTunnel/devTunnelCompileBridge';
import { mergeNgrokStatusIntoPortMap } from '@domain/devTunnel/ngrokTunnelMapSync';

const LS_TOKEN = 'omnia.devTunnel.ngrokAuthtoken';
const LS_ROWS = 'omnia.devTunnel.rows.v2';

type TunnelRow = { id: string; port: number };

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function loadToken(): string {
  try {
    return localStorage.getItem(LS_TOKEN) ?? '';
  } catch {
    return '';
  }
}

function loadRows(): TunnelRow[] {
  try {
    const raw = localStorage.getItem(LS_ROWS);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p) && p.length) {
        return p
          .map((x) => {
            const o = x as { id?: string; port?: unknown };
            const n = Number(o.port);
            const port = Number.isFinite(n) && n >= 1 && n <= 65535 ? Math.floor(n) : 3100;
            return { id: typeof o.id === 'string' ? o.id : newId(), port };
          })
          .filter((r) => r.port >= 1 && r.port <= 65535);
      }
    }
  } catch {
    /* ignore */
  }
  return [
    { id: newId(), port: 3100 },
    { id: newId(), port: 3110 },
  ];
}

function saveRows(rows: TunnelRow[]): void {
  try {
    localStorage.setItem(LS_ROWS, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export type DevTunnelNgrokPanelProps = {
  /** Progetto corrente: GET `/tasks` per cercare URL localhost nel grafo (Backend Call, ecc.). */
  projectId?: string;
  /** Default IA globali (es. `elevenLabsBackendBaseUrl`) — stesso modello usato in compilazione. */
  iaAgentConfig?: unknown;
};

function mergeRowsWithDiscoveredPorts(prev: TunnelRow[], discoveredPorts: number[]): TunnelRow[] {
  const have = new Set(prev.map((r) => r.port));
  const toAdd: TunnelRow[] = [];
  for (const p of discoveredPorts) {
    if (!have.has(p)) {
      have.add(p);
      toAdd.push({ id: newId(), port: p });
    }
  }
  if (!toAdd.length) return prev;
  return [...prev, ...toAdd];
}

function mergeStatusIntoMap(
  tunnels: Record<string, { running?: boolean; publicUrl?: string | null }> | undefined
): Record<number, string> {
  return mergeNgrokStatusIntoPortMap(tunnels);
}

export function DevTunnelNgrokPanel(props: DevTunnelNgrokPanelProps = {}) {
  const { projectId, iaAgentConfig } = props;
  const [rows, setRows] = React.useState<TunnelRow[]>(() => loadRows());
  const [authtoken, setAuthtoken] = React.useState<string>(() => loadToken());
  const [showAuthtoken, setShowAuthtoken] = React.useState(false);
  const [compileTunnel, setCompileTunnel] = React.useState<boolean>(() => getCompileUseDevTunnel());
  const [discoveredPorts, setDiscoveredPorts] = React.useState<number[]>([]);
  const [taskFetchWarning, setTaskFetchWarning] = React.useState<string | null>(null);
  const [tunnelMap, setTunnelMap] = React.useState<Record<number, string>>(() => ({}));
  const [sdkOk, setSdkOk] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(DEV_TUNNEL_COMPILE_FLAG_KEY) === null && import.meta.env.DEV) {
        localStorage.setItem(DEV_TUNNEL_COMPILE_FLAG_KEY, '1');
        setCompileTunnel(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      const pid = projectId?.trim();
      let tasks: unknown[] = [];
      let fetchErr: string | null = null;
      if (pid) {
        try {
          const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/tasks`);
          if (res.ok) {
            const data = (await res.json()) as { items?: unknown[] };
            if (Array.isArray(data.items)) tasks = data.items;
          } else {
            fetchErr = `HTTP ${res.status}`;
          }
        } catch (e) {
          fetchErr = e instanceof Error ? e.message : String(e);
        }
      }
      if (cancelled) return;

      setTaskFetchWarning(
        pid && fetchErr
          ? `Task non caricati (${fetchErr}). Rilevazione porte solo da config IA e righe già presenti.`
          : null
      );

      const found = collectProjectLocalhostPortsForTunnel({ tasks, iaConfig: iaAgentConfig });
      setDiscoveredPorts(found);
      if (found.length) {
        setRows((prev) => mergeRowsWithDiscoveredPorts(prev, found));
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [projectId, iaAgentConfig]);

  const persistToken = React.useCallback(() => {
    try {
      if (authtoken.trim()) localStorage.setItem(LS_TOKEN, authtoken);
      else localStorage.removeItem(LS_TOKEN);
    } catch {
      /* ignore */
    }
  }, [authtoken]);

  React.useEffect(() => {
    saveRows(rows);
  }, [rows]);

  const refresh = React.useCallback(async () => {
    const s = await fetchNgrokTunnelStatus();
    if (!s.ok) {
      setBanner(s.error ?? 'Stato non disponibile');
      return;
    }
    setBanner(null);
    setSdkOk(s.sdkAvailable ?? null);
    const m = mergeStatusIntoMap(s.tunnels);
    setTunnelMap(m);
    saveDevTunnelPortMapToStorage(m);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const portSelectOptions = React.useMemo(() => {
    const set = new Set<number>([...DEV_TUNNEL_PRESET_PORTS]);
    for (const r of rows) set.add(r.port);
    for (const p of discoveredPorts) set.add(p);
    return [...set].sort((a, b) => a - b);
  }, [rows, discoveredPorts]);

  const handleStartAll = async () => {
    persistToken();
    const ports = [
      ...new Set(
        rows
          .map((r) => Number(r.port))
          .filter((p) => Number.isFinite(p) && p >= 1 && p <= 65535)
      ),
    ];
    if (!ports.length) {
      setBanner('Aggiungi almeno una porta.');
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      const r = await startNgrokTunnels({
        ports,
        authtoken: authtoken.trim() || undefined,
      });
      if (!r.ok) {
        setBanner(r.error ?? 'Avvio fallito');
        return;
      }
      if (r.errors?.length) {
        setBanner(`Attenzione: ${r.errors.map((e) => `${e.port}: ${e.message}`).join('; ')}`);
      }
      await refresh();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleStopAll = async () => {
    setBusy(true);
    setBanner(null);
    try {
      await stopNgrokTunnels();
      setTunnelMap({});
      saveDevTunnelPortMapToStorage({});
      await refresh();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addRow = () => {
    const used = new Set(rows.map((r) => r.port));
    const next =
      DEV_TUNNEL_PRESET_PORTS.find((p) => !used.has(p)) ??
      (rows.length ? Math.min(65535, Math.max(...rows.map((r) => r.port)) + 1) : 3100);
    setRows((prev) => [...prev, { id: newId(), port: next }]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const copyUrl = (url: string) => {
    void navigator.clipboard.writeText(url);
  };

  const card: React.CSSProperties = {
    maxWidth: 640,
    padding: 12,
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#0f172a',
    fontSize: 12,
    color: '#e2e8f0',
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Tunnel di esposizione porte locali</h2>
      </div>

      <p style={{ margin: '0 0 10px', color: '#94a3b8', fontSize: 11, lineHeight: 1.5 }}>
        Con un progetto aperto, le porte usate negli URL localhost nei task (es. Backend Call) e nei default IA vengono
        aggiunte alla tabella automaticamente. Token e elenco porte restano nel browser; gli URL pubblici ngrok cambiano
        di sessione in sessione — dopo «Avvia tunnel» la mappa viene aggiornata per la compilazione.
      </p>

      {taskFetchWarning ? (
        <div style={{ marginBottom: 8, padding: 6, borderRadius: 4, background: '#422006', color: '#fde68a', fontSize: 11 }}>
          {taskFetchWarning}
        </div>
      ) : null}
      {discoveredPorts.length ? (
        <div style={{ marginBottom: 8, padding: 6, borderRadius: 4, background: '#0c4a6e', color: '#bae6fd', fontSize: 11 }}>
          Porte rilevate dal progetto / IA:{' '}
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{discoveredPorts.join(', ')}</span>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px' }}>
          <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>Authtoken</span>
          <div
            style={{
              display: 'flex',
              flex: 1,
              minWidth: 120,
              alignItems: 'center',
              gap: 4,
              borderRadius: 4,
              border: '1px solid #475569',
              background: '#020617',
              paddingRight: 2,
            }}
          >
            <input
              type={showAuthtoken ? 'text' : 'password'}
              autoComplete="off"
              value={authtoken}
              onChange={(e) => setAuthtoken(e.target.value)}
              onBlur={persistToken}
              placeholder="ngrok o .env NGROK_AUTHTOKEN"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '4px 8px',
                border: 'none',
                borderRadius: 4,
                background: 'transparent',
                color: '#f8fafc',
                fontSize: 11,
                outline: 'none',
              }}
            />
            <button
              type="button"
              tabIndex={0}
              aria-label={showAuthtoken ? 'Nascondi token ngrok' : 'Mostra token ngrok'}
              aria-pressed={showAuthtoken}
              onClick={() => setShowAuthtoken((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: 28,
                height: 28,
                padding: 0,
                border: 'none',
                borderRadius: 4,
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
              title={showAuthtoken ? 'Nascondi' : 'Mostra'}
            >
              {showAuthtoken ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          </div>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={compileTunnel}
            onChange={(e) => {
              const v = e.target.checked;
              setCompileTunnel(v);
              setCompileUseDevTunnel(v);
            }}
          />
          <span style={{ color: '#cbd5e1' }}>Compilazione con tunnel</span>
        </label>
      </div>

      {sdkOk === false ? (
        <div style={{ marginBottom: 8, padding: 6, borderRadius: 4, background: '#450a0a', color: '#fecaca', fontSize: 11 }}>
          Installa <code>@ngrok/ngrok</code> (<code>npm install</code>)
        </div>
      ) : null}
      {banner ? (
        <div style={{ marginBottom: 8, padding: 6, borderRadius: 4, background: '#422006', color: '#fde68a', fontSize: 11 }}>
          {banner}
        </div>
      ) : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: 10 }}>
            <th style={{ padding: '4px 6px' }}>Porta</th>
            <th style={{ padding: '4px 6px' }}>URL pubblico</th>
            <th style={{ width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const url = tunnelMap[row.port] ?? '';
            return (
              <tr key={row.id} style={{ borderTop: '1px solid #1e293b' }}>
                <td style={{ padding: '6px', verticalAlign: 'middle' }}>
                  <select
                    value={String(row.port)}
                    onChange={(e) => {
                      const p = parseInt(e.target.value, 10);
                      if (!Number.isFinite(p)) return;
                      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, port: p } : r)));
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: '1px solid #475569',
                      background: '#020617',
                      color: '#f8fafc',
                      fontSize: 11,
                      maxWidth: 100,
                    }}
                  >
                    {portSelectOptions.map((p) => (
                      <option key={p} value={String(p)}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '6px', verticalAlign: 'middle', wordBreak: 'break-all' }}>
                  {url ? (
                    <span style={{ color: '#86efac', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{url}</span>
                  ) : (
                    <span style={{ color: '#64748b' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '6px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {url ? (
                      <button
                        type="button"
                        onClick={() => copyUrl(url)}
                        style={{
                          padding: '2px 6px',
                          fontSize: 10,
                          borderRadius: 4,
                          border: 'none',
                          background: '#166534',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        Copia
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length <= 1}
                      title="Rimuovi riga"
                      style={{
                        padding: '2px 6px',
                        fontSize: 10,
                        borderRadius: 4,
                        border: '1px solid #475569',
                        background: 'transparent',
                        color: '#94a3b8',
                        cursor: rows.length <= 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          disabled={busy}
          onClick={addRow}
          style={{
            padding: '6px 10px',
            fontSize: 11,
            borderRadius: 6,
            border: '1px solid #475569',
            background: '#1e293b',
            color: '#e2e8f0',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          Aggiungi tunnel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleStartAll()}
          style={{
            padding: '6px 12px',
            fontSize: 11,
            borderRadius: 6,
            border: 'none',
            fontWeight: 600,
            background: busy ? '#475569' : '#7c3aed',
            color: '#fff',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? '…' : 'Avvia tunnel'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleStopAll()}
          style={{
            padding: '6px 12px',
            fontSize: 11,
            borderRadius: 6,
            border: '1px solid #64748b',
            background: '#0f172a',
            color: '#cbd5e1',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          Ferma tunnel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          style={{
            padding: '6px 10px',
            fontSize: 11,
            borderRadius: 6,
            border: '1px solid #334155',
            background: 'transparent',
            color: '#94a3b8',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          Aggiorna
        </button>
      </div>
    </div>
  );
}

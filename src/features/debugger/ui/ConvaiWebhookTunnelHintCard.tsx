/**
 * Card informativa nel pannello errori debugger: webhook ConvAI verso localhost richiedono tunnel pubblico (ngrok).
 */
import React from 'react';
import { Globe } from 'lucide-react';

export type ConvaiWebhookTunnelHintCardProps = {
  /** URL dei webhook (localhost) che necessitano esposizione tramite tunnel */
  urls: readonly string[];
  className?: string;
};

export function ConvaiWebhookTunnelHintCard(props: ConvaiWebhookTunnelHintCardProps) {
  const { urls, className = '' } = props;
  if (!urls.length) return null;

  return (
    <div
      className={`rounded-lg border border-sky-400/40 bg-sky-50/90 dark:border-sky-500/45 dark:bg-sky-950/40 px-3 py-2.5 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-2">
        <Globe className="h-4 w-4 mt-0.5 flex-shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-sm font-semibold text-sky-950 dark:text-sky-100">
            Webhook verso Omnia (ConvAI)
          </div>
          <p className="text-[11px] leading-snug text-sky-900/90 dark:text-sky-100/85">
            Gli agenti ElevenLabs inviano queste richieste dalla cloud: gli URL che puntano al tuo computer
            (<code className="rounded bg-sky-100/80 px-0.5 dark:bg-sky-900/80">localhost</code>) non sono
            raggiungibili dall’esterno senza un tunnel pubblico (es. ngrok). Apri{' '}
            <strong className="font-semibold">Impostazioni → Tunnel</strong>, avvia il tunnel sulla porta di
            Omnia, aggiorna la mappa porta locale → URL pubblico, poi ricompila e ripubblica l’agente se
            necessario.
          </p>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-800/90 dark:text-sky-300/90">
              URL da esporre tramite tunnel
            </div>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] font-mono text-sky-950 dark:text-sky-50 break-all">
              {urls.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

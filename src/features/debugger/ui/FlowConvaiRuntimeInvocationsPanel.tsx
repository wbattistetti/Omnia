/**
 * Accordion log runtime ConvAI sotto bolla bot (debugger flusso).
 */

import React from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import type { ConvaiRuntimeInvocationRecord } from '@domain/convaiObservability/convaiRuntimeInvocationRecord';
import { RuntimeInvocationAccordionList } from './RuntimeInvocationAccordionList';

export function FlowConvaiRuntimeInvocationsPanel(props: {
  invocations: readonly ConvaiRuntimeInvocationRecord[];
}) {
  const { invocations } = props;
  if (!invocations.length) return null;

  return (
    <details className="group mt-2 w-full max-w-xs lg:max-w-md xl:max-w-xl rounded-lg border border-violet-400/40 bg-violet-950/20 text-xs">
      <summary className="cursor-pointer list-none px-3 py-2 font-medium text-violet-100 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <ChevronDown
            size={14}
            className="shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
          <Activity size={14} aria-hidden />
          <span>
            Log ConvAI/Omnia ({invocations.length})
          </span>
        </div>
      </summary>
      <div className="border-t border-violet-400/30 px-2 py-2">
        <RuntimeInvocationAccordionList invocations={invocations} />
      </div>
    </details>
  );
}

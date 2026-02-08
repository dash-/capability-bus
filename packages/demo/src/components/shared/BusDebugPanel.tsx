import React, { useState, useCallback } from 'react';
import { useCapabilityBus, useBusEvents } from '@capability-bus/react';
import type { BusEvent } from '@capability-bus/core';

export function BusDebugPanel() {
  const bus = useCapabilityBus();
  const [events, setEvents] = useState<BusEvent[]>([]);

  useBusEvents(
    useCallback((event: BusEvent) => {
      setEvents((prev) => [...prev.slice(-49), event]);
    }, []),
  );

  const auditLog = bus.getAuditLog();

  return (
    <details className="debug-panel">
      <summary>Bus Debug Panel ({auditLog.length} invocations)</summary>
      <div className="debug-content">
        {auditLog.length === 0 && (
          <div style={{ color: 'var(--text-muted)', padding: '12px 0', fontSize: 13 }}>
            No invocations yet. Try adding an item to your cart.
          </div>
        )}
        {[...auditLog].reverse().map((record, i) => (
          <div key={i} className="debug-entry">
            <span className="cap-name">{record.invocation.capability}</span>
            <span className="caller-type">{record.invocation.caller.type}</span>
            <span className={`result-status ${record.result.status === 'success' ? 'result-success' : 'result-error'}`}>
              {record.result.status}
              {record.result.status === 'error' && ` (${record.result.code})`}
            </span>
            <span className="duration">{record.duration}ms</span>
          </div>
        ))}
      </div>
    </details>
  );
}

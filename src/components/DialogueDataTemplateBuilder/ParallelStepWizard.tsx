import React, { useEffect, useState } from "react";

export interface Subtask {
  id: string;
  label: string;
  run: () => Promise<void>;
}

export interface ParallelStepWizardProps {
  title: string;
  subtasks: Subtask[];
  onComplete: () => void;
}

type TaskStatus = "pending" | "ok" | "error";

export const ParallelStepWizard: React.FC<ParallelStepWizardProps> = ({
  title,
  subtasks,
  onComplete,
}) => {
  const [statuses, setStatuses] = useState<Record<string, TaskStatus>>(
    () =>
      Object.fromEntries(subtasks.map((t) => [t.id, "pending"])) as Record<
        string,
        TaskStatus
      >
  );
  const [running, setRunning] = useState(false);

  // Esegui tutti i task in parallelo al mount
  useEffect(() => {
    setRunning(true);
    Promise.allSettled(
      subtasks.map((t) =>
        t
          .run()
          .then(() => setStatuses((s) => ({ ...s, [t.id]: "ok" })))
          .catch(() => setStatuses((s) => ({ ...s, [t.id]: "error" })))
      )
    ).finally(() => setRunning(false));
    // eslint-disable-next-line
  }, [subtasks.map((t) => t.id).join(",")]);

  // Quando tutti sono ok, chiama onComplete
  useEffect(() => {
    if (
      Object.values(statuses).length === subtasks.length &&
      Object.values(statuses).every((s) => s === "ok")
    ) {
      onComplete();
    }
    // eslint-disable-next-line
  }, [statuses, subtasks.length]);

  // Retry singolo task
  const handleRetry = (subtask: Subtask) => {
    setStatuses((s) => ({ ...s, [subtask.id]: "pending" }));
    subtask
      .run()
      .then(() => setStatuses((s) => ({ ...s, [subtask.id]: "ok" })))
      .catch(() => setStatuses((s) => ({ ...s, [subtask.id]: "error" })));
  };

  // Progress bar
  const completed = Object.values(statuses).filter((s) => s === "ok").length;
  const total = subtasks.length;
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="max-w-xl mx-auto bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      <div className="mb-4 h-2 bg-gray-200 rounded">
        <div
          className="h-2 bg-purple-500 rounded transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul>
        {subtasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 py-2 border-b last:border-b-0"
          >
            {statuses[t.id] === "ok" && (
              <span className="text-green-600">✅</span>
            )}
            {statuses[t.id] === "pending" && (
              <span className="animate-spin text-blue-500">🔄</span>
            )}
            {statuses[t.id] === "error" && (
              <span className="text-red-600">❌</span>
            )}
            <span className="flex-1">{t.label}</span>
            {statuses[t.id] === "error" && (
              <button
                className="ml-2 px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
                onClick={() => handleRetry(t)}
              >
                Retry
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 text-sm text-gray-500">
        {completed === total
          ? "Tutti i task completati!"
          : `Completati: ${completed} / ${total}`}
      </div>
    </div>
  );
};

export default ParallelStepWizard; 
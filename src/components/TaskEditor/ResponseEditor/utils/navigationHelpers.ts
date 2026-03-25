// Navigation helpers for Response Editor
// Provides utilities for scrolling and highlighting elements

/**
 * Scrolls to a specific step in BehaviourEditor
 */
export function scrollToStep(stepKey: string): void {
  const stepElement = document.querySelector(`[data-step-key="${stepKey}"]`);
  if (stepElement) {
    stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    stepElement.classList.add('navigation-step-flash');
    setTimeout(() => {
      stepElement.classList.remove('navigation-step-flash');
    }, 450);
  }
}

/**
 * Scrolls to a specific escalation
 */
export function scrollToEscalation(escalationIndex: number): void {
  const escalationElement = document.querySelector(`[data-escalation-index="${escalationIndex}"]`);
  if (escalationElement) {
    escalationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Highlight temporarily
    escalationElement.classList.add('error-highlight');
    setTimeout(() => {
      escalationElement.classList.remove('error-highlight');
    }, 2000);
  }
}

/**
 * Highlights a specific task in an escalation
 */
export function highlightTask(escalationIndex: number, taskIndex: number): void {
  const taskElement = document.querySelector(
    `[data-escalation-index="${escalationIndex}"][data-task-index="${taskIndex}"]`
  );
  if (taskElement) {
    taskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    taskElement.classList.add('navigation-step-flash');
    setTimeout(() => {
      taskElement.classList.remove('navigation-step-flash');
    }, 450);
  }
}

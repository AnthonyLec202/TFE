/**
 * React Router location state attached when navigating into the Session Detail view.
 * Lets the detail's Back button return to the origin route with a context-aware label,
 * instead of a hardcoded destination. Shared by the `sessions` and `patients` features.
 */
export interface SessionDetailOrigin {
  /** Absolute route to return to when leaving the Session Detail view. */
  from: string;
  /** Human-readable label for the Back link (e.g. "My Sessions" or a patient's name). */
  label: string;
}

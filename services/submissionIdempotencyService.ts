export type PendingSubmission = {
  command: string;
  id: string;
};

function normalizeCommand(command: string) {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}

export function createSubmissionIdempotencyTracker(generateId: () => string) {
  let pending: PendingSubmission | null = null;

  return {
    idFor(command: string) {
      const normalizedCommand = normalizeCommand(command);
      if (pending?.command === normalizedCommand) return pending.id;
      pending = { command: normalizedCommand, id: generateId() };
      return pending.id;
    },

    complete(command: string) {
      if (pending?.command === normalizeCommand(command)) pending = null;
    },

    cancel() {
      pending = null;
    },

    current() {
      return pending;
    },
  };
}

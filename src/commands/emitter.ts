export type CommandHandler = () => void;

export interface CommandEmitter {
  subscribe: (commandId: string, handler: CommandHandler) => () => void;
  emit: (commandId: string) => void;
}

export function createCommandEmitter(): CommandEmitter {
  const handlers = new Map<string, Set<CommandHandler>>();

  return {
    subscribe: (commandId: string, handler: CommandHandler) => {
      if (!handlers.has(commandId)) {
        handlers.set(commandId, new Set());
      }
      handlers.get(commandId)?.add(handler);

      return () => {
        handlers.get(commandId)?.delete(handler);
      };
    },

    emit: (commandId: string) => {
      const commandHandlers = handlers.get(commandId);
      if (commandHandlers) {
        for (const handler of commandHandlers) {
          handler();
        }
      }
    },
  };
}

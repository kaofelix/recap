import { createCommandEmitter } from "./emitter";

// Global command emitter singleton
export const commandEmitter = createCommandEmitter();

export type { CommandEmitter, CommandHandler } from "./emitter";

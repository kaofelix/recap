import { cn } from "../../lib/utils";

export interface DiffViewProps {
  className?: string;
}

export function DiffView({ className }: DiffViewProps) {
  return (
    <div
      className={cn(
        "h-full flex flex-col",
        "bg-panel-bg",
        className
      )}
    >
      <div
        className={cn(
          "h-10 flex items-center px-3 justify-between",
          "border-b border-panel-border",
          "bg-panel-header-bg"
        )}
      >
        <h2 className="text-sm font-semibold text-text-primary">
          src/App.tsx
        </h2>
        <div className="flex items-center gap-2">
          <button
            className={cn(
              "px-2 py-0.5 rounded text-xs",
              "bg-bg-secondary hover:bg-bg-hover",
              "border border-border-primary",
              "text-text-primary"
            )}
          >
            Split
          </button>
          <button
            className={cn(
              "px-2 py-0.5 rounded text-xs",
              "bg-bg-secondary hover:bg-bg-hover",
              "border border-border-primary",
              "text-text-primary"
            )}
          >
            Unified
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        {/* Placeholder diff content */}
        <div className="space-y-0">
          <div className="bg-diff-hunk-bg text-text-secondary px-2 py-1">
            @@ -1,7 +1,9 @@
          </div>
          <div className="px-2 py-0.5 text-text-primary">
            <span className="text-text-tertiary mr-3">1</span>
            {"import React from 'react';"}
          </div>
          <div className="bg-diff-delete-bg px-2 py-0.5">
            <span className="text-text-tertiary mr-3">2</span>
            <span className="text-diff-delete-text">{"- import { useState } from 'react';"}</span>
          </div>
          <div className="bg-diff-add-bg px-2 py-0.5">
            <span className="text-text-tertiary mr-3">2</span>
            <span className="text-diff-add-text">{"+ import { useState, useEffect } from 'react';"}</span>
          </div>
          <div className="px-2 py-0.5 text-text-primary">
            <span className="text-text-tertiary mr-3">3</span>
          </div>
          <div className="px-2 py-0.5 text-text-primary">
            <span className="text-text-tertiary mr-3">4</span>
            {"function App() {"}
          </div>
        </div>
      </div>
    </div>
  );
}

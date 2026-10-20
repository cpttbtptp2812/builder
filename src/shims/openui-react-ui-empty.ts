import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children?: ReactNode }) {
  return children ?? null;
}

export const openuiChatLibrary = {};
export const openuiChatPromptOptions = {};

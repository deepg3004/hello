"use client";

// Lightweight context so interactive widgets (Lead Form, Buy) know which site
// they're rendered in. The form posts the siteId (NOT a client-supplied email)
// so the server resolves the owner's address — no open email relay.

import { createContext, useContext } from "react";

export interface BuilderRenderContext {
  siteId?: string;
  /** Editor preview suppresses live submits (no real lead/charge while editing). */
  preview?: boolean;
}

const Ctx = createContext<BuilderRenderContext>({});

export function BuilderContextProvider({
  value,
  children,
}: {
  value: BuilderRenderContext;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBuilderContext(): BuilderRenderContext {
  return useContext(Ctx);
}

import { NextResponse } from "next/server";
import type { ServerErrorCode, WebGratisErrorCode } from "./schema";

/** Consistent `{ data, error, message }` envelope for the funnel's API routes. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data, error: null, message: null }, init);
}

export function fail(status: number, error: WebGratisErrorCode | ServerErrorCode, message?: string) {
  return NextResponse.json({ data: null, error, message: message ?? null }, { status });
}

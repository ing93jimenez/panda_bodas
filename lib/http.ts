import { NextResponse } from "next/server";

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

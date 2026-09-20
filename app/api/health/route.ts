import { NextResponse } from "next/server";
import { connectionStatus } from "@/lib/runtime";

export function GET() {
  return NextResponse.json({ ok: true, app: "tun-conversation-engine", integrations: connectionStatus(), timestamp: new Date().toISOString() });
}

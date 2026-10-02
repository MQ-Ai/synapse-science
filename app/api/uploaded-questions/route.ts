import { NextResponse } from "next/server";
import { getStore } from "@/lib/uploaded-questions-store";

export const runtime = "nodejs";

export async function GET() {
  const questions = await getStore();
  return NextResponse.json({ questions });
}

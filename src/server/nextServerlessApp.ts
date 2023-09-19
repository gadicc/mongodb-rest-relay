import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Db } from "mongodb";
import { processDbRequest, assertResponse } from "./common";

export default function makeRelay(db: Db, relayPassword?: string) {
  return async function vercelServerlessOtherRelay(request: NextRequest) {
    return assertResponse(
      await processDbRequest(db, request, relayPassword),
    ) as NextResponse;
  };
}

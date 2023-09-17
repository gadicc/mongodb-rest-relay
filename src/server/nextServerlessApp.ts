import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Db } from "mongodb";
import { processDbRequest } from "./common";

export default function makeRelay(db: Db, relayPassword?: string) {
  return async function vercelServerlessOtherRelay(request: NextRequest) {
    const processedResponse = await processDbRequest(
      db,
      request,
      relayPassword,
    );

    return new NextResponse(processedResponse.body, {
      status: processedResponse.status,
      headers: processedResponse.headers,
    });
  };
}

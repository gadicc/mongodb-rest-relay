import { NextApiRequest, NextApiResponse } from "next";
import type { Db } from "mongodb";
import { processDbRequest, assertResponse } from "./common";

export default function makeRelay(db: Db, relayPassword?: string) {
  return async function vercelServerlessOtherRelay(
    request: NextApiRequest,
    response: NextApiResponse,
  ) {
    const processedResponse = assertResponse(
      await processDbRequest(
        db,
        // @ts-expect-error: later
        request,
        relayPassword,
      ),
    );

    response.status(processedResponse.status);
    for (const [key, value] of processedResponse.headers.entries())
      response.setHeader(key, value);
    response.end(processedResponse.body);
  };
}

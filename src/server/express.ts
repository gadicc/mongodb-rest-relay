import type { Db } from "mongodb";
import { processDbRequest } from "./common";

export default function makeRelay(db: Db, relayPassword?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function expressRelay(req: Request, res: any) {
    const response = await processDbRequest(db, req, relayPassword);

    res.status(response.status);
    for (const [key, value] of response.headers.entries())
      if ("setHeader" in res) res.setHeader(key, value);
      else res.headers.set(key, value);
    res.end(response.body);
  };
}

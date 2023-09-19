import type { Db } from "mongodb";
import { processDbRequest } from "./common";
import { EJSON } from "bson";

export default function makeRelay(db: Db, relayPassword?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function expressRelay(req: Request, res: any) {
    const result = await processDbRequest(db, req, relayPassword);
    if (result instanceof Response)
      throw new Error(
        "Streams not supported by express handler yet... let us know if you need this!",
      );

    if ("setHeader" in res) {
      res.status(200);
      res.setHeader("Content-Type", "application/json");
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
    }
    res.end(EJSON.stringify(result));
  };
}

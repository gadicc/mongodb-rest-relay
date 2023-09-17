import type { Db } from "mongodb";
import makeRelay from "./server/express";

export default function deprecatedMakeRelay(db: Db, relayPassword?: string) {
  // TODO: deprecation message if we stick to this.
  return makeRelay(db, relayPassword);
}

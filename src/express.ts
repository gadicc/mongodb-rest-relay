import type { Db, Document as MongoDocument, Filter } from "mongodb";
import type { FindOptions } from "./cursor";
import { URLSearchParams } from "url";

async function find(
  db: Db,
  coll: string,
  filter: Filter<MongoDocument>,
  opts: FindOptions,
) {
  const cursor = db.collection(coll).find(filter);
  if (opts.sort) cursor.sort(opts.sort.sort, opts.sort.direction);
  if (opts.limit) cursor.limit(opts.limit);
  if (opts.skip) cursor.skip(opts.skip);
  if (opts.project) cursor.project(opts.project);
  return await cursor.toArray();
}

async function tryCatchResult(fn: () => unknown) {
  try {
    return { $result: await fn() };
  } catch (error) {
    if (error instanceof Error)
      return {
        $error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      };
    else return { $error: JSON.stringify(error) };
  }
}

export default function makeRelay(
  db: Db,
  relayPassword = process.env.MONGODB_RELAY_PASSWORD,
) {
  if (!relayPassword)
    throw new Error(
      "Either makeRelay(db, relayPassword) or set MONGODB_RELAY_PASSWORD",
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function expressRelay(req: Request, res: any) {
    const headers =
      req.headers instanceof Headers ? req.headers : new Headers(req.headers);

    if (headers.get("bearer") !== relayPassword) {
      res
        .status(401)
        .end(
          "Unauthorized" + " " + headers.get("bearer") + " " + relayPassword,
        );
      return;
    }

    const paramString = req.url.substring(req.url.indexOf("?") + 1);
    const { op, coll, ...params } = Object.fromEntries(
      new URLSearchParams(paramString),
    );
    let data: Record<string, string> | null = null;
    if (req.method === "POST") {
      if (headers.get("content-type") === "application/json") {
        if ("json" in req) {
          data = await req.json();
        } else if (
          // @ts-expect-error: ok
          typeof req.body === "object"
        ) {
          // @ts-expect-error: ok
          data = req.body;
        } else {
          throw new Error("Not sure how to parse POST body");
        }
      }
    }

    let result;
    if (op === "find") {
      const filter = data?.filter as unknown as Filter<MongoDocument>;
      const opts = (data?.opts as FindOptions) || {};
      console.log("find", coll, filter, opts);
      result = await tryCatchResult(() => find(db, coll, filter, opts));
    } else {
      const collection = db.collection(coll);
      if (op in collection) {
        console.log(op, coll, data);
        result = await tryCatchResult(() =>
          // @ts-expect-error: later
          collection[op](...data),
        );
      } else {
        result = { $error: `Unknown mongodb-relay-rest operation: ${op}` };
      }
    }

    res.json(result);
  }
  return expressRelay;
}

import type { Db, Document as MongoDocument, Filter } from "mongodb";
import type { FindOptions } from "./cursor";

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

export default function makeRelay(db: Db) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function expressRelay(req: Request, res: any) {
    const url = new URL(req.url);
    const { op, coll, ...params } = Object.fromEntries(
      url.searchParams.entries(),
    );
    let data: Record<string, string> | null = null;
    if (req.method === "POST") {
      if (req.headers.get("content-type") === "application/json") {
        data = await req.json();
      }
    }

    let result;
    if (op === "find") {
      const filter = data?.filter as unknown as Filter<MongoDocument>;
      const opts = (data?.opts as FindOptions) || {};
      result = await tryCatchResult(() => find(db, coll, filter, opts));
    } else {
      const collection = db.collection(coll);
      if (op in collection) {
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

import type {
  Collection as MongoCollection,
  Document as MongoDocument,
  Filter,
  WithId,
} from "mongodb";
import RelayCursor from "./cursor";
import type { RelayDb } from "./database";

class RelayCollection<DocType extends MongoDocument = MongoDocument> {
  db: RelayDb;
  name: string;

  constructor(db: RelayDb, name: string) {
    this.db = db;
    this.name = name;
  }

  find(filter: Filter<DocType>) {
    return new RelayCursor(this, filter);
  }

  async insertOne(doc: DocType) {
    const data = await this._exec("insertOne", doc);
    if (data.$result)
      return data.$result as unknown as ReturnType<
        MongoCollection["insertOne"]
      >;
    else throw new Error("insertOne error TODO");
  }

  async _exec(op: string, payload: Record<string, unknown>) {
    const params = new URLSearchParams();
    // params.append("db", this.db._dbName || "");
    params.append("coll", this.name);
    params.append("op", op);

    const url = this.db._client._url + "?" + params;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    response; //?

    return (await response.json()) as Record<string, unknown>;
  }
}

export type { RelayCollection };
export default RelayCollection;

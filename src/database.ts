import RelayCollection from "./collection";
import type { RelayMongoClient } from "./client";

class RelayDb {
  _client: RelayMongoClient;
  _collections: Map<string, RelayCollection> = new Map();
  _name: string;

  constructor(client: RelayMongoClient, name: string) {
    this._client = client;
    this._name = name;
  }

  collection(name: string) {
    let collection = this._collections.get(name);
    if (!collection) {
      collection = new RelayCollection(this, name);
      this._collections.set(name, collection);
    }
    return collection;
  }
}

export type { RelayDb };
export default RelayDb;

import RelayDb from "./database";

export interface RelayMongoClientOptions {
  fetch?: RequestInit;
}

class RelayMongoClient {
  _url: string;
  _options: RelayMongoClientOptions;

  constructor(url: string, options: RelayMongoClientOptions = {}) {
    this._url = url;
    this._options = options;
  }

  connect(callback?: (err: Error | null) => void) {
    if (callback) callback(null);
    else return Promise.resolve(this);
  }

  db(name: string) {
    return new RelayDb(this, name);
  }
}

export type { RelayMongoClient };
export default RelayMongoClient;

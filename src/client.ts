import RelayDb from "./database";

class RelayMongoClient {
  _url: string;

  constructor(url: string) {
    this._url = url;
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

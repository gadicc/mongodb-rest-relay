# mongodb-rest-relay

Relay mongodb queries over HTTP REST. Great for Edge.

Copyright (c) 2023 by Gadi Cohen. [MIT Licensed](./LICENSE.txt).

![npm](https://img.shields.io/npm/v/mongodb-rest-relay) ![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/gadicc/mongodb-rest-relay/release.yml) ![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/gadicc/92f2b56335875f380d828a6f0b870fbb/raw/mongodb-rest-relay-coverage-main.json) [![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release) [![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/) [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## Intro

`mongodb-rest-relay` is meant to be a drop-in replacement for `mongodb`, that sends
the actual request to the real `mongodb` elsewhere. It may be a better fit for edge
and serverless, depending on your use case. You get the advantages of MongoDB own
REST service but with the same fixed and predictable pricing (but no elastic scaling).

## Quick Start

Modify an existing **edge** function (or create one as usual):

```diff
+ // That's it; the API is compatible (for *basic* functionality only)
- import { MongoClient } from "mongodb";
+ import { MongoClient } from "mongodb-rest-relay"
```

And you can run the other side of the relay as **serverless**
(near your database):

```js
import { MongoClient } from "mongodb";
import makeExpressRelay from "mongodb-rest-relay/lib/express";

const client = new MongoClient(process.env.MONGO_URL);

export default const handler = makeExpressRelay(client);
```

## Notes

- Only basic CRUD functionality is provided, not aggregates or
  other more complex features.

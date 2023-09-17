// https://stackoverflow.com/questions/20058614/stream-from-a-mongodb-cursor-to-express-response-in-node-js

const util = require("util");
const stream = require("stream");
const Transform = stream.Transform;

export function Stringer() {
  Transform.call(Stringer, { objectMode: true });
  // 'object mode allows us to consume one object at a time
}

util.inherits(Stringer, Transform);

// @ts-expect-error: later
Stringer.prototype._transform = function (chunk, encoding, cb) {
  console.log("chunk", chunk);
  const output = JSON.stringify(chunk, null, 2) + "\n";
  this.push(output); // 'push' method sends data down the pike.
  cb(); // callback tells the incoming stream we're done processing
};

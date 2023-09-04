import { RelayMongoClientOptions } from "./client";

const optionsOnce: Array<RelayMongoClientOptions> = [];

export function setOptionsOnce(options: RelayMongoClientOptions) {
  optionsOnce.push(options);
}

export function shiftOptionsOnce() {
  return optionsOnce.shift();
}

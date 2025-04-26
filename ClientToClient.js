const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

export class ClientToClientConnection {
  #targetAddress;
  #targetCertificate;
  #sessionToken;

  #proto;

  constructor(targetAddress, sessionToken) {
    this.#targetAddress = targetAddress;
    this.#sessionToken = sessionKey;

    // create channel
    const packageDefinition = protoLoader.loadSync("service.proto");
    this.#proto = grpc.loadPackageDefinition(packageDefinition);

    const credentials = grpc;
  }

  getTargetAddress() {
    return this.#targetAddress;
  }

  // sending data
  async send() {}

  async initCommunication() {}
}

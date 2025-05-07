const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

// this client connection creates channel as a sender.
// receiver instance is set up as a listener (Listener.js)
export class Connection {
  #targetCertificate;
  #sessionToken;
  #targetAddress;

  #proto;
  #channel;

  constructor(certificate, session_token, target_address) {
    this.#targetCertificate = certificate;
    this.#sessionToken = session_token;
    this.#targetAddress = target_address;

    // create channel as a sender
    const packageDefinition = protoLoader.loadSync("service.proto");
    this.#proto = grpc.loadPackageDefinition(packageDefinition);
    this.createChannel();
  }

  // estabilishing connection
  createChannel() {
    this.#channel = new this.#proto.ClientService(
      this.#targetAddress,
      grpc.credentials.createSsl
    );
  }

  // Getters/Setters
  getTargetAddress() {
    return this.#targetAddress;
  }

  // sending data
  async send() {}

  async initCommunication() {}
}

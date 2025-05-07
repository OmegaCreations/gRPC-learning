import { serializeRequest } from "./utils/DataManipulation";

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

// this client connection creates channel as a sender.
// receiver instance is set up as a listener (Listener.js)
export class Connection {
  #jwtToken;
  #targetAddress;
  #requestType;
  #TTL;

  #proto;
  #channel;

  constructor(targetAddress, jwtToken, requestType, TTL, credentials) {
    this.#jwtToken = jwtToken;
    this.#targetAddress = targetAddress;
    this.#requestType = requestType;
    this.#TTL = TTL;

    // 1. Create connection channel
    const packageDefinition = protoLoader.loadSync("service.proto");
    this.#proto = grpc.loadPackageDefinition(packageDefinition);
    this.createChannel(credentials);
  }

  /**
   * @description Creates new channel for connection
   */
  createChannel(credentials) {
    this.#channel = new this.#proto.ClientService(
      this.#targetAddress,
      credentials
    );
  }

  /**
   * @description Sends data on opened channel
   */
  async send(data) {
    const request = {
      payload: serializeRequest(data),
    };

    const response = await new Promise((resolve, reject) => {
      this.#channel.sendPayload(request, (err, response) => {
        if (err) {
          return reject("Sending data failed: " + err.message);
        }
        resolve(response);
      });
    })
      .then((data) => data)
      .catch((e) => console.log(e));

    console.log(response);
  }
}

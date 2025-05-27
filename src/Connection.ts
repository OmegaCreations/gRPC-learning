import { serializeRequest } from "./utils/DataManipulation";
import { RequestType } from "./wrapper";

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

// this client connection creates channel as a sender.
// receiver instance is set up as a listener (Listener.js)
export class Connection {
  jwtToken: string;
  targetAddress: string;
  requestType: RequestType;
  TTL: string;
  clientCertificate: string | null;

  #proto;
  #channel;

  constructor({
    targetAddress,
    jwtToken,
    requestType,
    TTL,
    clientCertificate,
    credentials = null,
  }) {
    this.jwtToken = jwtToken;
    this.targetAddress = targetAddress;
    this.requestType = requestType;
    this.TTL = TTL;

    // 1. Create connection channel
    if (credentials) {
      const packageDefinition = protoLoader.loadSync("service.proto");
      this.#proto = grpc.loadPackageDefinition(packageDefinition);
      this.createChannel(credentials);
    } else {
      this.clientCertificate = clientCertificate;
    }
  }

  /**
   * @description Creates new channel for connection
   */
  private createChannel(credentials) {
    this.#channel = new this.#proto.ClientService(
      this.targetAddress,
      credentials
    );
  }

  /**
   * @description Sends data on opened channel
   */
  public async send(url, options) {
    const request = {
      payload: serializeRequest(url, options),
    };

    const response = await new Promise((resolve, reject) => {
      this.#channel.sendPayload(request, (err, response) => {
        if (err) {
          return reject("Sending data failed: " + err.message);
        }
        resolve(response);
      });
    });
    console.log(response);

    return response;
  }
}

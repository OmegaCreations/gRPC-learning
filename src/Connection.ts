import { serializeRequest } from "./utils/DataManipulation";
import { RequestType } from "./wrapper";

import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

interface ConnectionOptions {
  targetAddress: string;
  jwtToken: string;
  requestType: RequestType | string;
  TTL: string;
  clientCertificate?: string | null;
  credentials?: any; // gRPC credentials, if available
}

// this client connection creates channel as a sender.
// receiver instance is set up as a listener (Listener.js)
export class Connection {
  jwtToken: string;
  targetAddress: string;
  requestType: RequestType | string;
  TTL: string;
  clientCertificate: string | null = null;

  private proto: any;
  private channel: any;

  constructor({
    targetAddress,
    jwtToken,
    requestType,
    TTL,
    clientCertificate,
    credentials = null,
  }: ConnectionOptions) {
    this.jwtToken = jwtToken;
    this.targetAddress = targetAddress;
    this.requestType = requestType;
    this.TTL = TTL;

    // 1. Create connection channel
    if (credentials) {
      const packageDefinition = protoLoader.loadSync("./central.proto");
      this.proto = grpc.loadPackageDefinition(packageDefinition);
      this.createChannel(credentials);
    } else if (clientCertificate) {
      this.clientCertificate = clientCertificate;
    }
  }

  /**
   * @description Creates new channel for connection
   */
  private createChannel(credentials: any) {
    this.channel = new this.proto.ClientService(
      this.targetAddress,
      credentials
    );
  }

  /**
   * @description Sends data on opened channel
   */
  public async send(url: string, options: any) {
    const request = {
      payload: serializeRequest(url, options),
    };

    const response = await new Promise((resolve, reject) => {
      this.channel.sendPayload(request, (err: any, response: any) => {
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

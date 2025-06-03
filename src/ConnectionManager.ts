import { Connection } from "./Connection";
import {
  checkUrl,
  decryptHybrid,
  deserializeRequest,
  serializeRequest,
} from "./utils/DataManipulation";
import axios from "axios";
import { NewConnectionData, RequestType } from "./wrapper";
import { Request, Response, NextFunction } from "express";

import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import jwt from "jsonwebtoken";
import fs from "fs";

export class ConnectionManager {
  private certificate: string;
  // List of allowed client certificates get from the central system
  private allowedClientCerts: Map<string, string> = new Map();
  private openSendingConnections: Map<string, Connection> = new Map();
  private openReceivingConnections: Map<string, Connection> = new Map();
  private port: number;
  private privateKey: string;

  private insecureListener: grpc.Server;
  private secureListener: grpc.Server;

  constructor(
    listenerPort: number = 50052,
    certificate: string,
    privateKey: string
  ) {
    this.privateKey = privateKey;

    const packageDefinition = protoLoader.loadSync("./central.proto", {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto = grpc.loadPackageDefinition(packageDefinition) as any;
    const clientService = proto.clientService || proto.ClientService;
    if (!clientService || !clientService.service) {
      throw new Error("Could not find clientService definition in proto");
    }
    const clientServiceDefinition = clientService.service;

    this.port = listenerPort;
    this.certificate = certificate;

    this.secureListener = new grpc.Server();
    this.secureListener.addService(clientServiceDefinition, {
      sendPayload: this.receivePayload.bind(this),
    });

    this.insecureListener = new grpc.Server();
    this.insecureListener.addService(clientServiceDefinition, {
      sendConnectionData: this.handleNewReceiverConnection.bind(this),
    });

    // gRPC credentials
    const listenerCredentials = grpc.ServerCredentials.createSsl(
      null, // no root certificates, we verify only client certs
      [
        {
          cert_chain: fs.readFileSync(
            "C:\\Users\\Maks\\Desktop\\Projects\\gRPC\\testing\\simple-connection-test\\certs\\clientReceiver.crt"
          ),
          private_key: fs.readFileSync(
            "C:\\Users\\Maks\\Desktop\\Projects\\gRPC\\testing\\simple-connection-test\\certs\\clientReceiver_private.key"
          ),
        },
      ],
      true // requires client certificate
    );

    // create a gRPC server listener --------------------------------------
    // with a "hack" that allows dynamic certificate validation
    this.secureListener.bindAsync(
      `localhost:${this.port}`,
      listenerCredentials,
      (err: Error | null, port: number) => {
        if (err) {
          console.error("Error during port binding:", err);
          return;
        }

        console.log(`gRPC Server listens on ${port}`);

        // We check if the HTTP2 server is available after asynchronous binding
        const check = setInterval(() => {
          const http2ServersMap = (this.secureListener as any)
            .http2Servers as Map<string, import("http2").Http2Server>;
          const [http2Server] = Array.from(http2ServersMap.keys());

          if (http2Server) {
            clearInterval(check);
            console.log(
              "HTTP2 server avaible - now connects .on('secureConnection')"
            );

            (http2Server as any).on("secureConnection", (socket: any) => {
              try {
                console.log("New connection");

                // we get the client certificate and check if it's valid before allowing the connection
                const clientCert = socket.getPeerCertificate(true);
                if (!clientCert || !this.isValidClientCert(clientCert)) {
                  socket.destroy();
                }
              } catch {
                socket.destroy();
              }
            });
          }
        }, 50);
      }
    );

    this.insecureListener.bindAsync(
      `localhost:${this.port + 1}`,
      grpc.ServerCredentials.createInsecure(),
      (err: Error | null, port: number) => {
        if (err) {
          console.error("Error during port binding:", err);
          return;
        }

        console.log(`gRPC Insecure Server listens on ${port}`);
        this.insecureListener.start();
      }
    );
  }

  // Creates a gRPC sender connection
  public createSenderConnection(
    targetAddress: string,
    jwtToken: string,
    requestType: RequestType | string,
    TTL: string
  ): Connection {
    const existingConnection = this.openSendingConnections.get(targetAddress);
    if (existingConnection) {
      return existingConnection;
    }

    const credentials = this.createSenderCredentials(jwtToken);
    const connection: Connection = new Connection({
      targetAddress,
      jwtToken,
      requestType,
      TTL,
      clientCertificate: null,
      credentials,
    });

    this.openSendingConnections.set(targetAddress, connection);

    return connection;
  }

  // creates gRPC credentials for sender connection
  private createSenderCredentials(token: string) {
    return grpc.credentials.createSsl(Buffer.from(token));
  }

  // handles incoming receiver connection requests
  private handleNewReceiverConnection(call: any, callback: any) {
    try {
      const jwtToken = decryptHybrid(
        call.request.encryptedJwtToken,
        call.request.encryptedAesKey,
        call.request.iv,
        this.privateKey
      );

      const {
        clientCertificate,
        requestType,
        TTL,
        sourceAddress,
      }: NewConnectionData = jwt.verify(jwtToken, this.certificate, {
        algorithms: ["HS256"],
      });

      // adds new connection to the open receiving connections
      // and allows the client certificate to connect
      this.allowedClientCerts.set(sourceAddress, clientCertificate);
      this.createReceiverConnection(
        sourceAddress,
        jwtToken,
        requestType,
        TTL,
        clientCertificate
      );

      callback(null, {});
    } catch (err) {
      console.error("Receiver connection error:", err);
      callback({});
    }
  }

  private isValidClientCert(clientCert: string): boolean {
    // Check if the client certificate is in the list of allowed certificates
    return this.allowedClientCerts.has(clientCert);
  }

  private createReceiverConnection(
    sourceAddress: string,
    jwtToken: string,
    requestType: RequestType | string,
    TTL: string,
    clientCertificate: string
  ) {
    const connection = new Connection({
      targetAddress: sourceAddress,
      jwtToken,
      requestType,
      TTL,
      clientCertificate,
    });

    this.openReceivingConnections.set(sourceAddress, connection);
  }

  private createReceiverCredentials(token: string) {
    return grpc.credentials.createSsl(Buffer.from(token));
  }

  // Receives payload from the sender and forwards it to the target address
  // This method is called by the gRPC server when a payload is sent via the `sendPayload` RPC method
  private receivePayload(call: any, callback: any) {
    try {
      const { sourceAddress, payload } = call.request;

      if (!this.openReceivingConnections.get(sourceAddress)) {
        console.log(
          "Invalid connection: No opened channel for address: ",
          sourceAddress
        );
        return;
      }

      const deserializedPayload = deserializeRequest(payload);
      console.log("Deserialized payload:", deserializedPayload);

      // sanitize URL to prevent RCE
      if (!checkUrl(deserializedPayload.data.url, ["localhost"])) {
        console.error("Invalid URL in payload:", deserializedPayload.data.url);
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: "Invalid URL in payload",
        });
      }

      if (deserializedPayload) {
        axios({
          url: deserializedPayload.data.url,
          ...deserializedPayload.data.options,
        })
          .then((response) => {
            const data = response.data;
            console.log("Data forwarded successfully:", data);

            const serializedPayload = serializeRequest(data);
            callback(null, { payload: serializedPayload });
          })
          .catch((error) => {
            console.error("Error forwarding data:", error);
            callback({
              code: grpc.status.INTERNAL,
              details: "Error forwarding data",
            });
          });
      } else {
        console.error("Invalid payload structure:", deserializedPayload);
        callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: "Invalid payload structure",
        });
      }
    } catch (err) {
      console.error("Error processing payload:", err);
      callback({
        code: grpc.status.INTERNAL,
        details: "Error processing payload",
      });
    }
  }

  // MIDDLEWARE
  public getMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // 1. we get JWT token from the request headers
        const jwtToken = this.extractToken(req);
        if (!jwtToken) throw new Error("Missing JWT");

        // 2. look for an opened connection by JWT token
        const connection = this.findConnectionByToken(jwtToken);
        if (!connection) throw new Error("Invalid connection");

        // 3. verify the JWT token using the server's certificate
        const decoded = this.verifyJwt(jwtToken);

        // 4. Check if the endpoint is accessible for the specific connection
        this.validateEndpointAccess(decoded, req.method);

        next();
      } catch (error) {
        res.status(401).json({ error: "Unauthorized: " + error });
      }
    };
  }

  // Extracts JWT token from the request headers
  private extractToken(req: Request): string | null {
    return req.headers.authorization?.split(" ")[1] || null;
  }

  // Finds an opened connection by JWT token
  private findConnectionByToken(token: string): Connection | undefined {
    // Szukaj we wszystkich aktywnych połączeniach
    return [
      ...Array.from(this.openSendingConnections.values()),
      ...Array.from(this.openReceivingConnections.values()),
    ].find((conn) => conn.jwtToken === token);
  }

  // Verifies the JWT token using the server's certificate
  private verifyJwt(jwtToken: string): any {
    try {
      return jwt.verify(jwtToken, this.certificate);
    } catch (error) {
      throw new Error("Invalid JWT: " + error);
    }
  }

  private validateEndpointAccess(decodedJwt: any, method: any) {
    // check if request is allowed
    if (decodedJwt.requestType !== method) {
      throw new Error(`Method ${method} not allowed for this connection`);
    }
  }
}

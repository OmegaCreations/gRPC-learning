import { Connection } from "./Connection";
import { deserializeRequest } from "./utils/DataManipulation";

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const jwt = require("jsonwebtoken");

export class ConnectionManager {
  // client data
  #certificate;

  // Connection manager data
  #openSendingConnections = new Map();
  #openReceivingConnections = new Map();
  #port;
  #listener;

  constructor(listenerPort = "50052", certificate) {
    // 1. Create gRPC server instance as our Listener
    const packageDefinition = protoLoader.loadSync("./central.proto", {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto = grpc.loadPackageDefinition(packageDefinition);
    const clientService = proto.clientService;

    this.#port = listenerPort;
    this.#certificate = certificate;

    this.#listener = new grpc.Server();

    this.#listener.addService(clientService, {
      // creates receiver connection based on data given from Central System
      sendConnectionData: this.#handleNewReceiverConnection.bind(this),

      // receives payload from another client
      sendPayload: this.#receivePayload.bind(this),
    });

    // 2. We bind listener to port and create insecure channel for incoming requests
    this.#listener.bindAsync(
      `0.0.0.0:${this.#port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`Listener running on port ${port}`);
        resolve(port);
      }
    );
  }

  // ====================================
  //          SENDERS HANDLING
  // ====================================
  /**
   * @description Creates an instance of new sending connection from this client
   */
  createSender(jwt_token, target_address) {
    const newClient = new Connection(jwt_token, target_address);

    this.#openSendingConnections.set(jwt_token, newClient);
    return newClient;
  }

  // ====================================
  //          RECEIVERS HANDLING
  // ====================================
  /**
   * @description Handles an instance of new receiver connection from another client
   */
  #handleNewReceiverConnection(call, callback) {
    try {
      const { encrypted_jwt_token } = call.request;

      // 1. Verify encrypted JWT token
      const { jwt_token } = jwt.verify(encrypted_jwt_token, this.#certificate);

      // 2. Retreive data from JWT token
      const { request_type, TTL, source_address } = jwt.verify(
        jwt_token,
        this.#certificate
      );

      // 3. Create new receiver connection
      this.#createReceiverConnection(
        source_address,
        jwt_token,
        request_type,
        TTL
      );

      // 4. Return empty gRPC message
      //    can be extended with some status information to Central System
      callback(null, {});
    } catch (err) {
      console.error("Receiver connection error:", err);
      callback({});
    }
  }

  /**
   * @description Handles creation of new receiver instance
   */
  #createReceiverConnection(source_address, jwt_token, request_type, TTL) {
    const credentials = this.#createReceiverCredentials(jwt_token);
    const connection = new Connection(
      source_address,
      jwt_token,
      request_type,
      TTL,
      credentials
    );

    this.#openReceivingConnections.set(source_address, connection);
  }

  /**
   * @description Handles creation of new receiver gRPC credentials
   */
  #createReceiverCredentials(token) {
    return grpc.credentials.combineChannelCredentials(
      grpc.credentials.createSsl(Buffer.from(token))
    );
  }

  /**
   * @description Handles receiving new payload from on of openReceivingConnections channel
   */
  #receivePayload(call, callback) {
    try {
      const { content_type, jwt_token, payload } = call.request;

      // 1. Check if connection is in opened channels
      if (!this.#openReceivingConnections.get(jwt_token)) {
        console.log(
          "Invalid connection: No opened channel for token: ",
          jwt_token
        );
        return;
      }

      // 2. Process payload
      // for now only application/json for REST API endpoints.
      const deserializedPayload = deserializeRequest(payload);
      console.log("Deserialized payload:", deserializedPayload);

      // 3. Emit request processed by wrapper
      this.emit("payload", {
        payload,
      });

      // 4. Process response to client
      callback(null, {
        //...
      });
    } catch (err) {
      console.error("Error processing payload:", err);
      callback({
        // ....
      });
    }
  }

  // ====================================
  //          UTILITIES
  // ====================================
  getReceiverConnection(token) {
    return this.#openReceivingConnections.get(token);
  }

  removeReceiverConnection(token) {
    const connection = this.#openReceivingConnections.get(token);
    if (connection) {
      connection.close();
      this.#openReceivingConnections.delete(token);
    }
  }
}

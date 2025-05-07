const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
import { encryptDataWithPublicKey } from "./utils/DataManipulation";

// Outer classes imports
import { ConnectionManager } from "./ConnectionManager";

class gRPCSafeWrapper {
  // private data for this service
  #serviceCertificate;
  #publicKey;
  #privateKey;

  // connection with central system
  #proto;
  #centralSystemClient;
  #centralPublicKey;
  #centralSystemAddress = "localhost:50051";

  // Connection manager creates sender and receiver objects
  #connectionManager;

  constructor(
    serviceCertificate,
    publicKey,
    privateKey,
    listenerPort = "50052"
  ) {
    if (!serviceCertificate || !publicKey || !privateKey) {
      throw new Error(
        "You need to provide all nessesary data: serviceCertificate, publicKey, privateKey"
      );
    }

    // private data for service ------------------------------------------------
    this.#serviceCertificate = serviceCertificate;
    this.#publicKey = publicKey;
    this.#privateKey = privateKey;

    // connection with central system ------------------------------------------------
    const packageDefinition = protoLoader.loadSync("central.proto", {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    this.#proto = grpc.loadPackageDefinition(packageDefinition);

    this.#centralSystemClient = new this.#proto.CentralSystem(
      this.#centralSystemAddress,
      grpc.credentials.createInsecure()
    );

    // listener ------------------------------------------------
    this.#connectionManager = new ConnectionManager(
      listenerPort,
      this.#serviceCertificate
    );
  }

  // ====================================
  //           PRIVATE METHODS
  // ====================================
  /**
   * @description Requests Central System for it's public key
   */
  async #requestCentralPublicKey() {
    this.#centralPublicKey = await new Promise((resolve, reject) => {
      this.#centralSystemClient.getPublicKey({}, (err, response) => {
        if (err) reject("Error getting public key:", err);
        resolve(response.public_key);
      });
    })
      .then((data) => data)
      .catch((e) => console.log(e));
  }

  // ====================================
  //           PUBLIC METHODS
  // ====================================
  /**
   * @description Requests a new client-client connection to Central System
   */
  async requestConnection(requestType, address, TTL) {
    // 1. Asks Central system for it's public key
    if (!this.#centralPublicKey) {
      try {
        await this.#requestCentralPublicKey();
      } catch (e) {
        console.log(e);
      }
    }

    // 2. Encrypts it's certificatee
    let encryptedCertificate;
    try {
      encryptedCertificate = encryptDataWithPublicKey(
        this.#serviceCertificate,
        this.#centralPublicKey
      );
    } catch (e) {
      console.error("Encryption failed:", e);
      return;
    }

    // 3. Create connection request object
    const request = {
      encrypted_certificate: encryptedCertificate,
      request_type: requestType,
      TTL: TTL, // TTL -> mostly time in days/weeks like '1d'
      adress: address,
    };

    // 4. Send connection request to Central System and wait for Approval with token
    const newConnectionResponse = await new Promise((resolve, reject) => {
      this.#centralSystemClient.requestConnection(request, (err, response) => {
        if (err) {
          return reject("Connection request failed: " + err.message);
        }
        resolve(response);
      });
    })
      .then((data) => data)
      .catch((e) => console.log(e));

    // 5. Check connection status
    if (newConnectionResponse.approval_status === "APPROVED") {
      console.log("[response approval]", connectionApproval);

      // 6. Create new connection in connection manager
      if (!newConnectionResponse.encrypted_jwt_token) {
        console.log("Cannot receive security data from Central System");
        return null;
      }

      const conn = this.#connectionManager.createSender(
        connectionApproval.encrypted_jwt_token,
        address
      );

      // 7. returns Connection object for user to manage
      return conn;
    } else {
      console.log("[response approval error]", connectionApproval);
      return null;
    }
  }
}

/// USAGE
const wrapper = new gRPCSafeWrapper(
  "CERT1234",
  "PUBLIC_KEY1234",
  "PRIVATE_KEY1234",
  "1234"
);

const conn = wrapper.requestConnection("POST", "localhost:5053", "1d");

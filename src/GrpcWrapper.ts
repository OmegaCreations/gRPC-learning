const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
import {
  decryptDataWithPrivateKey,
  encryptDataWithPublicKey,
} from "./utils/DataManipulation";

// Outer classes imports
import { ConnectionManager } from "./ConnectionManager";
import {
  ConnectionRequest,
  ConnectionResponse,
  GrpcWrapperConfig,
} from "./wrapper";
import { Connection } from "./Connection";

export class gRPCSafeWrapper {
  // private data for this service
  #serviceCertificate: string;
  #publicKey: string;
  #privateKey: string;

  // connection with central system
  #proto;
  #centralSystemClient;
  #centralPublicKey: string;
  #centralSystemAddress: string = "localhost:50051";

  // Connection manager creates sender and receiver objects
  #connectionManager: ConnectionManager;

  constructor(GRPCWrapperConfig: GrpcWrapperConfig) {
    const { serviceCertificate, publicKey, privateKey, listenerPort } =
      GRPCWrapperConfig;
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
      listenerPort || 50052,
      this.#serviceCertificate
    );
  }

  // ====================================
  //           PRIVATE METHODS
  // ====================================
  /**
   * @description Requests Central System for it's public key
   */
  private async requestCentralPublicKey(): Promise<void> {
    this.#centralPublicKey = await new Promise<string>((resolve, reject) => {
      this.#centralSystemClient.getPublicKey({}, (err, response) => {
        if (err) {
          reject("Error getting public key: " + err);
        } else {
          resolve(response.publicKey as string);
        }
      });
    })
      .then((data) => data)
      .catch(() => "");
  }

  // ====================================
  //           PUBLIC METHODS
  // ====================================
  /**
   * @description Requests a new client-client connection to Central System
   */
  async requestConnection(
    requestType,
    address,
    TTL
  ): Promise<Connection | null> {
    // 1. Asks Central system for it's public key
    if (!this.#centralPublicKey) {
      try {
        await this.requestCentralPublicKey();
      } catch (e) {
        console.log(e);
      }
    }

    // 2. Encrypts it's certificate with Central System's public key
    let encryptedCertificate: string;
    try {
      encryptedCertificate = encryptDataWithPublicKey(
        this.#serviceCertificate,
        this.#centralPublicKey
      );
    } catch (e) {
      console.error("Encryption failed:", e);
      return null;
    }

    // 3. Create connection request object
    const request: ConnectionRequest = {
      encryptedCertificate: encryptedCertificate,
      requestType: requestType,
      TTL: TTL, // TTL -> mostly time in days/weeks like '1d'
      address: address,
    };

    // 4. Send connection request to Central System and wait for Approval with token
    const newConnectionResponse = await new Promise<ConnectionResponse>(
      (resolve, reject) => {
        this.#centralSystemClient.requestConnection(
          request,
          (err, response) => {
            if (err) {
              return reject("Connection request failed: " + err.message);
            }
            resolve(response);
          }
        );
      }
    )
      .then((data) => data)
      .catch((e) => console.log(e));

    if (!newConnectionResponse) {
      console.log("No response from Central System for new connection");
      return null;
    }

    // 5. Check connection status
    if (newConnectionResponse.approvalStatus === "APPROVED") {
      console.log("[response approval]", newConnectionResponse);

      // 5.5 Decrypt JWT token with private key
      const decryptedJwt = decryptDataWithPrivateKey(
        newConnectionResponse.encryptedJwtToken,
        this.#privateKey
      );

      if (!decryptedJwt) {
        console.log("Decryption of JWT token failed");
        return null;
      }

      // 6. Create new connection in connection manager
      if (!newConnectionResponse.encryptedJwtToken) {
        console.log("Cannot receive security data from Central System");
        return null;
      }

      const conn: Connection = this.#connectionManager.createSenderConnection(
        address,
        decryptedJwt,
        requestType,
        TTL
      );

      // 7. returns Connection object for user to manage
      return conn;
    } else {
      console.log("[response approval error]", newConnectionResponse);
      return null;
    }
  }

  public getMiddleware() {
    return this.#connectionManager.getMiddleware();
  }
}

import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import {
  encryptHybrid,
  decryptHybrid,
  decryptDataWithPrivateKey,
} from "./utils/DataManipulation";

import { ConnectionManager } from "./ConnectionManager";
import {
  ConnectionRequest,
  ConnectionResponse,
  GrpcWrapperConfig,
  RequestType,
} from "./wrapper";
import { Connection } from "./Connection";

export class gRPCSafeWrapper {
  private serviceCertificate: string;
  private privateKey: string;

  private proto;
  private centralSystemClient;
  private centralPublicKey: string = "";
  private centralSystemAddress: string = "0.0.0.0:50051";

  private connectionManager: ConnectionManager;

  constructor(GRPCWrapperConfig: GrpcWrapperConfig) {
    const { serviceCertificate, privateKey, listenerPort } = GRPCWrapperConfig;
    if (!serviceCertificate || !privateKey) {
      throw new Error("Missing required config");
    }

    this.serviceCertificate = serviceCertificate;
    this.privateKey = privateKey;

    const packageDefinition = protoLoader.loadSync("./central.proto", {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    this.proto = grpc.loadPackageDefinition(packageDefinition);
    this.centralSystemClient = new this.proto.CentralSystem(
      this.centralSystemAddress,
      grpc.credentials.createInsecure()
    );

    this.connectionManager = new ConnectionManager(
      listenerPort || 50052,
      this.serviceCertificate,
      this.privateKey
    );
  }

  private async requestCentralPublicKey(): Promise<void> {
    this.centralPublicKey = await new Promise<string>((resolve, reject) => {
      this.centralSystemClient.getPublicKey({}, (err: any, response: any) => {
        if (err) {
          reject("Error getting public key: " + err);
        } else {
          resolve(response.publicKey as string);
        }
      });
    }).catch(() => "");
  }

  async requestConnection(
    requestType: RequestType | string,
    address: string,
    TTL: string
  ): Promise<Connection | null> {
    if (!this.centralPublicKey) {
      try {
        await this.requestCentralPublicKey();
        console.log("Central public key obtained");
      } catch (e) {
        console.log("Failed to get central public key:", e);
        return null;
      }
    }

    // Encrypt cert using hybrid encryption
    let hybridPayload;
    try {
      hybridPayload = encryptHybrid(
        this.serviceCertificate,
        this.centralPublicKey
      );
    } catch (e) {
      console.error("Hybrid encryption failed:", e);
      return null;
    }

    const request: ConnectionRequest = {
      encryptedCertificate: hybridPayload.encryptedData,
      encryptedAesKey: hybridPayload.encryptedKey,
      iv: hybridPayload.iv,
      requestType,
      TTL,
      address,
    };

    const newConnectionResponse = await new Promise<ConnectionResponse>(
      (resolve, reject) => {
        this.centralSystemClient.requestConnection(
          request,
          (err: any, response: any) => {
            if (err) {
              return reject("Connection request failed: " + err.message);
            }
            resolve(response);
          }
        );
      }
    ).catch((e) => {
      console.log(e);
      return null;
    });

    if (
      !newConnectionResponse ||
      newConnectionResponse.approvalStatus !== "APPROVED" ||
      !newConnectionResponse.encryptedJwtToken ||
      !newConnectionResponse.encryptedAesKey ||
      !newConnectionResponse.iv
    ) {
      console.log(
        "Connection not approved or incomplete response:",
        newConnectionResponse
      );
      return null;
    }
    console.log("Connection approved:", newConnectionResponse);
    const decryptedJwt = decryptHybrid(
      newConnectionResponse.encryptedJwtToken,
      newConnectionResponse.encryptedAesKey,
      newConnectionResponse.iv,
      this.privateKey
    );

    if (!decryptedJwt) {
      console.log("Failed to decrypt JWT token");
      return null;
    }

    const conn: Connection = this.connectionManager.createSenderConnection(
      address,
      decryptedJwt,
      requestType,
      TTL
    );

    return conn;
  }

  public getMiddleware() {
    return this.connectionManager.getMiddleware();
  }
}

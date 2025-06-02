export interface ConnectionRequest {
  encryptedCertificate: string; // Encrypted client certificate using the central's public key
  encryptedAesKey: string; // Encrypted AES key for symmetric encryption
  iv: string; // Initialization vector for AES encryption
  requestType: RequestType | string; // Type of request (POST, GET, etc.)
  TTL: string; // Time to live for the connection (e.g., '1d' for one day)
  address: string; // Address of the target client (e.g., 'localhost:50053')
}

export interface GrpcWrapperConfig {
  serviceCertificate: string;
  privateKey: string;
  listenerPort?: number;
}

export enum RequestType {
  POST = "POST",
  GET = "GET",
  PUT = "PUT",
  DELETE = "DELETE",
}

export interface NewConnectionData {
  clientCertificate: string; // PEM formatted certificate of the client trying to connect
  requestType: RequestType;
  TTL: string; // e.g. '1d'
  sourceAddress: string; // e.g. 'localhost:50053'
}

type EmptyMessage = {};

type PublicKey = {
  publicKey: string;
};

type ConnectionApproval = {
  approvalStatus: "APPROVED" | "CERTIFICATE_INVALID" | "CLIENT_NOT_AVAIBLE";
  encryptedJwtToken?: string;
  encryptedAesKey?: string;
  iv?: string;
};
export interface ConnectionResponse extends ConnectionApproval {}

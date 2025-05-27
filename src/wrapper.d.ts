export interface ConnectionRequest {
  encryptedCertificate: string;
  requestType: RequestType | string;
  TTL: string;
  address: string;
}

export interface ConnectionResponse {
  approvalStatus: "APPROVED" | "CERTIFICATE_INVALID" | "CLIENT_NOT_AVAIBLE";
  encryptedJwtToken?: string;
}

export interface GrpcWrapperConfig {
  serviceCertificate: string;
  publicKey: string;
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

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import fs from "fs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const PROTO_PATH = "./central.proto";

// Konfiguracja
const CENTRAL_CERT = fs.readFileSync("./certs/central.crt");
const CENTRAL_KEY = fs.readFileSync("./certs/central_private.key");
const JWT_SECRET = "your-256-bit-secret";
const ALLOWED_CERTIFICATES: string[] = [
  fs.readFileSync("./certs/clientSender.crt", "utf8"),
  fs.readFileSync("./certs/clientReceiver.crt", "utf8"),
];

// Ładowanie protobuf
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const proto = grpc.loadPackageDefinition(packageDefinition);

class CentralSystemImpl {
  private activeClients = new Map<string, string>();

  async getPublicKey(
    _: grpc.ServerUnaryCall<EmptyMessage, PublicKey>,
    callback: grpc.sendUnaryData<PublicKey>
  ) {
    callback(null, { publicKey: CENTRAL_CERT.toString() });
  }

  async requestConnection(
    call: grpc.ServerUnaryCall<ConnectionRequest, ConnectionApproval>,
    callback: grpc.sendUnaryData<ConnectionApproval>
  ) {
    try {
      // 1. Deszyfruj certyfikat klienta
      const decryptedCert = this.decryptCertificate(
        call.request.encryptedCertificate
      );

      // 2. Walidacja certyfikatu
      if (!this.validateCertificate(decryptedCert)) {
        return callback(null, { approvalStatus: "CERTIFICATE_INVALID" });
      }

      // 3. Sprawdź dostępność docelowego klienta (uproszczone)
      const isAvailable = ALLOWED_CERTIFICATES.some((cert) =>
        cert.includes(call.request.address)
      );

      if (!isAvailable) {
        return callback(null, { approvalStatus: "CLIENT_NOT_AVAIBLE" });
      }

      // 4. Generuj i szyfruj JWT
      const token = jwt.sign(
        {
          iss: "central",
          sub: decryptedCert,
          aud: call.request.address,
          exp: Math.floor(Date.now() / 1000) + 86400,
        },
        JWT_SECRET
      );

      const encryptedToken = crypto
        .publicEncrypt(
          {
            key: this.getClientPublicKey(decryptedCert),
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          },
          Buffer.from(token)
        )
        .toString("base64");

      callback(null, {
        approvalStatus: "APPROVED",
        encryptedJwtToken: encryptedToken,
      });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: "Internal server error",
      });
    }
  }

  private validateCertificate(cert: string): boolean {
    return ALLOWED_CERTIFICATES.includes(cert.trim());
  }
}

// Uruchomienie serwera
const server = new grpc.Server();
const centralSystemImpl = new CentralSystemImpl();
server.addService((proto as any).CentralSystem.service, {
  getPublicKey: centralSystemImpl.getPublicKey.bind(centralSystemImpl),
  requestConnection:
    centralSystemImpl.requestConnection.bind(centralSystemImpl),
});

server.bindAsync(
  "0.0.0.0:50051",
  grpc.ServerCredentials.createSsl(
    null,
    [{ cert_chain: CENTRAL_CERT, private_key: CENTRAL_KEY }],
    true
  ),
  () => {
    server.start();
    console.log("Central system running on port 50051");
  }
);

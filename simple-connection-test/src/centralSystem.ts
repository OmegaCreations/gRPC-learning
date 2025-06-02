import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import fs from "fs";
import jwt from "jsonwebtoken";
import path from "path";
import {
  ConnectionApproval,
  ConnectionRequest,
  EmptyMessage,
  PublicKey,
} from "../../src/wrapper";
import { decryptHybrid, encryptHybrid } from "../../src/utils/DataManipulation";
import { X509Certificate } from "crypto";
import e from "cors";

const CENTRAL_CERT = fs.readFileSync("./certs/centralPublic.key", "utf8");
const CENTRAL_KEY = fs.readFileSync("./certs/centralPrivate.key", "utf8");

const ALLOWED_CERTIFICATES: string[] = [
  fs.readFileSync("./certs/clientSender.crt", "utf8"),
  fs.readFileSync(path.resolve("./certs/clientReceiver.crt"), "utf8"),
];

const JWT_SECRET = ALLOWED_CERTIFICATES[1];

const PRIVATE_KEYS: string[] = [
  fs.readFileSync("./certs/clientSender_private.key", "utf8"),
  fs.readFileSync("./certs/clientReceiver_private.key", "utf8"),
];

const packageDefinition = protoLoader.loadSync("./central.proto", {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto: any = grpc.loadPackageDefinition(packageDefinition);

class CentralSystemImpl {
  async getPublicKey(
    _: grpc.ServerUnaryCall<EmptyMessage, PublicKey>,
    callback: grpc.sendUnaryData<PublicKey>
  ) {
    console.log("getPublicKey called");
    return callback(null, { publicKey: CENTRAL_CERT });
  }

  async requestConnection(
    call: grpc.ServerUnaryCall<ConnectionRequest, ConnectionApproval>,
    callback: grpc.sendUnaryData<ConnectionApproval>
  ) {
    try {
      // 1. Odszyfrowanie certyfikatu klienta
      const decryptedCert = decryptHybrid(
        call.request.encryptedCertificate,
        call.request.encryptedAesKey,
        call.request.iv,
        CENTRAL_KEY
      );

      console.log("Decrypted certificate:", decryptedCert);

      // 2. Walidacja certyfikatu klienta
      if (!this.validateCertificate(decryptedCert)) {
        return callback(null, {
          approvalStatus: "CERTIFICATE_INVALID",
        });
      }

      // 3. Szukamy odbiorcy
      // TODO ...

      // 4. Generujemy JWT
      const tokenPayload = {
        iss: "central",
        sub: decryptedCert,
        aud: call.request.address,
        exp:
          Math.floor(Date.now() / 1000) + parseInt(call.request.TTL || "86400"),
        type: call.request.requestType,
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET);

      // 5. Szyfrowanie hybrydowe tokena
      const clientCert = new X509Certificate(decryptedCert);
      const clientPublicKey = clientCert.publicKey.export({
        type: "spki",
        format: "pem",
      });
      console.log("Client public key:", clientPublicKey);
      const { encryptedData, encryptedKey, iv } = encryptHybrid(
        token,
        clientPublicKey.toString() // we use the first for sender
      );

      const jwtToken = decryptHybrid(
        encryptedData,
        encryptedKey,
        iv,
        PRIVATE_KEYS[1]
      );
      console.log("Decrypted JWT token:", jwtToken);

      // 6. Tworzymy ConnectionApproval
      const approvalMessage: ConnectionApproval = {
        approvalStatus: "APPROVED",
        encryptedJwtToken: encryptedData,
        encryptedAesKey: encryptedKey,
        iv: iv,
      };

      // 7. RPC do klienta-odbiorcy
      console.log(
        "port",
        call.request.address.split(":")[0] +
          ":" +
          (parseInt(call.request.address.split(":")[1]) + 1)
      );
      const client = new (proto as any).ClientService(
        call.request.address.split(":")[0] +
          ":" +
          (parseInt(call.request.address.split(":")[1]) + 1),
        grpc.credentials.createInsecure()
      );

      client.sendConnectionData(
        approvalMessage,
        (err: grpc.ServiceError | null, _res: EmptyMessage) => {
          if (err) {
            console.error("Błąd przy kontakcie z clientReceiver:", err.message);
            // Mimo błędu wysyłamy token do clientSender
          }

          return callback(null, approvalMessage);
        }
      );
    } catch (error) {
      console.error("Błąd w requestConnection:", error);
      return callback(
        {
          code: grpc.status.INTERNAL,
          message: "Internal server error",
        },
        null
      );
    }
  }

  private validateCertificate(cert: string): boolean {
    return ALLOWED_CERTIFICATES.some(
      (allowed) => allowed.trim() === cert.trim()
    );
  }
}

function main() {
  const server = new grpc.Server();
  const centralSystemImpl = new CentralSystemImpl();

  server.addService((proto as any).CentralSystem.service, {
    getPublicKey: centralSystemImpl.getPublicKey.bind(centralSystemImpl),
    requestConnection:
      centralSystemImpl.requestConnection.bind(centralSystemImpl),
  });

  const creds = grpc.ServerCredentials.createInsecure();
  const address = "0.0.0.0:50051";

  server.bindAsync(address, creds, (err, port) => {
    if (err) {
      console.error("Błąd podczas bindowania serwera:", err);
      return;
    }
    console.log(`Central system running (insecure) on port ${port}`);
    server.start();
  });
}

main();

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
import crypto from "crypto";

const CENTRAL_CERT = fs.readFileSync("./certs/centralPublic.key", "utf8");
const CENTRAL_KEY = fs.readFileSync("./certs/centralPrivate.key", "utf8");

const ALLOWED_CERTIFICATES: string[] = [
  fs.readFileSync("./certs/clientSender.crt", "utf8"),
  fs.readFileSync("./certs/clientReceiver.crt", "utf8"),
];

const PRIVATE_KEYS: string[] = [
  fs.readFileSync("./certs/clientSender_private.key", "utf8"),
  `-----BEGIN PRIVATE KEY-----
MIIEwQIBADANBgkqhkiG9w0BAQEFAASCBKswggSnAgEAAoIBAgDG0UKSiGIr28L+
hHdvsT5J4epuu0FqPenCaxnee7xuv6HI5gHEmtvlrkjb7MwlXDt7CN9K47svDLDU
vgNLv7FzgHSx+4HleizgCQ98xvCGFt8n8NrUbM3uWeVwXoWU+4Mg6sHHmijJgOj+
qoB9YiikFvbHDVoh+7et6TaVDNWesAzQu2OM3iAbwn9wkLyZXlLcCM86d3sF/7L/
CrsTPIReHH3RncC4J4yVfRap1kSZZYP5Bou2eiTOloPPeRJ/M6kCyYhJ5entYnyB
lFtp6zLmZlGrswihY9S7HL26cstH6UowadqRdf25Rhd++LM1XQZQ5ECZjlQZpOnM
64h0KNowYwIDAQABAoIBATkGGg8HOQkVThdMDSmm75OnTWMXKEr9mQdfSpsqaEBn
jFKfzdADDqEQ3OrfPypUCudeAxVqvexfunQ6T52xTIcxR8couPgFk8tqLdv+/0um
UbkV9t3Im0QK2qjhI3U4skKFsrC6QYqSA8HPS20q8zclMwCijsCCfwtNgY88kCSk
l9yFyEy6e4pacYL4XHxjVroOxbH/2dBgQNDY5VwEoZw/2Z/xLGfLCOSM1QPG/abl
okQx0WpnhRWoR5kG4FVfPXdrLYeqOd1YP1drjiHm3cO3FdwjU+1LZ79BNkirUtfW
NCj9+zDpphMkF4vlnp7OgYLz/+Y7UpFxMuHKmdL+IMq5AoGBDyMj8bwFL5xG1sN7
XAjgibJi5c48of2jgLtqAYohlq8kzK+QfN1CSGhDUXu7qR0HqrrYsF7rnPmJzkFx
qVonaZcAz0TdqdZabNNuxsqpgDufyiUqP3I7eX0PtfwB8G3usYD95DmLq+ozEXSB
CVsh7HSMGMY3yS61xRPBIx2UwHHFAoGBDSJhitBOPOdl0MdsvPXgAX/5LtRM4dPb
c5SZDehbo2fv6sWz6xzjYKV8pXrclGfFPkk5IAw+VYi8gJXocwrgp6dDkY2pzsHC
m43NeHAQ7p/eWutsOb0GNmg3a2IwlDTfbRnlCM//eGiWbQQJcy3g1CNHn7ZQAhbA
EjOKhn4rkAQHAoGBDcb9Eyr/SVsiupwHbjgCLjG3g9QXKZVSOHvbuvT/J0fX5Zix
mIRFrOOAyewlXIG4lbMkQDrUlfYlcB3ulqYgkyFGMmBKpCcd/EjgXXzdk4IxKGp1
LnQJH8UtBIUPOsbD5rkx3IRn1Jv/yRZRz7MriCx3yqC265xhArO9KPnmhtXFAoGB
A8FAgZ7rvx2oTfe1bpAcalFbu7eWAzm+E1z4JLG5AQ5F2KiMtzqbBpZI/EYTqZnB
Gf11B2R4rZtZyKkSu1DwyP1Yo9QMJ7/dEvuHMldXf+DUgMmtNxSDIirJLTn1CWnU
Niyg/dP5BUNhPelZikQjcoJjh5VnajF2171EbQ7FBXchAoGBDhEmIpZUMbvzaOJ+
FkDfNd2wBWTPKOxbX74t7VXZMO//1eOpqHdsSJaqjMAYh5QQvZZdxyKrQeN2tMtc
E2+bIZhXiQ3KNxOI6xwp/VyDDTyCb1Z+Lo2MDuyUAonnyAuBmBQuQNgwttA+Jnh4
3XT87HKMhvNlYHg4vMc8mp0oY4v5
-----END PRIVATE KEY-----`,
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

      // 2. Walidacja certyfikatu klienta
      if (!this.validateCertificate(decryptedCert)) {
        return callback(null, {
          approvalStatus: "CERTIFICATE_INVALID",
        });
      }

      console.log("Certificate is valid");

      // 3. Szukamy odbiorcy
      // TODO ...

      // 4. Generujemy JWT
      const peer = call.getPeer();
      console.log("Peer info:", peer);

      const tokenPayload = {
        clientCertificate: decryptedCert,
        requestType: call.request.requestType,
        TTL: call.request.TTL,
        sourceAddress: peer,
      };

      console.log("Token payload:", tokenPayload);

      const token = jwt.sign(tokenPayload, ALLOWED_CERTIFICATES[1], {
        algorithm: "HS256",
      });

      // hybrid encryption of the JWT token
      const senderPublicKey = crypto
        .createPublicKey(ALLOWED_CERTIFICATES[0])
        .export({ type: "spki", format: "pem" });

      const receiverPublicKey = crypto
        .createPublicKey(ALLOWED_CERTIFICATES[1])
        .export({ type: "spki", format: "pem" });

      // Encrypt the JWT token using hybrid encryption (AES for token, RSA for AES key)
      const {
        encryptedData: encryptedDataForSender,
        encryptedKey,
        iv,
      } = encryptHybrid(token, senderPublicKey.toString());

      const {
        encryptedData: encryptedDataForReceiver,
        encryptedKey: encryptedKeyForReceiver,
        iv: ivForReceiver,
      } = encryptHybrid(token, receiverPublicKey.toString());

      // Decrypt for debug
      // const jwtToken = decryptHybrid(
      //   encryptedData,
      //   encryptedKey,
      //   iv,
      //   PRIVATE_KEYS[1]
      // );
      // console.log("Decrypted JWT token:", jwtToken.toString());

      // 6. Tworzymy ConnectionApproval
      const approvalMessageForSender: ConnectionApproval = {
        approvalStatus: "APPROVED",
        encryptedJwtToken: encryptedDataForSender,
        encryptedAesKey: encryptedKey,
        iv: iv,
      };

      const approvalMessageForReceiver: ConnectionApproval = {
        approvalStatus: "APPROVED",
        encryptedJwtToken: encryptedDataForReceiver,
        encryptedAesKey: encryptedKeyForReceiver,
        iv: ivForReceiver,
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
        approvalMessageForReceiver,
        (err: grpc.ServiceError | null, _res: EmptyMessage) => {
          if (err) {
            console.error("Błąd przy kontakcie z clientReceiver:", err.message);
            // Mimo błędu wysyłamy token do clientSender
          }

          return callback(null, approvalMessageForSender);
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

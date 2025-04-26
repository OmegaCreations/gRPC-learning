const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const crypto = require("crypto");

// security
const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQCqgspc+Io2Q3Mnzj5/l6PQDsoHB/q90FRa1PGMmEFgY2eUiPD8
KmrTusxsyDZ+HM8RnGRoD/EGPQCT2pBfS/R4vUH1p9iHlbju4bcSKjaKxa6DHAAE
qi4AdnTzL7dB8jufb42cynzw78eU38jY8pB7biQ77K4w7oscYW/C/89TSQIDAQAB
AoGABOAsjTAGM7sGBfNd0iQx6PcjS8QspVTZtKc2KQEJjYoKIjMwQOWtnFRRGCM5
e62zNhu0u00JZVZFN/Ud/7uaR/WG6XzE5oHKD8ZnoEjM7Fin15332ewfjLUs8g6S
sLPo4Zuxsgp9bmUw7KQwwJHhV5tWWIoY20uClPECMXFbVAECQQDsnkjmtCKsfhTR
wBSHWCYOcUZIxkz9x+33uX7aXE+519EQDg9Y4kDy+bRpOzLdkvGmD7mBqxJji3o1
93WnunNBAkEAuHpH+45/3Wdx55x2nGt80OU52H03RGB+loyRFiQhIX8xeHSpA0xt
gwtfWsS72kMBFSHp5631yMLrLGhk5t3GCQJBAIsi1ElcuVrm1MU2BpxDeDVb5HFc
sd81FjhqCi7Kw1LLljKzodCpUnnN3YlXdySViKUWcAXQm4KPfLCJL9UOLUECQQCu
5hAU6XdEu+x8ABVcG3RMwObk32Jki2+44DA1468diO+oGkKbA/zXvxJ6hgbr2ZbP
KEYRBxb9bf91LMxtLVmxAkAXDHuAaPCrm5HzpLZRW66cP7vaJlV66BrvLlPXfegZ
/HwAFpv+tjsNUUcU6qNdF1Lv0bDZpgKFKSdMH0Vd0R8/
-----END RSA PRIVATE KEY-----`;
const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCqgspc+Io2Q3Mnzj5/l6PQDsoH
B/q90FRa1PGMmEFgY2eUiPD8KmrTusxsyDZ+HM8RnGRoD/EGPQCT2pBfS/R4vUH1
p9iHlbju4bcSKjaKxa6DHAAEqi4AdnTzL7dB8jufb42cynzw78eU38jY8pB7biQ7
7K4w7oscYW/C/89TSQIDAQAB
-----END PUBLIC KEY-----`;

// Wczytanie .proto
const packageDefinition = protoLoader.loadSync("central.proto", {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition);

// Serwerowa implementacja CentralSystem
const centralSystemImpl = {
  getPublicKey: (call, callback) => {
    callback(null, { public_key: publicKey });
  },

  requestConnection: (call, callback) => {
    const request = call.request;

    try {
      const encryptedBuffer = Buffer.from(
        request.encrypted_certificate,
        "base64"
      );
      const decryptedCertificate = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        encryptedBuffer
      );

      console.log(
        "Odszyfrowany certyfikat:",
        decryptedCertificate.toString("utf8")
      );
    } catch (err) {
      console.error("Blad przy odszyfrowywaniu certyfikatu:", err.message);
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Decryption failed",
      });
    }

    console.log("Polaczenie odebrane od klienta:", request);

    callback(null, { approval: "APPROVED" });
  },
};

function main() {
  const server = new grpc.Server();
  server.addService(proto.CentralSystem.service, centralSystemImpl);
  server.bindAsync(
    "localhost:50051",
    grpc.ServerCredentials.createInsecure(),
    () => {
      console.log("CentralSystem server running on port 50051");
    }
  );
}

main();

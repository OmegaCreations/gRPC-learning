class CentralSystem {
  constructor() {}
  getPublicKey(call, callback) {
    callback(null, { public_key: publicKey });
  }
  requestConnection(call, callback) {
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
  }
  requestStatus(call, callback) {
    const request = call.request;
    console.log("Zgloszenie statusu:", request);
    callback(null, { status: "OK" });
  }
}

export default CentralSystem;

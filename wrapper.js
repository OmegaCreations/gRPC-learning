const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const crypto = require("crypto");

// Outer classes imports
import { Listener } from "./Listener";

class gRPCSafeWrapper {
  // private data for service
  #serviceCertificate;
  #publicKey;
  #privateKey;

  // connection with central system
  #proto;
  #centralSystemClient;
  #centralPublicKey;
  #centralSystemAddress = "localhost:50051";

  // listener for connections
  #globalListener;

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
    this.#globalListener = new Listener(listenerPort);
  }

  // private methods
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

  #encryptDataWithPublicKey(data, publicKeyPem) {
    console.log(data, publicKeyPem);
    const bufferData = Buffer.from(data, "utf8");
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      bufferData
    );
    return encrypted.toString("base64");
  }

  // public methods
  async requestConnection(requestType, address, TTL) {
    try {
      await this.#requestCentralPublicKey();
    } catch (e) {
      console.log(e);
    }

    let encryptedCertificate;
    try {
      encryptedCertificate = this.#encryptDataWithPublicKey(
        this.#serviceCertificate,
        this.#centralPublicKey
      );
    } catch (e) {
      console.error("Encryption failed:", e);
      return;
    }

    const request = {
      encrypted_certificate: encryptedCertificate,
      public_key: this.#publicKey,
      request_type: requestType,
      adress: address,
      TTL: TTL,
    };

    const connectionApproval = await new Promise((resolve, reject) => {
      this.#centralSystemClient.requestConnection(request, (err, response) => {
        if (err) {
          return reject("Connection request failed: " + err.message);
        }
        resolve(response);
      });
    })
      .then((data) => data)
      .catch((e) => console.log(e));

    if (connectionApproval.approval_status === "APPROVED") {
      console.log("[response approval]", connectionApproval);

      // create new connection
      const conn = this.#globalListener.create(
        connectionApproval.encrypted_certificate,
        connectionApproval.encrypted_session_token,
        address
      );

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

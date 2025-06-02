import { gRPCSafeWrapper } from "../../src/GrpcWrapper";
import fs from "fs";

const main = async () => {
  // create instance of the gRPC wrapper
  /**
 * serviceCertificate,
    publicKey,
    privateKey,
    listenerPort = 50052
 */
  const grpcWrapper = new gRPCSafeWrapper({
    serviceCertificate: fs.readFileSync(`./certs/clientSender.crt`, "utf8"),
    privateKey: fs.readFileSync(`./certs/clientSender_private.key`, "utf8"),
    listenerPort: 40051,
  });

  // setup new sending connection - returns a Connection object
  const connection = await grpcWrapper.requestConnection(
    "POST",
    "localhost:50052",
    "1d"
  );

  if (!connection) {
    console.error("Failed to establish connection");
    process.exit(1);
  }

  // send a request to the receiver - works like a REST API call via axios
  // but uses the gRPC connection to forward the request on predefined address
  const res = await connection
    .send("/api/hello", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Hello from the sender",
      }),
    })
    .then((response) => {
      if (!response) {
        throw new Error(`Error sending to /api/hello`);
      }
    })
    .then((data) => {
      console.log("Data sent successfully:", data);
    })
    .catch((error) => {
      console.error("Error in sending data:", error);
    });

  console.log(res);
};

main();

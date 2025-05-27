import { gRPCSafeWrapper } from "./GrpcWrapper";

const express = require("express");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON requests
app.use(express.json());

// create instance of the gRPC wrapper
/**
 * serviceCertificate,
    publicKey,
    privateKey,
    listenerPort = 50052
 */
const grpcWrapper = new gRPCSafeWrapper({
  serviceCertificate: "path/to/certificate.pem",
  publicKey: "path/to/publicKey.pem",
  privateKey: "path/to/privateKey.pem",
  listenerPort: 50052,
});

// get gRPC listener as middleware
const grpcMiddleware = grpcWrapper.getMiddleware();

// Set up a middleware for secured endpoints
// it will listen for incoming REST API requests and forward them to the gRPC service
// it checks if connection is established on gRPC's end (in ConnectionManager) and then forwards the request to the endpoint
app.post("/api/hello", grpcMiddleware, (req, res) => {
  // Respond to the client
  res.status(200).json({ message: "Hello" });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});

// setup new sending connection - returns a Connection object
const connection = await grpcWrapper.requestConnection(
  "POST",
  "localhost:50053",
  "1d"
);

if (!connection) {
  console.error("Failed to establish connection");
  process.exit(1);
}

// send a request to the receiver - works like a REST API call via axios
// but uses the gRPC connection to forward the request on predefined address
const res = connection
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

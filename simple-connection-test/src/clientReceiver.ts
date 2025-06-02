import { gRPCSafeWrapper } from "../../src/GrpcWrapper";
import cors from "cors";

import express from "express";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 50053;

const main = async () => {
  // Middleware to parse JSON requests
  app.use(express.json());
  app.use(cors());

  // create instance of the gRPC wrapper
  /**
 * serviceCertificate,
    publicKey,
    privateKey,
    listenerPort = 50052
 */
  const grpcWrapper = new gRPCSafeWrapper({
    serviceCertificate: fs.readFileSync(`./certs/clientReceiver.crt`, "utf8"),
    privateKey: fs.readFileSync(`./certs/clientReceiver_private.key`, "utf8"),
    listenerPort: 50052,
  });

  // get gRPC listener as middleware
  const grpcMiddleware = grpcWrapper.getMiddleware();

  // Set up a middleware for secured endpoints
  // it will listen for incoming REST API requests and forward them to the gRPC service
  // it checks if connection is established on gRPC's end (in ConnectionManager) and then forwards the request to the endpoint
  app.post("/api/hello", grpcMiddleware as any, (req: any, res: any) => {
    // Respond to the client
    console.log("Received request:", req.body);
    res.status(200).json({ message: "Hello" });
  });

  // Start the Express server
  app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
  });
};

main();

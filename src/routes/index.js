import express from "express";

const router = express.Router();

/**
 * @description Some route
 */
router.post("/receive-payload", (req, res) => {
  const payload = req.body;

  // Process the payload as needed
  console.log("Received payload:", payload);

  // Respond to the client
  res.status(200).json({ message: "Payload received successfully" });
});

export default router;

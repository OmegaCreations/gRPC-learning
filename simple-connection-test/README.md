# Simple Connection Test

This project demonstrates a simple connection between a sender client and a receiver client through a central system. It utilizes secure communication with certificates for authentication.

## Project Structure

```
simple-connection-test
├── src
│   ├── centralSystem.ts       # Central system managing connections
│   ├── clientSender.ts        # Sender client implementation
│   ├── clientReceiver.ts      # Receiver client implementation
├── certs
│   ├── ca.crt                 # Certificate Authority certificate
│   ├── client.crt             # Client certificate
│   ├── client.key             # Client private key
│   ├── server.crt             # Server certificate
│   └── server.key             # Server private key
├── package.json                # NPM configuration file
└── README.md                   # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd simple-connection-test
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Certificates:**
   Ensure that the certificates in the `certs` directory are correctly configured for your environment. You may need to generate your own certificates or use the provided ones.

## Usage

1. **Start the Central System:**
   Run the central system to manage connections.
   ```
   node src/centralSystem.js
   ```

2. **Start the Sender Client:**
   In a new terminal, run the sender client to send messages.
   ```
   node src/clientSender.js
   ```

3. **Start the Receiver Client:**
   In another terminal, run the receiver client to listen for messages.
   ```
   node src/clientReceiver.js
   ```

## Example

- The sender client can send a message to the central system, which will then relay it to the receiver client.
- Ensure that all clients are running simultaneously to test the communication.

## License

This project is licensed under the MIT License.
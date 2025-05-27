# gRPC Express App

This project integrates gRPC with an Express server, allowing for seamless handling of both gRPC and HTTP requests. The application is designed to manage connections and process secured payloads efficiently.

## Installation

1. Clone the repository:

   ```
   git clone <repository-url>
   cd grpc-express-app
   ```

2. Install the dependencies:
   ```
   npm install
   ```

## Usage

1. Start the server:

   ```
   node src/server.js
   ```

2. The server will listen for incoming gRPC requests and HTTP requests on the specified port.

## gRPC Endpoints

- `sendConnectionData`: Handles new receiver connections from central system.
- `sendPayload`: Receives payloads from clients and forwards them to specified endpoints based on the deserialized JSON payload.

## HTTP Endpoints

Define your HTTP endpoints in `src/routes/index.js`. The Express server will handle these requests alongside gRPC.

## License

This project is licensed under the MIT License.

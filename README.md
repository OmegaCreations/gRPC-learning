# gRPC Express App

This project integrates gRPC with an Express server, allowing for seamless handling of both gRPC and HTTP requests. The application is designed to manage connections and process secured payloads efficiently.

## Project Structure

```
grpc-express-app
├── src
│   ├── ConnectionManager.js       # Manages gRPC connections and payload processing
│   ├── Connection.js               # Represents individual connection instances
│   ├── utils
│   │   └── DataManipulation.js     # Utility functions for data manipulation
│   ├── server.js                   # Entry point for the Express server
│   └── routes
│       └── index.js                # Defines route handlers for the Express application
├── central.proto                   # Defines gRPC service and message types
├── package.json                    # npm configuration file
└── README.md                       # Project documentation
```

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

- `sendConnectionData`: Handles new receiver connections.
- `sendPayload`: Receives payloads from clients and forwards them to specified endpoints based on the deserialized JSON payload.

## HTTP Endpoints

Define your HTTP endpoints in `src/routes/index.js`. The Express server will handle these requests alongside gRPC.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License.

import { ClientToClientConnection } from "./ClientToClient";

export class Listener {
  #openConnections = new Map();
  #port;

  constructor(listenerPort = "50052") {
    this.#port = listenerPort;
  }

  create(certificate, session_token, target_address) {
    const newClient = new ClientToClientConnection(
      certificate,
      session_token,
      target_address
    );

    this.#openConnections.set(session_token, newClient);

    return newClient;
  }
}

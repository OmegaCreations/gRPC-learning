export class Listener {
  #openConnections = new Map();
  #port;

  constructor(listenerPort = "50052") {
    this.#port = listenerPort;
  }

  create(newClient) {
    this.#openConnections.set(newClient.getTargetAddress(), newClient);
    newClient.initCommunication();
  }
}

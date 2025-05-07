import crypto from "crypto";

/**
 * @description Encrypts data with given public key
 */
export const encryptDataWithPublicKey = (data, publicKeyPem) => {
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
};

/**
 * @description Decrypts data with given private key
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} privateKeyPem - PEM formatted private key
 * @returns {string} Decrypted data in UTF-8 format
 */
export const decryptDataWithPrivateKey = (encryptedData, privateKeyPem) => {
  try {
    const bufferData = Buffer.from(encryptedData, "base64");

    const decrypted = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      bufferData
    );

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data");
  }
};

/**
 * @description Serializes Json formatted request into binary payload
 */
export const serializeRequest = (contentType, jsonData) => {
  // 1. Zakoduj typ zawartości jako tekst
  const encoder = new TextEncoder();
  const contentTypeBytes = encoder.encode(contentType);

  // 2. Zakoduj dane JSON
  const jsonString = JSON.stringify(jsonData);
  const jsonBytes = encoder.encode(jsonString);

  // 3. Stwórz bufor z:
  // - 1 bajt: długość typu zawartości
  // - N bajtów: typ zawartości
  // - reszta: dane JSON
  const buffer = new Uint8Array(1 + contentTypeBytes.length + jsonBytes.length);

  // Długość typu zawartości (max 255 znaków)
  buffer[0] = contentTypeBytes.length;

  // Typ zawartości
  buffer.set(contentTypeBytes, 1);

  // Dane JSON
  buffer.set(jsonBytes, 1 + contentTypeBytes.length);

  return buffer.buffer;
};

/**
 * @description Deserializes binary payload to Json formated request
 */
export const deserializeRequest = (payload) => {
  const view = new Uint8Array(payload);
  const decoder = new TextDecoder();

  // 1. Odczytaj długość typu zawartości
  const contentTypeLength = view[0];

  // 2. Odczytaj typ zawartości
  const contentTypeBytes = view.slice(1, 1 + contentTypeLength);
  const contentType = decoder.decode(contentTypeBytes);

  // 3. Odczytaj dane
  const dataBytes = view.slice(1 + contentTypeLength);
  let data;

  // Deserializacja w zależności od typu zawartości
  switch (contentType) {
    case "application/json":
      data = JSON.parse(decoder.decode(dataBytes));
      break;
    // Możesz dodać obsługę innych typów
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }

  return { contentType, data };
};

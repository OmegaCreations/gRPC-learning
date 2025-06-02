import crypto from "crypto";

/**
 * @description Encrypts data with given public key
 */
export const encryptDataWithPublicKey = (data: any, publicKeyPem: string) => {
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
export const decryptDataWithPrivateKey = (
  encryptedData: string,
  privateKeyPem: string
) => {
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
 * @description Encrypts data with given public key and AES hybrid encryption
 */
export const encryptHybrid = (data: string, publicKeyPem: string) => {
  const aesKey = crypto.randomBytes(32); // 256-bite AES key
  const iv = crypto.randomBytes(16); // 128-byte vector for AES CBC mode

  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  const encryptedData = Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final(),
  ]);

  const encryptedKey = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey
  );

  return {
    encryptedData: encryptedData.toString("base64"),
    encryptedKey: encryptedKey.toString("base64"),
    iv: iv.toString("base64"),
  };
};

/**
 * @description Decrypts data with given private key and AES hybrid decryption
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} encryptedKey - Base64 encoded encrypted AES key
 * @param {string} iv - Base64 encoded initialization vector
 * @param {string} privateKeyPem - PEM formatted private key
 * @returns {string} Decrypted data in UTF-8 format
 */
export const decryptHybrid = (
  encryptedData: string,
  encryptedKey: string,
  iv: string,
  privateKeyPem: string
) => {
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encryptedKey, "base64")
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    aesKey,
    Buffer.from(iv, "base64")
  );
  const decryptedData = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, "base64")),
    decipher.final(),
  ]);

  return decryptedData.toString("utf8");
};

// URL sanitization utility to prevent RCE
export const checkUrl = (
  url: string,
  ALLOWED_DOMAINS: Array<string>
): boolean => {
  const parsed = new URL(url);
  if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
    return false;
  }
  return true;
};

/**
 * @description Serializes Json formatted request into binary payload
 */
export const serializeRequest = (url: string, options?: any) => {
  const encoder = new TextEncoder();
  const contentTypeBytes = encoder.encode("application/json");

  const jsonData = options
    ? {
        url: url,
        options: options,
      }
    : {
        url: url,
      };

  // encode json
  const jsonString = JSON.stringify(jsonData);
  const jsonBytes = encoder.encode(jsonString);

  // 1 byte -> type length
  // N bytes -> type
  // rest -> JSON data
  const buffer = new Uint8Array(1 + contentTypeBytes.length + jsonBytes.length);

  buffer[0] = contentTypeBytes.length;
  buffer.set(contentTypeBytes, 1);
  buffer.set(jsonBytes, 1 + contentTypeBytes.length);

  return buffer.buffer;
};

/**
 * @description Deserializes binary payload to Json formated request
 */
export const deserializeRequest = (payload: any) => {
  const view = new Uint8Array(payload);
  const decoder = new TextDecoder();

  // 1. read length of content type
  const contentTypeLength = view[0];

  // 2. read content type
  const contentTypeBytes = view.slice(1, 1 + contentTypeLength);
  const contentType = decoder.decode(contentTypeBytes);

  // 3. read data
  const dataBytes = view.slice(1 + contentTypeLength);
  let data;

  // deserialization based on content type
  switch (contentType) {
    case "application/json":
      data = JSON.parse(decoder.decode(dataBytes));
      break;
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }

  return { contentType, data };
};

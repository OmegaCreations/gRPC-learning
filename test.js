import {
  serializeRequest,
  deserializeRequest,
} from "./utils/DataManipulation.js";

const req = {
  method: "POST",
  url: "/api/users",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer abc123xyz",
  },
  body: {
    name: "Jan Kowalski",
    email: "jan@example.com",
    age: 30,
    isActive: true,
    preferences: {
      theme: "dark",
      notifications: true,
    },
    tags: ["customer", "vip"],
  },
};

// Przykład serializacji jednego z requestów
const jsonRequestBinary = serializeRequest("application/json", req);

console.log("Serialized: ", jsonRequestBinary);

// Przykład deserializacji
const { contentType, data } = deserializeRequest(jsonRequestBinary);
console.log("Deserialized:");
console.log(contentType); // 'application/json'
console.log(data); // zdeserializowany obiekt requestu

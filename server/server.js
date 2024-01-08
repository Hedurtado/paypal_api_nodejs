import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import path from "path";
  
const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT = 8888 } = process.env;
const base = "https://api.sandbox.paypal.com";
const app = express();
  
// host static files
app.use(express.static("client"));
  
// parse post params sent in body in json format
app.use(express.json());
  
/**
* Generate an OAuth 2.0 access token for authenticating with PayPal REST APIs.
* @see https://developer.paypal.com/api/rest/authentication/
*/
const generateAccessToken = async () => {
  console.log("generateAccessToken function called");

  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }

    console.log("PAYPAL_CLIENT_ID:", PAYPAL_CLIENT_ID); // Add this line
    console.log("PAYPAL_CLIENT_SECRET:", PAYPAL_CLIENT_SECRET); // Add this line

    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET,
    ).toString("base64");

    console.log("Authorization header:", `Basic ${auth}`); // Add this line

    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new Error(`PayPal API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
    throw error;
  }
};
  
/**
* Create an order to start the transaction.
* @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
*/
const createOrder = async (cart) => {
  console.log("createOrder function called");
  console.log("Access token gonna be generated");

  let accessToken, url, payload;

  try {
    accessToken = await generateAccessToken();
    console.log(`Bearer ${accessToken}`);
    url = `${base}/v2/checkout/orders`;
    payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: "100.00",
          },
        },
      ],
    };
  } catch (error) {
    console.error("Error in createOrder function:", error);
    throw error;
  }

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

/**
* Capture payment for the created order to complete the transaction.
* @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
*/
const captureOrder = async (orderID) => {
  console.log(`Capturing order: ${orderID}`);

  const accessToken = await generateAccessToken();
  console.log(`Access token: ${accessToken}`);

  const url = `${base}/v2/checkout/orders/${orderID}/capture`;
  console.log(`URL: ${url}`);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  console.log(`Response: ${JSON.stringify(response, null, 2)}`);
  
  return handleResponse(response);
};
  
async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}
  
app.post("/api/orders", async (req, res) => {
  try {
    // use the cart information passed from the front-end to calculate the order amount detals
    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await createOrder(cart);
  console.log('Order created:', jsonResponse);
  res.status(httpStatusCode).json(jsonResponse);
} catch (error) {
  console.error("Error calling createOrder:", error);
  res.status(500).json({ error: "Failed to create order." });
}
});
  
app.post("/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});
  
// serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.resolve("./client/checkout.html"));
});
  
app.listen(PORT, () => {
  console.log(`Node server listening at http://localhost:${PORT}/`);
});

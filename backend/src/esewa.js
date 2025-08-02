const axios = require("axios");
const crypto = require("crypto");

async function getEsewaPaymentHash({ amount, transaction_uuid }) {
  try {
    const data = `total_amount=${amount},transaction_uuid=${transaction_uuid},product_code=${process.env.ESEWA_PRODUCT_CODE}`;
    const secretKey = process.env.ESEWA_SECRET_KEY;

    const hash = crypto
      .createHmac("sha256", secretKey)
      .update(data)
      .digest("base64");

    return {
      signature: hash,
      signed_field_names: "total_amount,transaction_uuid,product_code",
    };
  } catch (error) {
    throw new Error("Error generating eSewa payment hash: " + error.message);
  }
}

async function verifyEsewaPayment(encodedData) {
  try {
    // Decode base64 and parse JSON
    const jsonString = Buffer.from(encodedData, "base64").toString("utf-8");
    const decodedData = JSON.parse(jsonString);

    const data = `transaction_code=${decodedData.transaction_code},status=${decodedData.status},total_amount=${decodedData.total_amount},transaction_uuid=${decodedData.transaction_uuid},product_code=${process.env.ESEWA_PRODUCT_CODE},signed_field_names=${decodedData.signed_field_names}`;
    const secretKey = process.env.ESEWA_SECRET_KEY;

    const generatedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(data)
      .digest("base64");

    if (generatedSignature !== decodedData.signature) {
      throw new Error("Signature mismatch: Invalid Info");
    }

    const response = await axios.get(
      `${process.env.ESEWA_GATEWAY_URL}/api/epay/transaction/status/`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        params: {
          product_code: process.env.ESEWA_PRODUCT_CODE,
          total_amount: decodedData.total_amount,
          transaction_uuid: decodedData.transaction_uuid,
        },
      }
    );

    const responseData = response.data;

    if (
      responseData.status !== "COMPLETE" ||
      responseData.transaction_uuid !== decodedData.transaction_uuid ||
      Number(responseData.total_amount) !== Number(decodedData.total_amount)
    ) {
      throw new Error("Transaction verification failed: Invalid Info");
    }

    return { response: responseData, decodedData };
  } catch (error) {
    throw new Error("Esewa verification error: " + error.message);
  }
}

module.exports = { getEsewaPaymentHash, verifyEsewaPayment };

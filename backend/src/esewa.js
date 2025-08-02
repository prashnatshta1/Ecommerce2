const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const getEsewaPaymentHash = ({
  amount,
  tax_amount,
  total_amount,
  product_service_charge,
  product_delivery_charge,
  transaction_uuid,
  product_code,
  success_url,
  failure_url,
}) => {
  const signed_field_names = "total_amount,transaction_uuid,product_code";

  const dataToSign = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;

  const secretKey = process.env.ESEWA_SECRET_KEY;

  if (!secretKey) {
    throw new Error("ESEWA_SECRET_KEY is not set in .env");
  }

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(dataToSign)
    .digest("base64"); // ✅ Must be base64 for eSewa v2

  return {
    amount: amount.toString(),
    tax_amount: tax_amount.toString(),
    total_amount: total_amount.toString(),
    transaction_uuid: transaction_uuid.toString(),
    product_code,
    product_service_charge: product_service_charge.toString(),
    product_delivery_charge: product_delivery_charge.toString(),
    success_url,
    failure_url,
    signed_field_names,
    signature,
  };
};

const verifyEsewaPayment = async (data) => {
  try {
    const decodedData = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
    return { response: decodedData, decodedData };
  } catch (error) {
    throw new Error("Failed to decode eSewa payment data.");
  }
};

module.exports = { getEsewaPaymentHash, verifyEsewaPayment };

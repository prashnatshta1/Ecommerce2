// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const Item = require("./model/itemModel");
const PurchasedItem = require("./model/purchasedItemModel");
const Payment = require("./routes/payment");
const { getEsewaPaymentHash, verifyEsewaPayment } = require("./esewa");
const authRoutes = require("./routes/authRoutes");

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("<h1>eSewa Payment Server Running</h1>");
});

app.use("/api/auth", authRoutes);

// Add item for testing
app.post("/test-add-item", async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || !price || isNaN(price)) {
      return res.status(400).json({ success: false, message: "Invalid product data." });
    }
    const newItem = await Item.create({ name, price });
    res.status(201).json(newItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to create item." });
  }
});

// Initialize eSewa payment
app.post("/initialize-esewa", async (req, res) => {
  try {
    const { itemId, totalPrice } = req.body;

    if (!itemId || !totalPrice) {
      return res.status(400).json({ success: false, message: "itemId and totalPrice are required." });
    }

    const itemData = await Item.findById(itemId);
    if (!itemData) {
      return res.status(400).json({ success: false, message: "Item not found." });
    }

    const itemPrice = parseFloat(itemData.price);
    const givenPrice = parseFloat(totalPrice);
    if (Math.abs(itemPrice - givenPrice) > 0.01) {
      return res.status(400).json({
        success: false,
        message: "Price mismatch.",
        expectedPrice: itemPrice,
        receivedPrice: givenPrice,
      });
    }

    const purchasedItemData = await PurchasedItem.create({
      item: itemId,
      paymentMethod: "esewa",
      totalPrice: itemPrice,
    });

    const paymentInitiate = getEsewaPaymentHash({
      amount: itemPrice,
      tax_amount: 0,
      total_amount: itemPrice,
      product_service_charge: 0,
      product_delivery_charge: 0,
      transaction_uuid: purchasedItemData._id,
      product_code: process.env.ESEWA_MERCHANT_CODE,
      success_url: process.env.ESEWA_SUCCESS_URL,
      failure_url: process.env.ESEWA_FAILURE_URL,
    });

    res.json({
      success: true,
      payment: {
        ...paymentInitiate,
        esewa_initiate_url: "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
      },
      purchasedItemData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error initializing payment.", error: error.message });
  }
});

// Endpoint to verify and complete payment
app.get("/complete-payment", async (req, res) => {
  const { data } = req.query;
  try {
    if (!data) return res.status(400).send("Missing payment data.");

    const { response: paymentInfo } = await verifyEsewaPayment(data);

    if (!paymentInfo || paymentInfo.status !== "COMPLETE") {
      return res.redirect(`/payment/failure?message=Payment verification failed.`);
    }

    const purchasedItemData = await PurchasedItem.findById(paymentInfo.transaction_uuid);
    if (!purchasedItemData) {
      return res.status(404).send("Purchased item not found.");
    }

    await Payment.create({
      pidx: paymentInfo.transaction_code,
      transactionId: paymentInfo.transaction_code,
      productId: purchasedItemData._id,
      amount: purchasedItemData.totalPrice,
      dataFromVerificationReq: paymentInfo,
      apiQueryFromUser: req.query,
      paymentGateway: "esewa",
      status: "success",
    });

    await PurchasedItem.findByIdAndUpdate(purchasedItemData._id, { status: "completed" });

    res.redirect(`/payment/success?message=Payment successful!&transactionId=${paymentInfo.transaction_code}`);
  } catch (error) {
    console.error(error);
    res.redirect(`/payment/failure?message=An error occurred during payment verification.`);
  }
});

// Success page
app.get("/payment/success", (req, res) => {
  res.status(200).send(`
    <h1>Payment Successful!</h1>
    <p>${req.query.message || ""}</p>
    <p>Transaction ID: ${req.query.transactionId || ""}</p>
    <a href="/">Back to home</a>
  `);
});

// Failure page
app.get("/payment/failure", (req, res) => {
  res.status(400).send(`
    <h1>Payment Failed</h1>
    <p>${req.query.message || "There was an issue with your payment."}</p>
    <a href="/">Back to home</a>
  `);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

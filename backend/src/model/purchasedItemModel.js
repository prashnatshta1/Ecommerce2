const mongoose = require("mongoose");

const purchasedItemSchema = mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Item",
        required: true,
    },
    totalPrice: {
        type: Number,
        required: true,
    },
    paymentMethod: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending",
    },
}, {
    timestamps: true,
});

const PurchasedItem = mongoose.model("PurchasedItem", purchasedItemSchema);
module.exports = PurchasedItem;
const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    adSoyad: {
      type: String,
      required: true,
    },

    telefon: String,
    email: String,
    adres: String,
    notlar: String,

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Customer", CustomerSchema);
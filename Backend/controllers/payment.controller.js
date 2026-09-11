// BUG FIX: original file did
//   import razorpay from "../services/razorpay.service.js";
//   import razorpay from "../models/payment.model.js";
// Two different imports with the SAME name `razorpay` — this is a
// duplicate-identifier error and won't even compile. Renamed clearly.
import razorpayInstance from "../services/razorpay.service.js";
import crypto from "crypto";
import Payment from "../models/payment.model.js";
// BUG FIX: `User` was used in verifyPayment() but never imported.
import User from "../models/user.model.js";

// Centralized plan catalog - source of truth for pricing and credits
export const PLAN_CATALOG = {
    basic: { name: "Starter Pack", amount: 100, credits: 150 },
    pro: { name: "Pro Pack", amount: 500, credits: 650 },
};

export const createOrder = async (req, res) => {
    try {
        const { planId } = req.body;
        const plan = PLAN_CATALOG[planId];
        if (!plan) {
            return res.status(400).json({ message: "Invalid or unsupported plan selected." });
        }

        const options = {
            amount: plan.amount * 100, // convert to paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpayInstance.orders.create(options);

        await Payment.create({
            userId: req.userId,
            planId,
            amount: plan.amount,
            credits: plan.credits,
            razorpayOrderId: order.id,
            status: "created",
        });

        return res.json(order);
    } catch (error) {
        console.error("Payment order creation error:", error);
        return res.status(500).json({
            message: "Failed to create Razorpay payment order.",
        });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
            req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: "Incomplete payment verification payload." });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: "Invalid payment signature." });
        }

        // Atomically mark payment as paid only if not already paid
        const payment = await Payment.findOneAndUpdate(
            {
                razorpayOrderId: razorpay_order_id,
                status: { $ne: "paid" },
            },
            {
                status: "paid",
                razorpayPaymentId: razorpay_payment_id,
            },
            { new: true }
        );

        if (!payment) {
            const existingPayment = await Payment.findOne({
                razorpayOrderId: razorpay_order_id,
            });
            if (existingPayment && existingPayment.status === "paid") {
                return res.json({ message: "Payment already processed." });
            }
            return res.status(404).json({ message: "Payment record not found." });
        }

        const updatedUser = await User.findByIdAndUpdate(
            payment.userId,
            { $inc: { credits: payment.credits } },
            { new: true }
        );

        return res.json({
            success: true,
            message: "Payment verified and credits added.",
            user: updatedUser,
        });
    } catch (error) {
        console.error("Payment verification error:", error);
        return res.status(500).json({
            message: "Failed to verify payment.",
        });
    }
};
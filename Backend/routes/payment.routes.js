import express from "express";
// BUG FIX: `createOrder` was used below but never imported (only
// `verifyPayment` was). Also `isAuth` middleware wasn't imported at all,
// so both routes would have crashed with "isAuth is not defined".
import { createOrder, verifyPayment } from "../controllers/payment.controller.js";
import isAuth from "../middlewares/isAuth.js";

const paymentRouter = express.Router();

paymentRouter.post("/order", isAuth, createOrder);
paymentRouter.post("/verify", isAuth, verifyPayment);

export default paymentRouter;
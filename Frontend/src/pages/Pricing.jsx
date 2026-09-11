import { useState } from "react";
import { FaArrowLeft, FaCheckCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import axios from "axios";
import { ServerUrl } from "../utils/constants";
import { useDispatch, useSelector } from "react-redux";
import { setUserData } from "../redux/userSlice";

const Pricing = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [loadingPlan, setLoadingPlan] = useState(null);
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "₹0",
      credits: 100,
      description: "Perfect for beginners starting interview preparation.",
      features: [
        "100 AI Interview Credits",
        "Basic Performance Report",
        "Voice Interview Access",
        "Limited History Tracking",
      ],
      default: true,
    },
    {
      id: "basic",
      name: "Starter Pack",
      price: "₹100",
      credits: 150,
      description: "Great for focused practice and skill improvement.",
      features: [
        "150 AI Interview Credits",
        "Detailed Feedback",
        "Performance Analytics",
        "Full Interview History",
      ],
    },
    {
      id: "pro",
      name: "Pro Pack",
      price: "₹500",
      credits: 650,
      description: "Best for serious, high-volume interview practice.",
      features: [
        "650 AI Interview Credits",
        "Advanced AI Feedback",
        "Performance Analytics",
        "Full Interview History",
      ],
      badge: "Best Value",
    },
  ];

  const handlePayment = async (plan) => {
    if (!userData) {
      alert("Please log in first to purchase credits.");
      navigate("/auth");
      return;
    }

    if (plan.id === "free") {
      alert("The Free tier (100 credits) is automatically available for every new user.");
      return;
    }

    try {
      setLoadingPlan(plan.id);

      const result = await axios.post(
        ServerUrl + "/api/payment/order",
        { planId: plan.id },
        { withCredentials: true }
      );

      if (!window.Razorpay) {
        alert("Razorpay payment gateway failed to load. Please check your connection or disable ad blockers.");
        setLoadingPlan(null);
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: result.data.amount,
        currency: "INR",
        name: "InterviewIQ.AI",
        description: `${plan.name} - ${plan.credits} Credits`,
        order_id: result.data.id,

        handler: async function (response) {
          try {
            const verifypay = await axios.post(
              ServerUrl + "/api/payment/verify",
              response,
              { withCredentials: true }
            );

            dispatch(setUserData(verifypay.data.user));
            alert("Payment successful! Credits added.");
            navigate("/");
          } catch (err) {
            console.log(err);
            alert("Payment verification failed. Please contact support.");
          }
        },
        theme: {
          color: "#3B4FE0",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

      setLoadingPlan(null);
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || "Failed to create payment order. Please try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4" style={{ backgroundColor: "var(--paper)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border"
            style={{ borderColor: "var(--border)" }}
          >
            <FaArrowLeft style={{ color: "var(--ink)" }} />
          </button>

          <div>
            <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--ink)" }}>
              Choose Your Plan
            </h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Flexible pricing to match your interview preparation goals.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;

            return (
              <motion.div
                key={plan.id}
                whileHover={!plan.default ? { scale: 1.02 } : {}}
                onClick={() => !plan.default && setSelectedPlan(plan.id)}
                className="relative bg-white rounded-2xl border p-6 flex flex-col cursor-pointer"
                style={{
                  borderColor: isSelected ? "var(--indigo)" : "var(--border)",
                  borderWidth: isSelected ? "2px" : "1px",
                }}
              >
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-white px-3 py-1 rounded-full"
                    style={{ backgroundColor: "var(--gold)" }}
                  >
                    {plan.badge}
                  </div>
                )}

                <h3 className="font-display text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>
                  {plan.name}
                </h3>

                <div className="mb-3">
                  <span className="font-display text-3xl font-bold" style={{ color: "var(--ink)" }}>
                    {plan.price}
                  </span>
                  <p className="text-xs font-mono mt-1" style={{ color: "#6B7280" }}>
                    {plan.credits} credits
                  </p>
                </div>

                <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
                  {plan.description}
                </p>

                <div className="flex flex-col gap-2.5 mb-6 flex-1">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <FaCheckCircle size={13} style={{ color: "var(--green)" }} />
                      <span className="text-sm" style={{ color: "var(--ink)" }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  disabled={loadingPlan === plan.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (plan.default) return; // free plan: nothing to pay
                    if (!isSelected) {
                      setSelectedPlan(plan.id);
                    } else {
                      handlePayment(plan);
                    }
                  }}
                  className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
                  style={
                    plan.default
                      ? { backgroundColor: "var(--surface-muted)", color: "var(--ink)" }
                      : { backgroundColor: "var(--indigo)", color: "white" }
                  }
                >
                  {plan.default
                    ? "Current Plan"
                    : loadingPlan === plan.id
                    ? "Processing..."
                    : isSelected
                    ? "Proceed to Pay"
                    : "Select Plan"}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
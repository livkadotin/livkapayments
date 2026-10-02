/**
 * Livka Pay JavaScript Client SDK v1.0.0
 * Unified multi-tenant checkout helper for websites connecting to Livka Pay.
 *
 * Usage:
 * <script src="https://payments.livka.in/sdk/livka-pay.js"></script>
 *
 * LivkaPay.pay({
 *   publishableKey: "pk_live_xxxxx",
 *   amount: 799,
 *   receipt: "LV-10291",
 *   customer: { name: "Rahul", email: "rahul@example.com" },
 *   onSuccess: function(res) { ... },
 *   onError: function(err) { ... }
 * });
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    var instance = factory();
    root.LivkaPay = instance;
    root.ReplyFlowPay = instance; // Backwards compatibility alias
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULT_ENDPOINT = "https://payments.livka.in";

  function loadScript(src, cb) {
    if (document.querySelector('script[src="' + src + '"]')) {
      if (cb) cb();
      return;
    }
    var script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = function () {
      if (cb) cb();
    };
    script.onerror = function () {
      if (cb) cb(new Error("Failed to load script: " + src));
    };
    document.body.appendChild(script);
  }

  var LivkaPay = {
    version: "1.0.0",

    /**
     * Launch checkout with server-side order creation & payment verification
     */
    pay: function (config) {
      if (!config.publishableKey) {
        throw new Error("LivkaPay: 'publishableKey' is required.");
      }
      if (!config.amount || config.amount <= 0) {
        throw new Error("LivkaPay: 'amount' must be a positive number.");
      }

      var endpoint = config.endpoint || DEFAULT_ENDPOINT;

      // 1. Ensure Razorpay Checkout JS is loaded
      loadScript("https://checkout.razorpay.com/v1/checkout.js", function (err) {
        if (err) {
          if (config.onError) config.onError(err);
          return;
        }

        // 2. Open hosted checkout or modal
        var checkoutUrl =
          endpoint +
          "/pay/checkout?pk=" +
          encodeURIComponent(config.publishableKey) +
          "&amount=" +
          encodeURIComponent(config.amount) +
          (config.receipt ? "&receipt=" + encodeURIComponent(config.receipt) : "");

        // If client opted for modal popup:
        if (typeof window.Razorpay !== "undefined" && config.razorpayOrderId && config.razorpayKeyId) {
          var rzp = new window.Razorpay({
            key: config.razorpayKeyId,
            amount: Math.round(config.amount * 100),
            currency: config.currency || "INR",
            order_id: config.razorpayOrderId,
            name: config.websiteName || "Livka Pay",
            description: config.description || "Secure Payment",
            prefill: config.customer || {},
            theme: { color: "#059669" },
            handler: function (response) {
              // Submit verification to Livka Pay
              fetch(endpoint + "/api/v1/payments/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  order_id: config.orderId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              })
                .then(function (res) {
                  return res.json();
                })
                .then(function (resData) {
                  if (resData.success && config.onSuccess) {
                    config.onSuccess(resData);
                  } else if (config.onError) {
                    config.onError(new Error(resData.error || "Payment verification failed"));
                  }
                })
                .catch(function (verifyErr) {
                  if (config.onError) config.onError(verifyErr);
                });
            },
            modal: {
              ondismiss: function () {
                if (config.onDismiss) config.onDismiss();
              },
            },
          });
          rzp.open();
        } else {
          // Fallback to direct hosted checkout redirect
          window.location.href = checkoutUrl;
        }
      });
    },
  };

  return LivkaPay;
});


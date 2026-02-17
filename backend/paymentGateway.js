const Razorpay = require('razorpay');
const crypto = require('crypto');

class PaymentGateway {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  async createOrder(amount, receipt) {
    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: receipt,
      payment_capture: 1
    };
    try {
      const order = await this.razorpay.orders.create(options);
      return order;
    } catch (error) {
      console.error('Razorpay order creation failed:', error);
      throw error;
    }
  }

  verifyPayment(orderId, paymentId, signature) {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');
    return expectedSignature === signature;
  }
}

module.exports = new PaymentGateway();
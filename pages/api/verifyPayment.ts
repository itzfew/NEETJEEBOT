import { Cashfree } from 'cashfree-pg';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { orderId, productId } = req.body;

  try {
    const order = await Cashfree.PGOrderFetch({ orderId });
    if (order.order_status === 'PAID') {
      // Update Firebase with payment status
      await set(ref(db, `users/${order.customer_details.customer_id}/paymentStatus/${productId}`), true);
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ success: false, error: 'Payment not completed' });
  } catch (error) {
    console.error('Payment verification failed:', error);
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
}

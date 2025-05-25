import { db } from '../../src/utils/firebase';
import { ref, set } from 'firebase/database';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const event = req.body;

  // Example: Update payment status in Firebase under 'payments/{order_id}'
  if (event.order && event.order.order_id && event.order.order_status) {
    const orderId = event.order.order_id;
    await set(ref(db, `payments/${orderId}`), event.order);
    console.log('Payment status updated in Firebase:', event.order);
  }

  res.status(200).send('OK');
}

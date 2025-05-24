// pages/pay.tsx
import { useRouter } from 'next/router';
import { Cashfree } from 'cashfree-pg';

export default function Pay() {
  const router = useRouter();
  const { productId, userId } = router.query;

  const initiatePayment = async () => {
    try {
      const response = await fetch('/api/createOrder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          productName: 'Study Material',
          amount: 100, // Set your amount
          telegramLink: 'https://t.me/Material_eduhubkmrbot',
          customerName: 'User', // Fetch from Firebase or Telegram
          customerEmail: 'user@example.com', // Fetch from Firebase
          customerPhone: '1234567890', // Fetch from Firebase
        }),
      });
      const { paymentSessionId } = await response.json();
      const cashfree = new Cashfree();
      cashfree.checkout({
        paymentSessionId,
        returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/success?order_id={order_id}&product_id=${productId}`,
      });
    } catch (error) {
      console.error('Payment initiation failed:', error);
    }
  };

  return (
    <div>
      <h1>Complete Payment</h1>
      <button onClick={initiatePayment}>Pay Now</button>
    </div>
  );
}

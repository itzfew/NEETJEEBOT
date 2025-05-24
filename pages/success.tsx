// pages/success.tsx
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Success() {
  const router = useRouter();
  const { order_id, product_id } = router.query;

  useEffect(() => {
    // Verify payment status with Cashfree API
    async function verifyPayment() {
      try {
        const response = await fetch('/api/verifyPayment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order_id, productId: product_id }),
        });
        const data = await response.json();
        if (data.success) {
          alert('Payment verified! You can now access the material.');
        } else {
          alert('Payment verification failed.');
        }
      } catch (error) {
        console.error('Verification failed:', error);
      }
    }
    if (order_id && product_id) verifyPayment();
  }, [order_id, product_id]);

  return <div>Processing payment...</div>;
}

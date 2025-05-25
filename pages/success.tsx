import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function SuccessPage() {
  const router = useRouter();
  const { order_id, product_id } = router.query;

  useEffect(() => {
    if (order_id && product_id) {
      // Redirect to Telegram bot or show a message
      // For example: Redirect to Telegram bot with product info
      window.location.href = `https://t.me/your_bot_username?start=order_${order_id}_${product_id}`;
    }
  }, [order_id, product_id]);

  return <div>Redirecting you to Telegram... If not redirected, click <a href={`https://t.me/your_bot_username?start=order_${order_id}_${product_id}`}>here</a>.</div>;
}

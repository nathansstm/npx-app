const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('./db');
const fs = require('fs');
const router = express.Router();

router.post('/success', async (req, res) => {
  const { session_id, token } = req.body;  // Updated to accept session_id and token from frontend
  
  try {
    // Retrieve Checkout Session and verify payment
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const paymentIntentId = session.payment_intent;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not confirmed as succeeded' });
    }

    // Check if payment is already stored
    const paymentCheck = await pool.query('SELECT id FROM payments WHERE payment_intent_id = $1', [paymentIntentId]);
    let paymentId;

    if (paymentCheck.rows.length > 0) {
      paymentId = paymentCheck.rows[0].id;
    } else {
      // Generate a Token
      const token = generateCode();

      // Store new payment info if not in database, removing access_code
      const insertPayment = await pool.query(
        'INSERT INTO payments (session_id, payment_intent_id, token, payment_status) VALUES ($1, $2, $3, $4) RETURNING id',
        [session_id, paymentIntentId, token, paymentIntent.status]
      );
      paymentId = insertPayment.rows[0].id;
    }

    // Check if a download link already exists for this payment
    const downloadCheck = await pool.query('SELECT download_link FROM downloads WHERE payment_id = $1', [paymentId]);
    if (downloadCheck.rows.length > 0) {
      return res.status(200).json({ download_link: downloadCheck.rows[0].download_link });
    }

    // Generate and upload file if no existing link
    const fileBuffer = fs.readFileSync('/root/App.tar.gz');
    const fileUpload = await stripe.files.create({
      purpose: 'dispute_evidence',
      file: { data: fileBuffer, name: 'App.tar.gz', type: 'application/gzip' }
    });

    if (!fileUpload || fileUpload.status !== 'succeeded') {
      return res.status(500).json({ message: 'File upload failed' });
    }

    const downloadLink = fileUpload.url;

    // Store the download link in the downloads table
    await pool.query(
      'INSERT INTO downloads (payment_id, download_link) VALUES ($1, $2)',
      [paymentId, downloadLink]
    );

    res.status(200).json({
      status: 'OK',
      download_link: downloadLink,
      token  // Respond with token only
    });

  } catch (error) {
    console.error('Error processing /success route:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Helper function to generate token
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000);
}

module.exports = router;
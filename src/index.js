const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/wishlistdb';
mongoose.connect(MONGO_URI).then(() => console.log('Wishlist Service: MongoDB connected')).catch(err => console.error(err));

const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003';

const wishlistSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  productId: { type: String, required: true },
  name: String,
  image: String,
  price: Number,
  addedAt: { type: Date, default: Date.now }
});
wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });
const WishlistItem = mongoose.model('WishlistItem', wishlistSchema);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'wishlist-service' }));

// Get wishlist
app.get('/wishlist/:userId', async (req, res) => {
  try {
    const items = await WishlistItem.find({ userId: req.params.userId }).sort({ addedAt: -1 });
    res.json({ items, count: items.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add to wishlist
app.post('/wishlist', async (req, res) => {
  try {
    const { userId, productId } = req.body;
    const existing = await WishlistItem.findOne({ userId, productId });
    if (existing) return res.status(400).json({ error: 'Already in wishlist' });

    let productData = {};
    try {
      const resp = await axios.get(`${PRODUCT_SERVICE}/products/${productId}`);
      productData = resp.data;
    } catch (e) { /* use provided data */ }

    const item = await WishlistItem.create({
      userId, productId,
      name: productData.name || req.body.name,
      image: (productData.images && productData.images[0]) || req.body.image,
      price: productData.price || req.body.price
    });
    res.status(201).json({ message: 'Added to wishlist', item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Remove from wishlist
app.delete('/wishlist/:userId/:productId', async (req, res) => {
  try {
    await WishlistItem.findOneAndDelete({ userId: req.params.userId, productId: req.params.productId });
    res.json({ message: 'Removed from wishlist' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Check if in wishlist
app.get('/wishlist/:userId/check/:productId', async (req, res) => {
  try {
    const item = await WishlistItem.findOne({ userId: req.params.userId, productId: req.params.productId });
    res.json({ inWishlist: !!item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => console.log(`Wishlist Service running on port ${PORT}`));

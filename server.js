import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 5000;
const host = process.env.HOST || '0.0.0.0';
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDistDirectory = path.join(currentDirectory, '..', 'client', 'dist');
const memoryReactions = [];
let dbConnected = false;

app.use(cors());
app.use(express.json());

const reactionSchema = new mongoose.Schema({ mood: String, createdAt: { type: Date, default: Date.now } });
const Reaction = mongoose.model('Reaction', reactionSchema);

const getRecentReactions = async () => {
  if (!dbConnected) {
    return memoryReactions.slice(0, 20);
  }

  return Reaction.find().sort({ createdAt: -1 }).limit(20);
};

const saveReaction = async (mood) => {
  const reaction = { mood, createdAt: new Date() };

  if (!dbConnected) {
    memoryReactions.unshift(reaction);
    return reaction;
  }

  return Reaction.create({ mood });
};

app.get('/api/health', (_request, response) => response.json({ ok: true, message: 'Miu API is awake', database: dbConnected ? 'connected' : 'offline' }));
app.get('/api/reactions', async (_request, response) => {
  try {
    const reactions = await getRecentReactions();
    response.json(reactions);
  } catch (error) {
    response.status(500).json({ error: 'Failed to fetch reactions', message: error.message });
  }
});
app.post('/api/reactions', async (request, response) => {
  const mood = request.body?.mood;

  if (typeof mood !== 'string' || !mood.trim()) {
    return response.status(400).json({ error: 'A valid mood is required' });
  }

  try {
    const reaction = await saveReaction(mood);
    response.status(201).json(reaction);
  } catch (error) {
    response.status(500).json({ error: 'Failed to save reaction', message: error.message });
  }
});

app.use(express.static(clientDistDirectory));

const startServer = () => {
  app.listen(port, host, () => console.log(`Miu app running on ${host}:${port}`));
};

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/miu_apology')
  .then(() => {
    dbConnected = true;
    console.log('MongoDB connected');
    startServer();
  })
  .catch((error) => {
    console.warn('MongoDB connection failed, starting in offline mode:', error.message);
    startServer();
  });

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@swajan48.9pzqlth.mongodb.net/?retryWrites=true&w=majority&appName=Swajan48`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

let volunteerCollection, requestsCollection, feedbackCollection, usersCollection;

async function run() {
  try {
    const db = client.db("volunteerDb");
    volunteerCollection = db.collection("volunteers");
    requestsCollection = db.collection("volunteerRequests");
    feedbackCollection = db.collection("feedbacks");
    usersCollection = db.collection("users"); // For user profiles

    // ---------------- Volunteer APIs ----------------
    app.get('/volunteers', async (req, res) => {
      const search = req.query.search || '';
      const email = req.query.email;
      let query = {};
      if (search) query.postTitle = { $regex: search, $options: 'i' };
      if (email) query.organizerEmail = email;
      const result = await volunteerCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/volunteers/:id', async (req, res) => {
      const id = req.params.id;
      const result = await volunteerCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post('/volunteers', async (req, res) => {
      const data = req.body;
      if (data.deadline) data.deadline = new Date(data.deadline);
      const result = await volunteerCollection.insertOne(data);
      res.send(result);
    });

    app.put('/volunteers/:id', async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      if (updatedData.deadline) updatedData.deadline = new Date(updatedData.deadline);
      const result = await volunteerCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    app.delete('/volunteers/:id', async (req, res) => {
      const id = req.params.id;
      const result = await volunteerCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // ---------------- Requests APIs ----------------
    app.get('/requests', async (req, res) => {
      const result = await requestsCollection.find().toArray();
      res.send(result);
    });

    app.get('/requests/:id', async (req, res) => {
      const id = req.params.id;
      const result = await requestsCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get('/myRequests', async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "Email is required" });
      const result = await requestsCollection.find({ volunteerEmail: email }).toArray();
      res.send(result);
    });

    app.post('/requests', async (req, res) => {
      const data = req.body;
      const insertResult = await requestsCollection.insertOne(data);

      // Decrease volunteersNeeded by 1
      await volunteerCollection.updateOne(
        { _id: new ObjectId(data.volunteerPostId) },
        { $inc: { volunteersNeeded: -1 } }
      );

      res.send({ insertResult });
    });

    app.delete('/requests/:id', async (req, res) => {
      const id = req.params.id;
      const result = await requestsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // ---------------- Feedback APIs ----------------
    app.post('/feedbacks', async (req, res) => {
      try {
        const { volunteerPostId, volunteerName, volunteerEmail, feedback, rating } = req.body;
        if (!volunteerPostId || !volunteerName || !volunteerEmail || !feedback || !rating)
          return res.status(400).send({ error: 'Missing fields' });

        const result = await feedbackCollection.insertOne({
          volunteerPostId,
          volunteerName,
          volunteerEmail,
          feedback,
          rating: parseInt(rating),
          createdAt: new Date(),
        });
        res.send({ insertedId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Server error' });
      }
    });

    app.get('/feedbacks/:postId', async (req, res) => {
      const postId = req.params.postId;
      const result = await feedbackCollection.find({ volunteerPostId: postId }).toArray();
      res.send(result);
    });

    // ---------------- Notifications API ----------------
    app.get('/notifications', async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: 'Email is required' });

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        nextWeek.setHours(23, 59, 59, 999);

        const myRequests = await requestsCollection.find({ volunteerEmail: email }).toArray();
        const notifications = [];

        for (let req of myRequests) {
          const post = await volunteerCollection.findOne({ _id: new ObjectId(req.volunteerPostId) });
          if (!post) continue;

          const deadline = new Date(post.deadline);
          if (deadline >= today && deadline <= nextWeek) {
            notifications.push({
              postTitle: post.postTitle,
              deadline: post.deadline,
              location: post.location,
              organizerName: post.organizerName,
            });
          }
        }

        res.send(notifications);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Server error' });
      }
    });

    // ---------------- Volunteer History ----------------
    app.get('/history', async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: 'Email is required' });

      try {
        const myRequests = await requestsCollection.find({ volunteerEmail: email }).toArray();
        const history = [];

        for (let req of myRequests) {
          const post = await volunteerCollection.findOne({ _id: new ObjectId(req.volunteerPostId) });
          if (!post) continue;

          const feedback = await feedbackCollection.findOne({
            volunteerPostId: req.volunteerPostId,
            volunteerEmail: email,
          });

          history.push({
            postTitle: post.postTitle,
            date: post.deadline,
            hours: post.volunteerHours || 0,
            feedback: feedback ? feedback.feedback : null,
            rating: feedback ? feedback.rating : null,
            organizer: post.organizerName,
            organizerEmail: post.organizerEmail, // added for profile link
          });
        }

        res.send(history);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Server error' });
      }
    });

    // ---------------- Root ----------------
    app.get('/', (req, res) => res.send('Volunteerly Server Running'));

    // ---------------- Start Server ----------------
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });

  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

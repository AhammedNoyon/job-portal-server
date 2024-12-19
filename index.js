const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://job-portal-4029b.web.app",
      "https://job-portal-4029b.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

function verifyToken(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "UnAuthorize access" });
  }
  jwt.verify(token, process.env.JWT_TOKEN_SECRET, (error, decode) => {
    console.log(error);
    if (error) {
      return res.status(401).send({ message: "UnAuthorize access" });
    }
    req.user = decode;
    next();
  });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zo35n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    //collection
    const jobCollection = client.db("job_portal").collection("jobs");
    const jobApplicationCollection = client
      .db("job_portal")
      .collection("job_applications");

    //====>>> auth related api <<<======//
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    //job related api
    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { hr_email: email };
      }
      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      // console.log(newJob);
      const result = await jobCollection.insertOne(newJob);
      res.send(result);
    });

    //application related api

    app.get("/job-applications/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const query = {
        applicant_email: email,
      };

      if (req.user?.email !== req.params?.email) {
        return res.status(403).send({ massage: "forbidden" });
      }
      const result = await jobApplicationCollection.find(query).toArray();
      for (const resData of result) {
        const jobId = resData.job_id;
        const query = { _id: new ObjectId(jobId) };
        const job = await jobCollection.findOne(query);
        if (job) {
          resData.title = job.title;
          resData.company = job.company;
          resData.location = job.location;
          resData.company_logo = job.company_logo;
        }
      }
      res.send(result);
    });
    app.post("/job-applications", async (req, res) => {
      const applyInfo = req.body;
      const result = await jobApplicationCollection.insertOne(applyInfo);
      const id = applyInfo.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobCollection.findOne(query);
      let count = 0;
      if (job.applicationCount) {
        count = applicationCount + 1;
      } else {
        count = 1;
      }
      //update
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          applicationCount: count,
        },
      };
      const updateResult = await jobCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.delete("/job-applications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobApplicationCollection.deleteOne(query);
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job portal server side");
});

app.listen(port, () => {
  console.log(`the job portal server is running on ${port}`);
});

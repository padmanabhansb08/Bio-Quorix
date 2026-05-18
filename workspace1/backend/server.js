import express from "express";

import cors from "cors";

import dotenv from "dotenv";

import fetch from "node-fetch";

import chatRouter from "./routes/chat.js";


// GLOBAL FETCH

global.fetch = fetch;


// CONFIG

dotenv.config();

const app = express();


// MIDDLEWARE

app.use(cors());

app.use(
  express.json({
    limit: "10mb"
  })
);


// ROUTES

app.use("/chat", chatRouter);


// HEALTH CHECK

app.get("/", (req, res) => {

  res.json({

    success: true,

    message:
      "BioQuorix backend running"

  });

});


// SERVER

const PORT =
  process.env.PORT || 5000;


app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});
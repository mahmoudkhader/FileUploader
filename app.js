// Gridfs-stream resources: https://github.com/aheckmann/gridfs-stream
// Gridfs-storage resources https://github.com/devconcept/multer-gridfs-storage
// Basic express server
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const methodOverride = require("method-override");

// Initialize express app
const app = express();

// Create middleware
app.use(bodyParser.json());
app.use(methodOverride("_method"));

// Set ui view engine
app.set("view engine", "ejs");

// Mongo URI
const mongoURI = "mongodb://localhost/fileUpload";

// Create mongo connection
const conn = mongoose.createConnection(mongoURI);

// Init gfs
let gfs;

conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  // Specify what the name of the mongo collection for uploads will be
  gfs.collection("uploads");
  // all set!
});

// Create storage engine
var storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      // randomBytes is used to generate random names for the file
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        // Create file name with the file's extention
        const filename = buf.toString("hex") + path.extname(file.originalname);
        // Allocate a filename as well as the collection name (bucketName)
        const fileInfo = {
          filename: filename,
          bucketName: "uploads"
        };
        // Resolve promise with the file info
        resolve(fileInfo);
      });
    });
  }
});
// Create an upload variable and set it to multer with the storage engine passed inside
// This entire process allows us to create a post route and use the upload variable as the middleware so that it can upload the file to teh database
const upload = multer({ storage });

// @route GET /
// @desc Loads form
app.get("/", (req, res) => {
  // First, retrieve image files
  gfs.files.find().toArray((err, files) => {
    // Check if files exist
    if (!files || files.length === 0) {
      res.render("index", { files: false });
    } else {
      // If files exist, map through files and determine if they are images. Takes in file paramater and runs through conditional statement
      files.map(file => {
        // Checks if the file is an image
        if (
          file.contentType === "image/jpeg" ||
          file.contentType === "image/png"
        ) {
          // If true, add a property called 'isImage' and set it to true
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      // Render the files
      res.render("index", { files: files });
    }
  });
});

// @route POST /upload
// @desc Uploads file to mongoDB
// In this post request, first indicate the path, then indicate the upload middleware(also use the .single method to upload one doc at a time,and pass in the name to go into the file field, as seen in the html file input name), then the req,res
app.post("/upload", upload.single("file"), (req, res) => {
  // res.json({ file: req.file });
  // res.json(console.log(upload));
  res.redirect("/");
});

// @route GET /files
// @desc  Display all files in json
app.get("/files", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check if files exist
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: "No files exist"
      });
    }
    // Otherwise, files exist and return the array
    return res.json(files);
  });
});

// @route GET /files/:filename
// @desc  Display a single file object in json
app.get("/files/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file exist
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: "File does not exist"
      });
    }
    // Otherwise, file exists and return the file
    return res.json(file);
  });
});

// @route GET /image/:filename
// @desc  Display a file as an image
app.get("/image/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file exist
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: "Image file does not exist"
      });
    }
    // Check if file is an image
    if (file.contentType === "image/jpeg" || file.contentType === "image/png") {
      // Read output to browser
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: "File is not an image"
      });
    }
  });
});

// @route DELETE /files/:id
// @desc  Delete file
app.delete("/files/:id", (req, res) => {
  // The first argument (options) contains the id of the file to be deleted, and the root: option indicates the collection that it is in.
  // After that, run function that gives err and gridStore
  gfs.remove({ _id: req.params.id, root: "uploads" }, function(err, gridStore) {
    // Return errors if they exist
    if (err) {
      return res.status(404).json({ err: err });
    }
    // If no errors, redirect
    res.redirect("/");
  });
});

const port = 5000;

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

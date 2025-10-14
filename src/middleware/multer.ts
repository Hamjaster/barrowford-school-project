// src/middleware/upload.ts
import multer, { StorageEngine, FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";
import crypto from "crypto";

// Define uploads folder path
const uploadPath = path.join(process.cwd(), "uploads");

// Auto-create uploads folder if missing
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
  console.log(`✅ Created uploads folder at: ${uploadPath}`);
}

// Configure disk storage
const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // e.g. ".pdf"
    const baseName = path.basename(file.originalname, ext); // e.g. "report"
    const uniqueSuffix = crypto.randomBytes(2).toString("hex"); // short unique id
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

// File filter (images, videos, pdf, word, excel)
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "video/mp4",
    "application/pdf",
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only jpg, png, mp4, pdf, Word (.doc/.docx), or Excel (.xls/.xlsx) files are allowed!"
      )
    );
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// CSV-specific multer configuration for bulk imports
const csvStorage: StorageEngine = multer.memoryStorage();

const csvFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowedTypes = [
    "text/csv",
    "application/csv",
    "text/plain"
  ];

  // Also allow files with .csv extension regardless of mimetype
  const isCSV = allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.csv');

  if (isCSV) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed for bulk import!"));
  }
};

export const csvUpload = multer({
  storage: csvStorage,
  fileFilter: csvFileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB max for CSV files
    files: 1 // Only allow one file at a time
  },
});

export default upload;

import cloudinary from "../../uploadCloudinary.js";
import path from "path";

/**
 * Upload a file to Cloudinary
 * @param filePath - Local path of the file (e.g. from multer)
 * @param folder - Optional folder name in Cloudinary
 * @returns The uploaded file's details (including secure_url)
 */
export default async function uploadFileToCloudinary(
  filePath: string,
  folder: string = "ReflectionFiles"
) {
  try {
    // Extract filename without extension to use as Cloudinary public_id
    const ext = path.extname(filePath); // e.g. ".pdf"
    const baseName = path.basename(filePath, ext); // e.g. "report-8f3a"

    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "auto",  // auto-detect image, video, raw (pdf, doc, etc.)
      public_id: baseName,    // 👈 use cleaned filename instead of random string
      overwrite: true,        // optional: allow replacing file if same name exists
    });

    return {
      success: true,
      url: result.secure_url,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

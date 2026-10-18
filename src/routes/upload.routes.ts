import { Router, Response } from 'express';
import { upload } from '../middleware/upload';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Single image upload
router.post('/single', upload.single('image'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file uploaded' });
      return;
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      message: 'Image uploaded successfully',
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error('Error handling single upload:', error);
    res.status(500).json({ error: 'Failed to process file upload' });
  }
});

// Multiple image upload
router.post('/multiple', upload.array('images', 5), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files were uploaded' });
      return;
    }

    const uploadedUrls = files.map((file) => `/uploads/${file.filename}`);
    res.json({
      message: `${files.length} images uploaded successfully`,
      urls: uploadedUrls,
    });
  } catch (error) {
    console.error('Error handling multiple upload:', error);
    res.status(500).json({ error: 'Failed to process file uploads' });
  }
});

export default router;

import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import {
  updateImpact,
  updateExperience,
  getMyImpacts,
  getMyExperiences,
  
} from '../controllers/studentPagesController.js';
import {
  uploadStudentImage,
  getMyStudentImages,
  deleteMyStudentImage,
  getStudentImagesByTeacher,
  deleteStudentImages} from '../controllers/studentImagesController.js';
import { deleteStudentLearning, getMyLearnings, addStudentLearning } from '../controllers/studentLearningController.js';

const router = Router();

// impacts
router.put('/impacts', authenticateToken,checkPermission("manage_student_pages"), updateImpact as any);
router.get('/impacts/me', authenticateToken,checkPermission("manage_student_pages"), getMyImpacts as any);

// experiences
router.put('/experiences', authenticateToken,checkPermission("manage_student_pages"), updateExperience as any);
router.get('/experiences/me', authenticateToken,checkPermission("manage_student_pages"), getMyExperiences as any);


// learnings
router.post('/learning/', authenticateToken, checkPermission("manage_student_pages"), addStudentLearning as any);
router.delete('/learning/:id', authenticateToken, checkPermission("manage_student_pages"), deleteStudentLearning as any);
router.get('/learning/me', authenticateToken, checkPermission("manage_student_pages"), getMyLearnings as any);


// images
router.post('/images', authenticateToken,checkPermission("manage_own_images"), uploadStudentImage as any);
router.get('/images/me', authenticateToken,checkPermission("manage_own_images"), getMyStudentImages as any);
router.delete('/images/:id', authenticateToken,checkPermission("manage_own_images"), deleteMyStudentImage as any);

// upper level access
router.get('/images/:studentId', authenticateToken,checkPermission("manage_student_images"), getStudentImagesByTeacher as any);
router.delete('/images/:id', authenticateToken,checkPermission("manage_student_images"), deleteStudentImages as any);

export default router;

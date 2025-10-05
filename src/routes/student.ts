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
  getMystudent_images,
  deleteMyStudentImage,
  getstudent_imagesByTeacher,
  deletestudent_images} from '../controllers/studentImagesController.js';
import { deleteStudentLearning, getMyLearnings, addStudentLearning } from '../controllers/studentLearningController.js';
import { getStudentDetails } from '../controllers/studentdetailscontroller.js';

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
router.post('/learning/me', authenticateToken, checkPermission("manage_student_pages"), getMyLearnings as any);


// images
router.post('/images', authenticateToken,checkPermission("manage_own_images"), uploadStudentImage as any);
router.get('/images/me', authenticateToken,checkPermission("manage_own_images"), getMystudent_images as any);
router.delete('/images/:id', authenticateToken,checkPermission("manage_own_images"), deleteMyStudentImage as any);

// upper level access
router.get('/images/:studentId', authenticateToken,checkPermission("manage_student_images"), getstudent_imagesByTeacher as any);
router.delete('/images/:id', authenticateToken,checkPermission("manage_student_images"), deletestudent_images as any);

router.get('/details/me', authenticateToken,checkPermission("get_student_details"), getStudentDetails as any);
export default router;

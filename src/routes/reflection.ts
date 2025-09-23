import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { createReflectioTopic, fetchActiveTopics,createReflection,fetchAllReflectionsWithTitle,
    fetchStudentReflectionsWithTitle,UpdateReflection,addComment,
    fetchComments,fetchReflectionsByStudentId,deleteReflection
 } from '../controllers/reflectionController.js';
import upload from '../middleware/multer.js';


const router = Router();

// Only admin, staff_admin, staff can manage topics
router.post('/createtopics',authenticateToken,checkPermission('create-reflection-topic'),createReflectioTopic as any)
router.get('/all',authenticateToken,checkPermission('all-reflections'),fetchAllReflectionsWithTitle as any)
router.put('/update',authenticateToken,checkPermission('update-reflections'),UpdateReflection as any)
router.delete("/:reflectionId", authenticateToken, checkPermission('delete-reflections'), deleteReflection as any);
//reflection/update

//for student to manages topic 
router.get('/activetopics',authenticateToken,checkPermission('get-active-topics'),fetchActiveTopics as any)

//student to create reflection  //reflection/createreflection
router.post('/createreflection',authenticateToken,checkPermission('create-reflection'),upload.single('file'),createReflection as any)
//student to fetch his reflection
router.get('/my',authenticateToken,checkPermission('fetch-my-reflections'),fetchStudentReflectionsWithTitle as any)
router.post('/addcomment',authenticateToken,checkPermission('add-comments'),addComment as any)
router.get('/comment',authenticateToken,checkPermission("fetch-comments"),fetchComments as any)
//parents to fetch by id
router.get("/",authenticateToken,checkPermission('fetch-reflection-id'), fetchReflectionsByStudentId as any);




export default router
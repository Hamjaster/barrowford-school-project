import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import {  fetchActiveTopics,createReflection,fetchAllReflectionsWithTitle,
    fetchStudentReflections,UpdateReflection,addComment,
    fetchComments,fetchReflectionsByStudentId,deleteReflection,requestDeleteReflection,
    fetchAllTopics, updateTopic, deleteTopic, getPreviousWeeksForUser,
    createReflectionTopic
 } from '../controllers/reflectionController.js';
import upload from '../middleware/multer.js';


const router = Router();

// Only admin, staff_admin, staff can manage topics
router.post('/createtopics',authenticateToken,checkPermission('create-reflection-topic'),createReflectionTopic  as any)
router.get('/topics',authenticateToken,checkPermission('fetch-all-topics'),fetchAllTopics as any)
router.put('/topics/:id',authenticateToken,checkPermission('update-reflection-topic'),updateTopic as any)
router.delete('/topics/:id',authenticateToken,checkPermission('delete-reflection-topic'),deleteTopic as any)

// Reflection management routes
router.get('/all',authenticateToken,checkPermission('all-reflections'),fetchAllReflectionsWithTitle as any)
router.put('/update',authenticateToken,checkPermission('update-reflections'),UpdateReflection as any)
router.delete("/:reflectionId", authenticateToken, checkPermission('delete-reflections'), deleteReflection as any);
// Student request to delete reflection (creates moderation request)
router.delete("/student/:reflectionId", authenticateToken, checkPermission('create-reflection'), requestDeleteReflection as any);
//reflection/update

//for student to manages topic 
router.get('/activetopics',authenticateToken,checkPermission('get-active-topics'),fetchActiveTopics as any)

//student to create reflection  //reflection/createreflection
router.post('/createreflection',authenticateToken,checkPermission('create-reflection'),upload.single('file'),createReflection as any)
//student to fetch his reflection
router.get('/my',authenticateToken,checkPermission('fetch-my-reflections'),fetchStudentReflections as any)
router.post('/addcomment',authenticateToken,checkPermission('add-comments'),addComment as any)
router.get('/comment/:reflectionId',authenticateToken,checkPermission("fetch-comments"),fetchComments as any)
//parents to fetch by id
router.get("/:studentId",authenticateToken,checkPermission('get-student-reflections'), fetchReflectionsByStudentId as any);

// Get previous weeks for a user
router.get("/weeks/previous", authenticateToken, getPreviousWeeksForUser as any);




export default router
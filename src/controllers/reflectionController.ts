import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import uploadfile from '../utils/uploadfiles.js'


export const createReflectioTopic = async (req:AuthenticatedRequest,res : Response)=>{
    try{
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        // Fetch staff id using auth_user_id (UUID from Supabase Auth)
        const { data: staff, error: staffError } = await supabase
        .from("staffs")
        .select("id")
        .eq("auth_user_id", req.user.userId)  // req.user.userId should be UUID
        .single();

        
        console.error("Staff fetch error:", staffError);

        if (staffError || !staff) {
            return res.status(404).json({ error: "Staff not found" });
        }

        const { data, error } = await supabase
        .from("reflectiontopics")
        .insert([{ title, created_by: staff.id }]) 
        .select()
        .single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
       
    }
    catch(error : any){
        console.error('Error creating relection section topic:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const fetchAllTopics = async (req: AuthenticatedRequest, res: Response) => {
    try {
        // Fetch all reflection topics
        const { data, error } = await supabase
            .from("reflectiontopics")
            .select("*")
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching topics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const updateTopic = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, is_active } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Topic ID is required' });
        }

        // Validate input
        if (!title && is_active === undefined) {
            return res.status(400).json({ error: 'At least title or is_active must be provided' });
        }

        // Prepare update object
        const updateData: any = {};
        if (title) updateData.title = title;
        if (is_active !== undefined) updateData.is_active = is_active;

        // Update the topic
        const { data, error } = await supabase
            .from("reflectiontopics")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Topic not found' });
            }
            throw error;
        }

        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating topic:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const deleteTopic = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'Topic ID is required' });
        }

        // Check if topic exists and get info before deletion
        const { data: existingTopic, error: fetchError } = await supabase
            .from("reflectiontopics")
            .select("id, title")
            .eq("id", id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({ error: 'Topic not found' });
            }
            throw fetchError;
        }

        // Check if there are any reflections using this topic
        const { data: reflections, error: reflectionError } = await supabase
            .from("reflections")
            .select("id")
            .eq("topic_id", id)
            .limit(1);

        if (reflectionError) throw reflectionError;

        if (reflections && reflections.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete topic with existing reflections. Please remove all reflections first.' 
            });
        }

        // Delete the topic
        const { error: deleteError } = await supabase
            .from("reflectiontopics")
            .delete()
            .eq("id", id);

        if (deleteError) throw deleteError;

        res.status(200).json({ 
            success: true, 
            message: `Topic "${existingTopic.title}" deleted successfully`,
            deletedTopicId: id
        });
    } catch (error: any) {
        console.error('Error deleting topic:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const fetchActiveTopics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Get student ID from auth_user_id
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("auth_user_id", req.user.userId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: "Student record not found" });
    }

    // 2. Fetch all topic_ids this student already has reflections for
    const { data: reflections, error: reflectionError } = await supabase
      .from("reflections")
      .select("topic_id")
      .eq("student_id", student.id);

    if (reflectionError) {
      return res.status(500).json({ error: "Error fetching student reflections" });
    }

    // Extract all topic_ids into an array
    const reflectedTopicIds = reflections?.map(r => r.topic_id) || [];

    // 3. Fetch active topics excluding the ones student already reflected on
    const { data, error } = await supabase
      .from("reflectiontopics")
      .select("id, title")
      .eq("is_active", true)
      .not("id", "in", `(${reflectedTopicIds.join(",") || "NULL"})`);

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching active reflection topics:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const createReflection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { topicID, content } = req.body;
    const file = req.file;

    if (!topicID) return res.status(400).json({ error: 'Title is required' });
    if (!content) return res.status(400).json({ error: 'Content is required' });

    let imageURL: string = "";
    if (file) {
      const response = await uploadfile(file.path);
      if (response.success && response.url) {
        imageURL = response.url;
      } else {
        return res.status(400).json({ error: 'File upload failed, please try again' });
      }
    }

    // Fetch student id using auth_user_id (UUID from Supabase Auth)
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, year_group_id')
      .eq('auth_user_id', req.user.userId)
      .maybeSingle()

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student record not found' });
    }
   
    // Check if the student has already submitted for this topic
    const { data: existingReflection, error: existingError } = await supabase
      .from('reflections')
      .select('id')
      .eq('student_id', student.id)
      .eq('topic_id', topicID)
      .single()

    if (existingReflection) {
      return res.status(403).json({ error: 'You have already submitted a reflection for this topic' });
    }

    // Save the reflection
    const { data, error } = await supabase
      .from('reflections')
      .insert({
        student_id: student.id,
        year_group_id: student.year_group_id,
        topic_id: topicID,
        content,
        attachment_url: imageURL,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error("Error creating reflection:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


//for teacher to get relection 
export const fetchAllReflectionsWithTitle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("reflections")
       .select(`
        id,
        content,
        attachment_url,
        student_id,
        created_at,
        topic_id,
        status,
        reflectiontopics!inner(title)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching reflections with title:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
// Admin/Teacher fetch reflections of a student by ID
export const fetchReflectionsByStudentId = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { studentId } = req.params; 
    if (!studentId) {
      return res.status(400).json({ error: "student id is required" });
    }

      const { data, error } = await supabase
    .from("reflections")
    .select(`
      id,
      content,
      attachment_url,
      student_id,
      created_at,
      topic_id,
      status,
      reflectiontopics!inner(title),
      reflectioncomments!inner(id,comment,created_at,user_role)
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching reflections by student_id:", err.message || err);
    res.status(500).json({ error: "Internal server error" });
  }
};


//stuents fetch their own reflection 
export const fetchStudentReflectionsWithTitle = async (req: AuthenticatedRequest, res: Response) => {
  try {
       // Find student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('auth_user_id', req.user.userId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: `Student record not found ${student}` });
    }

  const { data, error } = await supabase
    .from("reflections")
    .select(`
      id,
      content,
      attachment_url,
      student_id,
      created_at,
      topic_id,
      status,
      reflectiontopics!inner(title)
    `)
    .eq("student_id", student.id)
    .order("created_at", { ascending: false });


    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching reflections with title:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const UpdateReflection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, title, content, status } = req.body;

    // Validation
    if (!id) return res.status(400).json({ error: "Reflection ID is required during update" });
    // if (!title) return res.status(400).json({ error: "Title is required" });
    if (!content) return res.status(400).json({ error: "Content is required" });
    if (!status) return res.status(400).json({ error: "Status is required" });
    

    // ✅ Update reflection and return the updated row
    const { data: reflection, error } = await supabase
      .from("reflections")
      .update({ content, status })
      .eq("id", id)
      .select(`
        id,
        content,
        attachment_url,
        student_id,
        created_at,
        topic_id,
        status,
        reflectiontopics!inner(title)
      `)
      .single();

    if (error) throw error;



    res.status(200).json({
      success: true,
      reflection,
    });
  } catch (err: any) {
    console.error("Error updating reflection by teacher:", err.message || err);
    res.status(500).json({ error: "Internal server error" });
  }
};


//update reflection from student
export const UpdateReflectionFromStudent = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { id, content } = req.body;
    const file = req.file;

    // ✅ Validation
    if (!id) return res.status(400).json({ error: "Reflection ID is required" });
    if (!content) return res.status(400).json({ error: "Content is required" });

    // ✅ Find student record
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("auth_user_id", req.user.userId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: "Student record not found" });
    }

    // ✅ Check reflection exists and not approved
    const { data: reflection, error: reflectionError } = await supabase
      .from("reflections") // fixed typo: was 'relections'
      .select("status")
      .eq("id", id)
      .eq("student_id", student.id)
      .single();

    if (reflectionError || !reflection) {
      return res.status(404).json({ error: "Reflection not found" });
    }

    if (reflection.status === "approved") {
      return res
        .status(403)
        .json({ error: "Approved reflections cannot be edited" });
    }

    // ✅ Handle optional file upload
    let imageUrl: string | undefined;
    if (file) {
      const response = await uploadfile(file.path); // expects local path
      if (response.success && response.url) {
        imageUrl = response.url;
      } else {
        return res.status(400).json({ error: "Invalid image format" });
      }
    }

    // ✅ Build update payload
    const updatePayload: any = { content, status: "pending" };
    if (imageUrl) updatePayload.attachment_url = imageUrl;

    // ✅ Update reflection
    const { data, error } = await supabase
      .from("reflections")
      .update(updatePayload)
      .eq("id", id)
      .eq("student_id", student.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error updating reflection by student:", err.message || err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addComment = async(req:AuthenticatedRequest,res:Response)=>{
  const {reflectionId,content} = req.body;
  try{

  if(!reflectionId) return res.status(400).json({error :"Reflection is requird"})
  if(!content) return res.status(400).json({error : 'Comment is Required'})

  // Fetch user id using auth_user_id (UUID from Supabase Auth)
  const [staffRes, parentRes] = await Promise.all([
  supabase.from("staffs").select("id").eq("auth_user_id", req.user.userId).maybeSingle(),
  supabase.from("parents").select("id").eq("auth_user_id", req.user.userId).maybeSingle(),
    ]);

    let user_id: number | null = null;
    let user_role: string | null = null;

    if (staffRes.data) {
      user_id = staffRes.data.id;
      user_role = "Teacher";
    } else if (parentRes.data) {
      user_id = parentRes.data.id;
      user_role = "Parent";
    } else {
      return res.status(404).json({ error: "User not found" });
    }

    const { data , error } = await supabase
    .from("reflectioncomments")
    .insert({reflection_id:reflectionId,user_id:user_id,comment:content, user_role:user_role})
    .select('id,created_at,comment, user_role')
    .single()

    if(error) throw error;
    res.status(200).json({success:true , data})
  }
  catch(err:any){
    console.log('Error while adding comment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }


}

// ✅ Fetch all comments for a reflection
export const fetchComments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reflectionId } = req.params;

    if (!reflectionId) {
      return res.status(400).json({ error: "Reflection ID is required" });
    }
    


    const { data, error } = await supabase
      .from("reflectioncomments")
      .select('*')
      .eq("reflection_id", reflectionId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching comments:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete reflection along with its comments (teacher only)
export const deleteReflection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reflectionId } = req.params;
console.log("ReflectionDeleting",reflectionId)
    if (!reflectionId) {
      return res.status(400).json({ error: "Reflection ID is required" });
    }

    // Check teacher permission (optional if using middleware)
    // if (req.user.role !== "teacher") {
    //   return res.status(403).json({ error: "Forbidden: Only teachers can delete reflections" });
    // }

    // Check if the reflection exists
    const { data: reflection, error: reflectionError } = await supabase
      .from('reflections')
      .select('id')
      .eq('id', reflectionId)
      .single();

    if (reflectionError || !reflection) {
      return res.status(404).json({ error: "Reflection not found" });
    }

    // Delete all comments associated with this reflection
    const { error: deleteCommentsError } = await supabase
      .from('reflectioncomments')
      .delete()
      .eq('reflection_id', reflectionId);

    if (deleteCommentsError) {
      throw deleteCommentsError;
    }

    // Delete the reflection itself
    const { error: deleteReflectionError } = await supabase
      .from('reflections')
      .delete()
      .eq('id', reflectionId);

    if (deleteReflectionError) {
      throw deleteReflectionError;
    }

    res.status(200).json({ success: true, message: "Reflection and its comments deleted successfully" });

  } catch (err: any) {
    console.error("Error deleting reflection:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

















import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';


export const getAssignedStudents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== "staff") {
      return res
        .status(403)
        .json({ error: "Only teachers can access assigned students" });
    }

    // 1️⃣ Find teacher record
    const { data: teacher, error: teacherError } = await supabase
      .from("staffs")
      .select("id, year_group_id, class_id")
      .eq("auth_user_id", req.user.userId)
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: "Teacher record not found" });
    }

    // 2️⃣ Fetch students assigned to this teacher
    const { data: students, error: studentError } = await supabase
      .from("students")
      .select(`
        id,
        first_name,
        last_name,
        email,
        dob,
        height,
        year_group_id,
        class_id,
        created_at,
        profile_photo,
        hair_color
      `)
      .eq("year_group_id", teacher.year_group_id)
      .eq("class_id", teacher.class_id);

    if (studentError) throw studentError;

    // 3️⃣ Format response with derived fields (full name + age + class name)
    const studentsWithExtras = students?.map((student: any) => {
      const age = student.dob
        ? new Date().getFullYear() - new Date(student.dob).getFullYear()
        : null;

      return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        age,
        height:student.height,
        hair_color:student.hair_color,
        year: student.year_group_id,
        class: student.class_id, // we'll resolve class name below
        profile_photo: student.profile_photo,
        created_at: student.created_at,
      };
    });

    // 4️⃣ Optionally fetch class name once (optimization)
    const { data: classRow } = await supabase
      .from("classes")
      .select("id, name");

    const studentsFinal = studentsWithExtras.map((s) => ({
      ...s,
      class_name: classRow?.find((c) => c.id === s.class)?.name || null,
    }));

    // 5️⃣ Return clean structured response
    return res.status(200).json({
      success: true,
      data: studentsFinal,
    });
  } catch (err: any) {
    console.error("Error fetching assigned students:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const updateStudentProfile = async (req: any, res: any) => {
  try {
    const {
      studentId,
      profile_photo,
      first_name,
      last_name,
      year_group_id,
      class_name,
      hair_color,
      height,
    } = req.body;

    console.log("req.body!!", req.body);

    if (!studentId) {
      return res.status(400).json({ error: "studentId is required" });
    }

    const updateData: Record<string, any> = {};

    // ✅ If class_name is provided, look up its class_id from classes table
    if (class_name) {
      const { data: classRecord, error: classError } = await supabase
        .from("classes")
        .select("id")
        .eq("name", class_name)
        .single();

      if (classError || !classRecord) {
        return res.status(400).json({ error: "Invalid class name provided" });
      }

      updateData.class_id = classRecord.id;
      console.log("classid",classRecord.id)
    }

    if (profile_photo !== undefined) updateData.profile_photo = profile_photo;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (year_group_id !== undefined) updateData.year_group_id = year_group_id;
    if (hair_color !== undefined) updateData.hair_color = hair_color;
    if (height !== undefined) updateData.height = height;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update" });
    }

    // 🛠️ Perform the update
    const { data, error } = await supabase
      .from("students")
      .update(updateData)
      .eq("id", studentId)
      .select("*")
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Student profile updated successfully",
      data,
    });
  } catch (err: any) {
    console.error("❌ Error updating student profile:", err);
    return res.status(500).json({ error: "Failed to update student profile" });
  }
};


export const getTeacherProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Only teachers can access their profile' });
    }


    const { data: teacher, error: teacherError } = await supabase
      .from('staffs')
      .select('id, year_group_id, class_id, created_at, auth_user_id, first_name, last_name, email, status')
      .eq('auth_user_id', req.user.userId)
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }


    let className = null;
    if (teacher.class_id) {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('name')
        .eq('id', teacher.class_id)
        .single();

      if (!classError && classData) {
        className = classData.name;
      }
    }

    res.status(200).json({
      success: true,
      teacher: {
        ...teacher,
        class_name: className,
      },

    });

  } catch (err: any) {
    console.error('Error fetching teacher profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};